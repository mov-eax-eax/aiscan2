"use strict";
const fs = require("fs");
const html = fs.readFileSync("src/ui.html", "utf8");
const js = fs.readFileSync("src/ui.js", "utf8");

const ids = new Set(Array.from(html.matchAll(/id="([^"]+)"/g)).map(function (m) { return m[1]; }));
const refs = new Set(Array.from(js.matchAll(/el\("([^"]+)"\)/g)).map(function (m) { return m[1]; }));
const missing = Array.from(refs).filter(function (r) { return !ids.has(r); });
const unused = Array.from(ids).filter(function (i) { return !refs.has(i); });

console.log("html ids       : " + ids.size);
console.log("js el() refs   : " + refs.size);
console.log("MISSING in html: " + (missing.length ? JSON.stringify(missing) : "none"));
console.log("unused ids     : " + JSON.stringify(unused));

const srcs = Array.from(html.matchAll(/src="([^"]+)"/g)).map(function (m) { return m[1]; });
const links = Array.from(html.matchAll(/href="([^"]+)"/g)).map(function (m) { return m[1]; });
console.log("script srcs    : " + JSON.stringify(srcs));
console.log("link hrefs     : " + JSON.stringify(links));

[].concat(srcs, links).forEach(function (p) {
  const f = "src/" + p.replace(/^\//, "");
  console.log("  asset " + p + " -> " + (fs.existsSync(f) ? "present" : "MISSING ON DISK"));
});

// does the collector's static route table cover every asset the page asks for?
const col = fs.readFileSync("src/collector.js", "utf8");
[].concat(srcs, links).forEach(function (p) {
  if (p.indexOf("//") === 0) return;
  const name = p.replace(/^\//, "");
  console.log("  route for " + p + " -> " + (col.indexOf('"' + p + '"') >= 0 || col.indexOf(name) >= 0 ? "covered" : "NOT ROUTED"));
});
