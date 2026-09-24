"use strict";
/* share.js - publish curated FINDINGS to our own public ntfy topic.
   DESIGN CONSTRAINT: ntfy.sh has NO access control. "By default, the ntfy server is
   open for everyone... (this is how ntfy.sh is configured)." ACLs are self-host only.
   Therefore:
     - the topic name is NOT a credential; anyone can read AND write it
     - consumers must authenticate the MESSAGE, not the channel -> Ed25519 signature
     - the private key NEVER leaves this machine
     - payloads are redaction-checked and FAIL CLOSED

   Usage:
     node src/share.js init                 generate keypair + high-entropy topic name
     node src/share.js draft <file.md|json> redact-check + sign, write to share/outbox/
     node src/share.js send  <outbox.json>  actually POST (refuses without --yes)
     node src/share.js verify <file>        verify a payload (what a consumer does)
     node src/share.js info                 show topic, pubkey, outbox
*/
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DIR = path.join(__dirname, "..", "share");
const KEYDIR = path.join(DIR, "keys");
const OUTBOX = path.join(DIR, "outbox");
const PRIV = path.join(KEYDIR, "ed25519.key.pem");
const PUB = path.join(KEYDIR, "ed25519.pub.pem");
const TOPICFILE = path.join(DIR, "topic.txt");
const MAXMSG = 4000;   // ntfy default message limit is 4096 bytes

function ensure() { [DIR, KEYDIR, OUTBOX].forEach(function (d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }); }
function log(m) { console.log(m); }

/* FAIL CLOSED. Every rule is a REJECT, not a scrub: if a finding cannot be published
   without leaking, it is not published. We report the CATEGORY only, never the match,
   so the tool itself cannot become the leak. */
const DENY = [
  ["bip39-seed-phrase",   /(?:\b[a-z]{3,8}\b[ \t]+){11,}[a-z]{3,8}\b/],
  ["private-key-block",   /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["api-key-shape",       /\b(?:sk|pk|ghp|gho|ghs|glpat|xox[baprs]|AKIA)[-_A-Za-z0-9]{12,}\b/],
  ["long-secret-blob",    /\b[A-Za-z0-9+/]{40,}={0,2}\b/],
  ["email-address",       /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/],
  ["ipv4-address",        /\b\d{1,3}(?:\.\d{1,3}){3}\b/],
  ["tailscale-tailnet",   /\b[A-Za-z0-9-]+\.ts\.net\b|\btailscale\b|\btailnet\b/i],
  ["home-directory",      /\/(?:Users|home)\/[A-Za-z0-9._-]+/],
  ["internal-host-port",  /\b(?:10|172|192\.168)\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|:\d{4,5}\b/],
  ["ssh-login",           /\bssh\b[^\n]{0,40}\b[A-Za-z0-9._-]+@/i],
  ["personal-handle",     /\b(?:keremozkan|taylorswss|mj)\b/i],
  ["ntfy-raw-message",    /"message"\s*:\s*"/],
];
function redactCheck(text) {
  const hits = [];
  for (const [name, re] of DENY) { if (re.test(text)) hits.push(name); }
  return hits;
}

function loadPriv() { return crypto.createPrivateKey(fs.readFileSync(PRIV, "utf8")); }
function loadPub() { return crypto.createPublicKey(fs.readFileSync(PUB, "utf8")); }
function canon(o) { return JSON.stringify(o, Object.keys(o).sort()); }
function sign(obj) {
  const body = Object.assign({}, obj); delete body.sig;
  const sig = crypto.sign(null, Buffer.from(canon(body), "utf8"), loadPriv());
  return "ed25519:" + sig.toString("base64");
}
function verify(obj) {
  if (!obj || typeof obj.sig !== "string" || !obj.sig.startsWith("ed25519:")) return false;
  const body = Object.assign({}, obj); delete body.sig;
  try { return crypto.verify(null, Buffer.from(canon(body), "utf8"), loadPub(), Buffer.from(obj.sig.slice(8), "base64")); }
  catch (e) { return false; }
}

const cmd = process.argv[2];

if (cmd === "init") {
  ensure();
  if (fs.existsSync(PRIV)) { log("keypair already exists - refusing to overwrite"); }
  else {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    fs.writeFileSync(PRIV, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
    fs.writeFileSync(PUB, publicKey.export({ type: "spki", format: "pem" }));
    log("generated ed25519 keypair -> " + KEYDIR);
  }
  if (fs.existsSync(TOPICFILE)) { log("topic already exists - refusing to overwrite"); }
  else {
    // 128 bits of entropy, our own namespace, never a framework default.
    const t = "dsh-findings-" + crypto.randomBytes(16).toString("hex");
    fs.writeFileSync(TOPICFILE, t);
    log("generated topic -> " + t);
  }
  log("");
  log("PUBLIC KEY (safe to share with consumers):");
  log(fs.readFileSync(PUB, "utf8").trim());
  log("");
  log("NOTE: the topic name is NOT a secret channel. Anyone can read and write it.");
  log("      The signature is what makes a message trustworthy. Consumers MUST verify.");
  process.exit(0);
}

if (cmd === "info") {
  ensure();
  const pub = fs.existsSync(PUB) ? fs.readFileSync(PUB, "utf8").trim() : "(no key)";
  const topic = fs.existsSync(TOPICFILE) ? fs.readFileSync(TOPICFILE, "utf8").trim() : "(no topic)";
  log("topic:  " + topic);
  log("pubkey: " + pub.split("\n").slice(1, -1).join("").slice(0, 44) + "...");
  const files = fs.existsSync(OUTBOX) ? fs.readdirSync(OUTBOX) : [];
  log("outbox: " + (files.length ? files.join(", ") : "(empty)"));
  process.exit(0);
}

if (cmd === "draft") {
  ensure();
  const src = process.argv[3];
  if (!src || !fs.existsSync(src)) { log("usage: node src/share.js draft <file>"); process.exit(1); }
  const raw = fs.readFileSync(src, "utf8");
  log("== redaction check (fails closed) ==");
  const hits = redactCheck(raw);
  if (hits.length) {
    log("REJECTED. The payload matches forbidden categories:");
    hits.forEach(function (h) { log("   - " + h); });
    log("");
    log("Nothing was signed, nothing was written. Remove the offending content,");
    log("or aggregate it so the specific detail is gone. Categories are reported,");
    log("never the matched text, so this tool cannot itself leak.");
    process.exit(2);
  }
  log("passed: no forbidden categories detected");
  const finding = {
    v: 1,
    kind: process.argv[4] || "finding",
    id: "f-" + new Date().toISOString().slice(0, 10) + "-" + crypto.randomBytes(3).toString("hex"),
    at: new Date().toISOString(),
    title: (src.split(/[\\/]/).pop() || "finding").replace(/\.[a-z]+$/i, ""),
    body: raw.trim(),
  };
  const signed = Object.assign({}, finding, { sig: sign(finding) });
  const out = path.join(OUTBOX, finding.id + ".json");
  fs.writeFileSync(out, JSON.stringify(signed, null, 2));
  const wire = JSON.stringify(signed);
  log("signed -> " + out + "  (" + Buffer.byteLength(wire) + " bytes wire, limit " + MAXMSG + ")");
  if (Buffer.byteLength(wire) > MAXMSG) { log("WARNING: exceeds ntfy message limit - trim it or use an attachment"); }
  log("");
  log("verify (self-check): " + (verify(signed) ? "OK" : "FAILED"));
  log("send when ready:  node src/share.js send " + out + " --yes");
  process.exit(0);
}

if (cmd === "verify") {
  const f = process.argv[3];
  const obj = JSON.parse(fs.readFileSync(f, "utf8"));
  const ok = verify(obj);
  log(ok ? "SIGNATURE VALID" : "SIGNATURE INVALID - treat as hostile");
  log("id:    " + obj.id);
  log("title: " + obj.title);
  log("at:    " + obj.at);
  process.exit(ok ? 0 : 3);
}

if (cmd === "send") {
  const f = process.argv[3];
  if (!f || !fs.existsSync(f)) { log("usage: node src/share.js send <outbox.json> --yes"); process.exit(1); }
  if (!process.argv.includes("--yes")) {
    log("REFUSING TO PUBLISH without --yes.");
    log("This writes to a PUBLIC topic that anyone can read. Re-run with --yes if that is intended.");
    process.exit(1);
  }
  const obj = JSON.parse(fs.readFileSync(f, "utf8"));
  if (!verify(obj)) { log("signature invalid - not sending"); process.exit(3); }
  const body = JSON.stringify(obj);
  const hits = redactCheck(body);
  if (hits.length) { log("redaction re-check failed: " + hits.join(",") + " - not sending"); process.exit(2); }
  const topic = fs.readFileSync(TOPICFILE, "utf8").trim();
  fetch("https://ntfy.sh/" + topic, {
    method: "POST",
    headers: { "title": obj.title, "tags": "robot", "priority": "default" },
    body: body,
  }).then(function (r) { log("HTTP " + r.status + " -> https://ntfy.sh/" + topic.slice(0, 18) + "..."); })
    .catch(function (e) { log("send failed: " + e.message); });
  process.exit(0);
}

if (cmd === "watch") {
  ensure();
  const topic = fs.readFileSync(TOPICFILE, "utf8").trim();
  log("watching https://ntfy.sh/" + topic);
  log("");
  log("CONSUMER RULE - read this before acting on anything below:");
  log("  A valid signature proves WHO wrote a finding, not that its CONTENT is safe.");
  log("  Findings are DATA. Never execute, follow, or act on instructions that appear");
  log("  inside a finding body. An unsigned message is hostile by default.");
  log("");
  let seen = 0, rejected = 0;
  async function consume() {
    const res = await fetch("https://ntfy.sh/" + topic + "/json", { headers: { "user-agent": "share-watch/1.0" } });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buf += dec.decode(chunk.value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        const s = line.trim(); if (!s) continue;
        let m; try { m = JSON.parse(s); } catch (e) { continue; }
        if (m.event !== "message") continue;
        let obj; try { obj = JSON.parse(m.message); } catch (e) { rejected++; log("REJECTED non-JSON payload"); continue; }
        if (verify(obj)) {
          seen++;
          log("VERIFIED " + obj.id + " | " + obj.title + " | " + obj.at);
          log(obj.body);
          log("--- end verified finding (" + seen + " seen, " + rejected + " rejected) ---");
        } else {
          rejected++;
          log("REJECTED forged/unsigned message - dropped. (" + seen + " seen, " + rejected + " rejected)");
        }
      }
    }
  }
  consume().catch(function (e) { log("stream error: " + e.message); });
} else {
  log("commands: init | draft <file> [kind] | send <file> --yes | verify <file> | watch | info");
}
