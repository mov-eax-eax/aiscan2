#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "multitudes");
const OUT = path.join(DIR, "renders");
fs.mkdirSync(OUT, { recursive: true });
const dirs = fs.readdirSync(DIR).filter(d => /^m\d+-/.test(d) && fs.statSync(path.join(DIR, d)).isDirectory()).sort();
const pieces = [];
for (const d of dirs) {
  const abs = path.join(DIR, d);
  const mp = path.join(abs, "meta.json");
  if (!fs.existsSync(mp)) { console.log("skip (no meta): " + d); continue; }
  let m; try { m = JSON.parse(fs.readFileSync(mp, "utf8")); } catch (e) { console.log("skip (bad meta): " + d); continue; }
  const num = (d.match(/^m(\d+)-/) || [])[1] || "0";
  const id = "M" + num; m.id = id;
  const png = fs.readdirSync(abs).find(f => f.startsWith("render-") && f.endsWith(".png"));
  const svg = fs.readdirSync(abs).find(f => f.endsWith(".svg"));
  let rel = null;
  if (png) {
    const out = id + "-" + (m.slug || d.replace(/^m\d+-/, "")) + ".jpg";
    execFileSync("magick", [path.join(abs, png), "-resize", "1600x", "-quality", "88", path.join(OUT, out)]);
    rel = "renders/" + out;
  }
  const pal = Array.isArray(m.palette) ? m.palette : Object.values(m.palette || {});
  pieces.push({ id, title: m.title || d, idiom: m.idiom || "", scene: m.scene || "", crowdRule: m.crowdRule || "", findIt: m.findIt || "", readings: m.readings || {}, artist: m.artist || "", file: rel, svg: svg ? d + "/" + svg : null, palette: pal, statement: m.statement || "" });
}
pieces.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
fs.writeFileSync(path.join(DIR, "pieces.js"), "window.PIECES = " + JSON.stringify(pieces, null, 2) + ";\n");
console.log("built " + pieces.length + " pieces -> multitudes/pieces.js");
for (const p of pieces) console.log("  " + p.id + "  " + p.title + "  " + (p.file ? "ok" : "NO RENDER"));
