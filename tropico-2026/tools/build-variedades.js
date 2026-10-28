#!/usr/bin/env node
/** build-variedades.js - assemble the second room. node tools/build-variedades.js */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "variedades");
const RENDERS = path.join(DIR, "renders");
fs.mkdirSync(RENDERS, { recursive: true });

const dirs = fs.readdirSync(DIR).filter(d => /^v\d+-/.test(d) && fs.statSync(path.join(DIR, d)).isDirectory()).sort();
const pieces = [];
for (const d of dirs) {
  const abs = path.join(DIR, d);
  const metaPath = path.join(abs, "meta.json");
  if (!fs.existsSync(metaPath)) { console.log("skip (no meta): " + d); continue; }
  let meta; try { meta = JSON.parse(fs.readFileSync(metaPath, "utf8")); }
  catch (e) { console.log("skip (bad meta): " + d); continue; }
  const num = (d.match(/^v(\d+)-/) || [])[1] || "0";
  const id = "V" + num;
  meta.id = id;
  const png = fs.readdirSync(abs).find(f => f.startsWith("render-") && f.endsWith(".png"));
  const svg = fs.readdirSync(abs).find(f => f.endsWith(".svg"));
  let rel = null;
  if (png) {
    const out = id + "-" + (meta.slug || d.replace(/^v\d+-/, "")) + ".png";
    fs.copyFileSync(path.join(abs, png), path.join(RENDERS, out));
    rel = "../variedades/renders/" + out;
  }
  pieces.push({ id, title: meta.title || d, style: meta.style || "", theme: meta.theme || "",
    composition: meta.composition || "", artist: meta.artist || "", year: meta.year || 2026,
    file: rel, svg: svg ? "../variedades/" + d + "/" + svg : null,
    palette: Array.isArray(meta.palette) ? meta.palette : Object.values(meta.palette || {}), statement: meta.statement || "" });
}
pieces.sort((a, b) => a.id.localeCompare(b.id));
fs.writeFileSync(path.join(DIR, "pieces.js"), "window.PIECES = " + JSON.stringify(pieces, null, 2) + ";\n");
console.log("built " + pieces.length + " pieces -> variedades/pieces.js");
for (const p of pieces) console.log("  " + p.id + "  " + p.title + "  " + (p.file ? "ok" : "NO RENDER"));
