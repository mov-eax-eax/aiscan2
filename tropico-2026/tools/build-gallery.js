#!/usr/bin/env node
/**
 * build-gallery.js - assemble the TROPICO 2026 exhibition.
 * Scans iterations/<n>-<slug>/meta.json + its render PNG, copies renders to
 * tropico-2026/renders/, and writes gallery/pieces.js for index.html.
 * Run from anywhere:  node tropico-2026/tools/build-gallery.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ITER = path.join(ROOT, "iterations");
const RENDERS = path.join(ROOT, "renders");
const GALLERY = path.join(ROOT, "gallery");

fs.mkdirSync(RENDERS, { recursive: true });
fs.mkdirSync(GALLERY, { recursive: true });

const dirs = fs.existsSync(ITER)
  ? fs.readdirSync(ITER).filter(d => fs.statSync(path.join(ITER, d)).isDirectory()).sort()
  : [];

let scores = {};
try { scores = JSON.parse(fs.readFileSync(path.join(GALLERY, "scores.json"), "utf8")); } catch (e) {}
const pieces = [];
for (const dir of dirs) {
  const abs = path.join(ITER, dir);
  const metaPath = path.join(abs, "meta.json");
  if (!fs.existsSync(metaPath)) { console.log("skip (no meta): " + dir); continue; }
  let meta;
  try { meta = JSON.parse(fs.readFileSync(metaPath, "utf8")); }
  catch (e) { console.log("skip (bad meta): " + dir + " -> " + e.message); continue; }

  const id = String(meta.id || dir.slice(0, 2)).padStart(2, "0");
  const svg = fs.readdirSync(abs).find(f => f.endsWith(".svg"));
  const png = fs.readdirSync(abs).find(f => f.startsWith("render-") && f.endsWith(".png"));
  let rel = null;
  if (png) {
    const outName = id + "-" + (meta.slug || dir.replace(/^[0-9]+-/, "")) + ".png";
    fs.copyFileSync(path.join(abs, png), path.join(RENDERS, outName));
    rel = "../renders/" + outName;
  }
  pieces.push({
    id,
    title: meta.title || dir,
    style: meta.style || "",
    artist: meta.artist || "",
    year: meta.year || 2026,
    file: rel,
    svg: svg ? "../iterations/" + dir + "/" + svg : null,
    palette: Array.isArray(meta.palette) ? meta.palette : Object.values(meta.palette || {}),
    statement: meta.statement || "",
    score: (scores[id] && scores[id].total) || meta.score || null,
    verdict: (scores[id] && scores[id].verdict) || null,
    tags: meta.tags || []
  });
}

pieces.sort((a, b) => a.id.localeCompare(b.id));
const out = "window.PIECES = " + JSON.stringify(pieces, null, 2) + ";\n";
fs.writeFileSync(path.join(GALLERY, "pieces.js"), out, "utf8");
console.log("built " + pieces.length + " pieces -> gallery/pieces.js");
for (const p of pieces) console.log("  " + p.id + "  " + p.title + "  " + (p.file ? "ok" : "NO RENDER"));
