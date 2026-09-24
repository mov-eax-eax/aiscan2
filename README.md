# The ntfy namespace: a read-only study of a public notification bus

**Status: RETIRED 2026-09-15.** No network tooling here is run any more. `ntfy.sh`
is not contacted again, and the probing tools are kept as a *record of method*, not
as a working set. The offline analyzers over `data/` remain live and runnable.

> **[Read the findings →](index.html)** — a single self-contained page. Works offline:
> open it from disk, no server or network required.

---

Between 2026 and 2026-09-15 this project explored the public `ntfy.sh` namespace
**read-only**, under the service's real rate limits, around one question:

> When an agent framework sends a notification, where does it send it, and what
> does that leak?

The answer turned out to be structural rather than a hunt for secrets.

## What was actually found

**The agent namespace is not hidden, it is *thin*.** Every mainstream agent notifier
we read generates a random 128-bit topic by default and tells the user the topic name
*is* the password. Exposed traffic is therefore the **error rate of a privacy-correct
default** — the population of users who replaced that random string with something
memorable (`test`, `ai`, `llm`, `hermes`, `opencode-notifications`). It is small by
construction, which is why wide name sweeps return almost nothing.

**Reserved names are a derivation engine.** When the obvious name is taken by the
service (`claude`, `codex`, `home`), users do not fall back to randomness — they
*derive*, predictably: `claude` → `claude-code` + `claude-notifications`,
`codex` → `codex1`, `home` → `myhome`. Four of the largest channels in the corpus sit
exactly one step from a reserved name. That makes candidate generation mechanical
rather than a guess. See `docs/FINDINGS.md`, "THE DERIVATION GENERATOR".

**Cross-protocol collision is real but narrow.** `https://ntfy.sh/mcp` is simultaneously
a valid ntfy *publish* endpoint, so an internet MCP census scanner probing for
`https://<host>/mcp` wrote its JSON-RPC handshake into a public notification topic. The
footprint is a single point, and 29 sibling protocol paths were all free — so this is a
property of one plausible name, not of the namespace. See `docs/CENSUS.md`.

**A clean negative, reported as loudly as a positive:** 1,221 archived messages
contain **no API keys, no private keys, no webhook URLs, no bearer tokens and no
password fields.** The exposure here is operational context, not credentials.

**The most expensive bug was an error-classification bug.** A reserved-name `403`
and a rate-limit `429` demand *opposite* responses — isolate vs. wait — and code that
lumped them together produced an infinite retry loop and a fabricated "escalating
penalty" theory that had to be retracted. The lesson is recorded in `AGENTS.md` §5
because it generalises: **an HTTP status is not an error class; parse the body.**
The project ended when sustained throttling escalated to a host-level IP block.

## Repository layout

| path | what it is |
|------|------------|
| `src/` | all runnable code — collector, detectors, offline analyzers, CLI tools |
| `tools/` | ad-hoc exploratory scripts, kept as a record of method (not maintained) |
| `docs/` | the findings and write-ups |
| `data/` | the accumulated product: state, archives, derived JSON |
| `experiments/` | E1 / E2 / E8, with their recorded results |
| `scripts/` | launcher |
| `AGENTS.md` | **the method** — protocol, failure modes, and what was closed. Read this first. |

There are **zero third-party dependencies** — Node builtins only (`fs`, `path`,
`crypto`, `http`, `dns`, `fetch`).

## Running it

Only the offline analyzers are live. They read `data/archive/*.jsonl` and never
touch the network. **Run them from the repository root.**

```sh
node src/structure.js          # structural / covert-channel profile -> data/structure.json
node src/voice-rank.js         # verify the voice-density re-rank
node src/derive-candidates.js  # derivation avenue -> data/derive-candidates.json, RANKED
node src/archive-manifest.js   # inventory -> data/ARCHIVE.json
node src/share.js info         # state of the signed-findings channel (reads disk only)
```

Or `npm run structure`, `npm run derive`, and so on.

### What these detect

`src/signals.js` is the detection engine — a data-driven rule table (census-scanner,
mcp-client, json-rpc, agent-gateway, siem, heartbeat, credential) plus a `voice`
score. `src/structure.js` is deliberately **content-blind**: it measures shape —
inter-arrival timing, modal period, message-length variance, field-presence rates,
JSON key-set stability — because a covert channel that evades content monitoring has
to leak through structure instead. It also recovers agent think-time from UUIDv7
identifiers in payloads, with no content read at all.

### The two retired network tools worth understanding

`src/collector.js` owned **every** network call behind a single throttle gate, with a
thin browser frontend that only read `/api/state` and `/api/events` — so a closed tab
could never lose work or re-spend the rate budget. `src/probe.js` is kept as a record
of the 403/429 failure mode described above. Neither is to be run.

## A note on the limits model

The economics are the interesting part, and they were verified against ntfy's server
source rather than guessed: batching 25 topics costs **one** request token, so breadth
is nearly free in request tokens, while *new* names cost one creation token each after
a 100-name burst (then 1/minute). Bandwidth is dominated by one or two fat topics, not
by breadth. Discovery and refresh therefore have opposite cost profiles and needed
different pacing. Full model in `AGENTS.md` §3–§4.

## Data notice

> `data/` contains **real third-party notification traffic** captured read-only from
> the public ntfy.sh cache on 2026-09-15. See `docs/DATA-NOTICE.md` before reusing or
> republishing any of it.

## Ethics

The project was read-only throughout. It never published into a topic it did not
create, and it declined an explicit "reply if you got this" invitation, because a
public cache is not a contact channel. Probes were chosen for side effects we would
defend: polling an unknown name *creates* it. The rules are in `AGENTS.md` §10.

## License

MIT — see `LICENSE`.
