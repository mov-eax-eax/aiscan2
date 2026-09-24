"use strict";
/* E2: sensitivity of the conversation threshold. Ablate the ONLY known real
   conversation (topic hello) and the borderline case (chat) to find the boundary. */
const fs = require("fs"), path = require("path");
const S = require(path.join(__dirname, "..", "src", "signals.js"));
function load(t) {
  return fs.readFileSync(path.join(__dirname, "..", "data", "archive", t + ".jsonl"), "utf8").split("\n")
    .filter(function (l) { return l.trim(); }).map(function (l) { return JSON.parse(l); })
    .sort(function (a, b) { return a.time - b.time; });
}
const hello = load("hello"), chat = load("chat");
function score(label, msgs) {
  const c = S.conversation(msgs);
  console.log("  " + label.padEnd(38) + " score=" + String(c.score).padEnd(6) + " humans=" + String(c.humans).padEnd(3) + " distinct=" + String(c.distinct).padEnd(3) + " interactive=" + c.interactive + "  " + (c.score >= 0.6 ? "T4" : "-"));
}
console.log("E2: conversation threshold sensitivity\n");
console.log("HELLO (the known real conversation, 14 messages):");
score("full set", hello);
score("drop app test-notifications", hello.filter(function (m) { return m.title || !/test notification/i.test(m.message || ""); }));
score("only the cat exchange", hello.filter(function (m) { return /meow|miau|cat|hai/i.test(m.message || ""); }));
score("just Meow? / Meow!", hello.filter(function (m) { return /^Meow[?!]$/.test(m.message || ""); }));
score("Meow? / Meow! repeated x3", hello.filter(function (m) { return /^Meow[?!]$/.test(m.message || ""); }).concat(
  hello.filter(function (m) { return /^Meow[?!]$/.test(m.message || ""); }).slice(0,1)));
console.log("\nCHAT (borderline, 3 messages):");
score("full set", chat);
score("greeting + sybau only", chat.filter(function (m) { return !m.title; }));
score("greeting only", chat.filter(function (m) { return /NTFY club/i.test(m.message || ""); }));
console.log("\nCONTROLS (must stay below threshold):");
score("40x identical ops line", Array.from({ length: 40 }, function (_, i) { return { time: 1000 + i * 60, message: "backup ok" }; }));
score("20x templated sales", Array.from({ length: 20 }, function (_, i) { return { time: 1000 + i * 60, message: "Venta: " + i + " agua, Total " + i + ".00" }; }));
