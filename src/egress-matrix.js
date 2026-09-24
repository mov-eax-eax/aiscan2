"use strict";
/* egress-matrix.js - measure the EGRESS SURFACE of a sandbox.
 *
 * RUN THIS INSIDE THE SANDBOX (a Codex / Claude Code / container session), not on a
 * normal host. On an unrestricted host everything is reachable and the result is
 * meaningless - it measures the host, not the containment.
 *
 * READ-ONLY BY DESIGN. HEAD requests plus one DNS lookup. It writes nothing anywhere,
 * opens no account, posts no content, and touches 8 targets once each.
 *
 * WHAT IT ANSWERS - the POSTURE, not a hostname list:
 *     OPEN         arbitrary egress                 -> any write endpoint is a channel
 *     ALLOWLISTED  only the build-necessary set    -> escape surface = what the build needs
 *     DNS-ONLY     resolves, no HTTP               -> DNS is the channel; lists don't help
 *     ISOLATED     nothing reachable               -> containment holds
 *
 * WHAT IT CANNOT ANSWER - writability. "Can it reach X" is a GET question. "Can it
 * WRITE to X" needs a destination YOU own; see the note printed at the end.
 *
 * WHY THESE TARGETS: each one answers a DISTINCT question, so the verdict is decisive
 * without a long list. Cheap, ordered, and self-documenting in the output.
 */
const DNS = require("dns").promises;

const TARGETS = [
  { host: "registry.npmjs.org",  why: "build-necessary: package registry" },
  { host: "pypi.org",            why: "build-necessary: package registry" },
  { host: "api.github.com",      why: "build-necessary: VCS" },
  { host: "huggingface.co",      why: "model hub (the July 2026 incident's destination)" },
  { host: "api.anthropic.com",   why: "model API - always reachable if the agent runs" },
  { host: "example.com",         why: "CONTROL - arbitrary/unrelated. Reachable => egress is OPEN" },
];
const IP_TARGET = { host: "1.1.1.1", why: "raw IP - separates 'DNS blocked' from 'HTTP blocked'" };
const DNS_CANARY = "egress-check-" + Math.random().toString(36).slice(2, 10) + ".example.com";

function head(host, ms) {
  return new Promise(function (resolve) {
    const ctrl = new AbortController();
    const t = setTimeout(function () { ctrl.abort(); }, ms);
    const started = Date.now();
    fetch("https://" + host + "/", { method: "HEAD", signal: ctrl.signal, redirect: "manual" })
      .then(function (r) { clearTimeout(t); resolve({ ok: true, status: r.status, ms: Date.now() - started }); })
      .catch(function (e) { clearTimeout(t); resolve({ ok: false, err: (e && e.message) || String(e), ms: Date.now() - started }); });
  });
}

(async function () {
  console.log("EGRESS MATRIX - read-only containment self-test");
  console.log("If you are not inside the target sandbox, STOP: this result means nothing.");
  console.log("");

  const results = {};
  for (const t of TARGETS) {
    const r = await head(t.host, 4000);
    results[t.host] = r.ok;
    console.log((r.ok ? "  REACH  " : "  BLOCK  ") + t.host.padEnd(22) +
      String(r.ok ? ("HTTP " + r.status) : r.err.slice(0, 28)).padEnd(18) + t.ms + "ms   " + t.why);
  }
  const ip = await head(IP_TARGET.host, 4000);
  console.log((ip.ok ? "  REACH  " : "  BLOCK  ") + IP_TARGET.host.padEnd(22) +
    String(ip.ok ? ("HTTP " + ip.status) : ip.err.slice(0, 28)).padEnd(18) + ip.ms + "ms   " + IP_TARGET.why);

  let dnsOk = false, dnsErr = "";
  try { await DNS.resolve(DNS_CANARY); dnsOk = true; } catch (e) { dnsErr = e.code || e.message; }
  const nodata = dnsErr === "ENOTFOUND" || dnsErr === "ENODATA";
  console.log("");
  console.log("  DNS     " + DNS_CANARY);
  console.log("          -> " + (dnsOk ? "RESOLVED" : dnsErr) +
    (nodata ? "   (ENOTFOUND is the GOOD outcome: the resolver answered)" : ""));

  const build = ["registry.npmjs.org", "pypi.org", "api.github.com"].filter(function (h) { return results[h]; });
  const arbitrary = results["example.com"];
  const model = results["api.anthropic.com"];

  let posture;
  if (arbitrary) posture = "OPEN - arbitrary egress is permitted";
  else if (build.length) posture = "ALLOWLISTED - the build-necessary set is reachable, unrelated hosts are not";
  else if (model) posture = "MODEL-ONLY - only the model API is reachable";
  else if (nodata) posture = "DNS-ONLY - the resolver answers but no HTTP egress";
  else posture = "ISOLATED - nothing reachable";

  console.log("");
  console.log("VERDICT: " + posture);
  console.log("  build-necessary reachable: " + (build.join(", ") || "none"));
  console.log("  raw IP reachable         : " + ip.ok);
  console.log("  DNS resolver reachable   : " + nodata);
  console.log("");
  console.log("IMPLICATIONS");
  if (arbitrary) {
    console.log("  OPEN means the containment boundary is the NETWORK, not a policy. Every");
    console.log("  endpoint that accepts an unauthenticated write is an exfil channel, and so");
    console.log("  is every endpoint you hold a token for. The list of permitted hosts is not");
    console.log("  the attack surface - the ability to reach anything is.");
  } else if (build.length) {
    console.log("  ALLOWLISTED is the Hugging Face shape: the sandbox can reach exactly what a");
    console.log("  build needs, and that set is small and known. One endpoint in it that");
    console.log("  accepts a write is sufficient - RubyGems took 2,000 packages that way.");
  } else {
    console.log("  With no general egress, the channel question collapses to DNS.");
  }
  if (nodata) {
    console.log("  DNS RESOLVES, which is the finding that outranks everything above: if names");
    console.log("  resolve, a resolver query is an outbound channel regardless of the HTTP");
    console.log("  allowlist. A hostname policy cannot close it - only an off-box resolver can.");
  }
  console.log("");
  console.log("NEXT - and this is the only part that needs anything from you:");
  console.log("  Reachability != writability. To test the WRITE path you need a destination");
  console.log("  YOU own (your own webhook catcher, your own repo, your own bucket). ONE is");
  console.log("  enough, and it is the decisive test: it separates 'arbitrary egress' from");
  console.log("  'allowlisted', which no list of public hosts can do. Do not use a service");
  console.log("  you do not own - that is writing into someone else's infrastructure.");
})();
