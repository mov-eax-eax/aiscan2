# The ntfy namespace: a read-only study of a public notification bus

**Status: RETIRED 2026-09-15.** No network tooling here is run any more. `ntfy.sh`
is not contacted again, and the probing tools are kept as a *record of method*, not
as a working set. The offline analyzers over `data/` remain live and runnable.

> **[Read the findings →](index.html)** — the same material as a styled,
> self-contained page. Works offline: open it from disk, no server or network needed.

---

Between early 2026 and 15 September 2026 this project explored the public `ntfy.sh`
namespace **read-only**, under the service's real rate limits, around one question:

> When an agent framework sends a notification, where does it send it, and what
> does that leak?

The answer turned out to be structural rather than a hunt for secrets.

---

## The census collision — the signature result

Every public namespace is addressed by name: a topic, a bucket, a queue, a route.
So is every HTTP endpoint. **Where those two naming schemes collide, you silently
collect other people's traffic.**

Topic `mcp` holds exactly one message, and it is not from a user of ntfy at all:

```json
{"jsonrpc":"2.0","id":6075992,"method":"initialize","params":{
  "protocolVersion":"2025-06-18",
  "capabilities":{"sampling":{},"elicitation":{},"roots":{"listChanged":true}},
  "clientInfo":{"name":"internet-census-mcp-scanner","version":"1.0.0"}}}
```

Every field is a self-description. The client *names itself* a census scanner, and
`6075992` is its probe counter across an internet-wide sweep — the 6,075,992nd
request of its run.

**The mechanism.** ntfy addresses topics as `/<topic>`. MCP's conventional endpoint
is `/mcp`. So `https://ntfy.sh/mcp` is simultaneously a valid ntfy **publish**
endpoint. An internet scanner walking hosts and POSTing an MCP handshake had that
handshake accepted and stored as an ordinary notification. It wrote into the very
namespace it was probing, without knowing ntfy existed — not a peer, not a bot, not
an agent, but a scanner of a *different protocol* hitting a URL that looks like an
endpoint it recognises.

Two real tools produced it: [`m-q-t/mcp-server-scanner`](https://github.com/m-q-t/mcp-server-scanner)
(the Go scanner that walked past) and [`jpetrucciani/ntfy-mcp`](https://github.com/jpetrucciani/ntfy-mcp)
(a Rust MCP server whose Streamable-HTTP transport is at `/mcp`, which is why the
path is plausible enough to probe).

**A new category: probe crossfire.** Traffic arriving at a service from something
that is not a client of that service at all, because two naming schemes agree on a
string. Nothing is misconfigured. The collision is inherent to both designs.

**The frozen clock.** The request id `6075992` never advanced — same id, same
timestamp, hours apart. One probe, never repeated. It is the only real clock the
project ever had on an external actor.

**Footprint: a single point, and that is the finding.** All 13 sibling MCP paths came
back empty (`sse` `jsonrpc` `rpc` `mcp-server` `mcp-sse` `mcp-http`
`modelcontextprotocol` `initialize` `tools` `streamablehttp` `mcpserver` `mcpclient`
`census`), as did 29 generic protocol paths (`graphql` `api` `v1` `health` `metrics`
`admin` `webhook` `env` `config` …). **The negative is the result.** The collision is
*narrow*, not a general property of the namespace: it requires a scanner-probed path
that is *also* a plausible human-chosen topic name. `mcp` qualifies because it is
short and guessable; `healthz` and `actuator` do not, because no human names a
notification topic that. Avenue closed for ~42 created names.

> ⚠️ **A false positive not to count.** The sibling sweep flagged `messages` with one
> message — but its content is `"No rain detected today."`, a weather notification.
> Despite `messages` being the MCP SSE transport path, this is **not** a collision.

**Why it generalises.** Not an ntfy bug and not an MCP bug. Any service addressing
resources by a flat single-segment path is exposed: notification buses, blob stores,
message queues, pastebins. The detector is portable — *probe the paths a scanner
would, and see whether the service answers with its own semantics to a protocol it
does not speak.*

**Independent confirmation.** A paper submitted three days before this project's final
session reports the same exposure at internet scale — arXiv:[2609.14119](https://arxiv.org/abs/2609.14119),
*"Same Name, Different Server: A Security Census of Silent Drift in the Model Context
Protocol Ecosystem"* (Kraishan, 12 Sep 2026). Every figure in `docs/CENSUS.md` matches
its abstract: 21,643 servers / 72,606 version records harvested, 14,353 sources
scanned, **9.57% showing unauthenticated network exposure**, 51.1% of multi-version
servers changed what they advertise, 40.6% silently, 4.2% redirected their endpoint
while keeping registry identity, and silent drift associated with OR 2.96
(95% CI 2.56–3.42) for a high-severity finding.

Its definition of a finding is satisfied by a notification server doing nothing wrong:
*"unauthenticated network exposure" is exactly what an ntfy topic does when it
collides with `/mcp` — it answers, unauthenticated, to a protocol it does not speak.*

**The reflexivity.** This project was doing to ntfy's namespace exactly what the
census scanner does to the internet: sweeping a public namespace, announcing itself
in a user-agent, and leaving probes behind in places anyone can read.

> It found us the same way we found it — by probing the obvious name. Neither of us
> chose a hidden channel. The public commons is where these probes land.

And the symmetry has a cost side: this project **created ~150 topics** as a side
effect of probing — the identical category error it criticises.

> ⚠️ **The verification trap.** The collision cannot be confirmed by publishing into
> `mcp` — that would add to the collision and manufacture the artifact being
> measured. The finding is permanently observational: one frozen self-describing
> record plus a negative sweep. That is a real epistemic limit, recorded rather than
> papered over.

---

## In one line

The namespace holds **almost no agents doing interesting things**, and a great deal
of ordinary people leaking their infrastructure through a channel nobody classified
as a data store.

> The exposed population is not a hidden network. It is the **error rate of a
> privacy-correct default**.

Every mainstream agent notifier generates a random 128-bit topic and tells the user
the topic name *is* the password. The only topics we can find are ones where a human
overrode that default with something memorable — `test`, `ai`, `llm`, `codex`,
`cursor`. The population is small by construction.

## The corpus

| measure | value |
|---|---|
| topics | **27** (1,221 messages, 397 KB) |
| live discoveries | **25** from a 14,697-name candidate list |
| throttle responses | **257** — the warning we kept working through |
| collector restarts | 24 |
| forced cool-offs | 2 |
| reserved names hit | 5 — `claude` `home` `inbox` `me` `private` |
| messages published | **0** |

Reserved names are claimed and locked by the service (HTTP 403, code 40301). They
turned out to be the most productive lead in the project, not a dead end.

## Agent sessions

| topic | msgs | what it actually is |
|---|---:|---|
| `claude-code` | 214 | **5 distinct sessions** colliding on one name — five independent installs that all chose the same obvious topic |
| `claude-notifications` | 94 | project names and **subagent** lifecycle events |
| `codex1` | 88 | per-call **token accounting** plus a cumulative daily counter |
| `cursor` | 52 | 52 × `"Cursor fertig"` — one distinct message |
| `codex` | 30 | **6 threads**, every message carrying `Thread:` + `Turn:` UUIDv7 ids |
| `opencode-notifications` | 15 | 15 × `"Task completed"` — one distinct message |

`claude-code` matters most. It is not one session: five ids (`333c36b4`, `4c8796ce`,
`627afe3b`, `73fa06ef`, `f443bead`) across 214 messages, and it carries an agent
*asking its human a question* — an interactive turn, not a status ping:

```
Session 627afe3b asks: How should the AI label read on replies the bot writes with AI?
Session 627afe3b: AskUserQuestion → N/A
```

It also leaks a macOS username, a project name, a homegrown hook directory
(`.claude/overseer/AUTH_EXPIRED`), auth state, and a remote-desktop link attached to
every completion.

> **Honest caveat.** Four of those six are one-line status pings. We hold the
> **notification edge of sessions, not transcripts** — no prompts, no responses, no
> diffs. The one exception is that leaked `AskUserQuestion`.

The single confirmed *conversation* (`hello`, score 1.0) is **not** an agent — it is a
playful exchange between strangers ("Oh wow a cat" / "Yeah. Meow.").

## The most serious finding

Topic `alerts` — 16 messages, a domestic German home-automation channel (Airthings
humidity, a battery, FinTS banking, push-budget alarms). Inside it:

- **A 12-word BIP39 recovery phrase**, posted as an untitled message. The only
  artifact in the corpus with the shape of a real credential. **Deliberately not
  reproduced** — in this file, on the findings page, or anywhere else.
- **An SSH login record** — an account name and an RFC1918 private address.
- **A complete AWS certificate-rotation runbook** — a service −480h behind, a systemd
  unit, a CT id, a health-check path, a named break-glass admin, and a plain statement
  that once the parent certificate lapses *there is no self-recovery*.
- **An invitation to reply** — `"Test from Alfred — ntfy skill works. Reply if you got
  this."` An agent testing a notification skill. **We never replied.**

## Misconfiguration at scale

| topic | class | what is exposed |
|---|---|---|
| `prompt` | ops | 144 msgs — a **Wazuh SIEM** alert stream on a name that reads like a prompt-injection target |
| `camera` | iot | 101 msgs from a camera bridge — a true 120-second metronome |
| `myhome` | misconfig | a **public university's** Grafana/Alertmanager on a public topic: internal hostnames, folder names, TLS certificate detail. Uptime-check title is literally `"dddddd"` |
| `notify` | misconfig | a production service publishing its hostname, a public IP, release tags and an internal issue-tracker URL |
| `test` | noise | 362 msgs from **37+ unrelated producers** — the base-rate topic |

## Structure, not text

The structural detector is deliberately **content-blind**: it measures shape —
inter-arrival timing, modal period, message-length variance, field-presence rates,
JSON key-set stability — on the reasoning that a covert channel evading content
monitoring has to leak through structure instead.

Its strongest capability was recovering **agent think-time from identifiers alone**.
Because UUIDv7 embeds a timestamp, per-turn duration was reconstructed with no message
text read at all: median turn **398.2s**, range 0.1s – 15,725.7s.

It cleanly separated the two extremes, which is how we know it works:

| topic | regularity | reading |
|---|---:|---|
| `camera` | 0.995 | a true metronome — 120s period, timing CV 0.01 |
| `claude-code` | 0.018 | four-plus independent humans |

The interesting middle is machine-templated but not periodic: `cursor` and
`opencode-notifications` each emit a *single* distinct message length.

## Negative results

Reported as loudly as the positives, because a closed avenue stops future spend.

- **Vendor namespace barren.** 36 harness names probed: 33 free, 2 reserved, 1
  occupied. All 13 harness *event* names (`needs-input`, `approval`,
  `task-complete` …) free.
- **Producer index: a base rate, not a network.** 20 of 25 topics are singletons with
  no cross-topic linkage. The pairs that appear are vendor defaults — e.g. two
  strangers following ntfy's own onboarding tutorial.
- **No API keys, private keys, webhook URLs, bearer tokens or password fields.** The
  BIP39 phrase is the single exception.
- **Zero `sequence_id`.**

> ⚠️ **Correction owed.** The method notes still assert the corpus is *"consumer/ops
> appliances, not agent frameworks."* That was drawn from a 535-message corpus. At
> 1,221 messages the project holds **5 agent notifier channels and 11 distinct
> sessions/threads**. That conclusion is stale and should be corrected.

## The limits model

Verified against ntfy's server source rather than guessed.

| limit | value |
|---|---|
| request token | 1 per HTTP request — a batch of **25 topics is still ONE token** |
| new-topic token | 100 burst, then **1 per minute** — the real ceiling on breadth |
| subscription cap | 30 topics per request, so batches stay at 25 |
| poll bandwidth | 500 MB/day, shared with attachments |
| cache duration | 12h — results are a *window*, never history |

The consequence is counter-intuitive: **breadth is nearly free, and bytes are the
real budget**. A 25-topic batch cost 185,284 B in one token; a single topic cost
644 B. Cost is dominated by *which* topics you carry, not how many — a 5-topic batch
cost **240×** a 1-topic batch purely from its contents. Discovery and refresh
therefore have opposite cost profiles and need different pacing.

The pacing number was measured directly: **two minutes of complete silence restores
service**. Any retry shorter than that is provably wasted, and a short retry loop is
itself what keeps the budget drained.

---

# The pipeline

The engineering is a deliberate split: **one process owns every network call**, and
nothing else is allowed to touch the network at all.

```
 ntfy.sh  <--- HTTP --->  src/collector.js  <--- HTTP/SSE --->  src/ui.html + ui.js
                          owns ALL traffic,                    read-only view,
                          throttling, disk                     reconnectable
```

Why: an earlier single-file version polled from the browser, which made the tab the
source of truth. Close it and everything learned was gone; every reload re-spent the
rate budget. Now collection is a durable process that keeps working with no browser
open.

### Components

| file | role |
|---|---|
| `src/topics.js` | candidate generator — 14,697 deterministic names, priority-ordered. UMD, so Node and the browser share **one** implementation. |
| `src/collector.js` | the service: two loops, one throttle gate, error classification, persistence, HTTP API. |
| `src/signals.js` | detection engine — a data-driven rule table, shared by collector and browser. |
| `src/ui.html` `ui.css` `ui.js` | thin frontend served by the collector. Never contacts ntfy; reads `/api/state` and subscribes to `/api/events`. |
| `src/scan.js` | one-shot CLI over the same engine, for a single bounded run. |
| `src/reserved-scan.js` | reserved-name sweep, checkpoints after every batch. |
| `src/retrieve.js` | single-shot retrieval — one HTTP call, no retry, no loop. Deliberately shaped so one request cannot become a storm. |
| `src/share.js` | signed findings publisher/consumer, for our own topic only. Never used. |
| `src/structure.js` `voice-rank.js` `derive-candidates.js` `archive-manifest.js` `producers.js` | **the offline analyzers — the only live code.** No network. |

### Two loops, one gate

- **Discovery** walks the generated candidates in priority order, advancing a cursor
  persisted to disk. Batches of 25. Resumable across restarts.
- **Refresh** re-polls known-live topics, cheapest-first, appending new messages to
  `data/archive/<topic>.jsonl`.

Both share a **single throttle gate** — when either loop is told to back off, both
wait. That stops the two from defeating each other's pacing.

Refresh intervals are **cost-scaled**:

```js
base * (1 + bytes / 5000) * kindFactor      // capped at 6h
```

so a 50 KB topic is not replayed as often as a 200-byte one. A separate
`maxRefreshPerHour` cap bounds total refresh spend.

### Error classification — the rule the project learned the hard way

**An HTTP status is not an error class.** The body code is.

| observed | meaning | response |
|---|---|---|
| `403` + code `40301` | reserved — **permanent**, a property of the *name* | isolate the name, continue |
| `429` + `42901/42903/42904/42905` | throttle — **transient** | gate and wait |
| `200` + empty body | dead | mark dead |
| anything else | unknown | treat as transient, keep the topic |

Conflating the first two cost the project weeks: code matching
`status === 429 || status === 403` hit a reserved name, called it a throttle, slept,
retried the same batch, escalated the sleep, and never advanced a single topic. The
escalating waits were then written up as a "progressive penalty" — a theory that had
to be publicly retracted.

### The poison pill

A multi-topic subscription fails **as a whole** with `40301` if *any* one topic is
reserved. So on a forbidden response, `pollResolving()` **halves the batch
recursively** until the reserved name is isolated, marks it, banks everything else,
and moves on. Without this, one reserved topic stalls a scan forever.

### Persistence and checkpointing

- `data/state.json` — cursor, per-topic results, counters, log. Written **atomically**
  (`.tmp` then `rename`), debounced at 1.5s and forced every 10s. An interrupted run
  loses at most one batch.
- `data/archive/<topic>.jsonl` — full untruncated messages, append-only.
- `data/hits.jsonl` — append-only record of newly discovered live topics.
- `SIGINT`/`SIGTERM` save before exit.

### Detection engine

`signals.js` is data-driven so new categories are cheap to add. It extracts publisher
**self-descriptions** the sender did not know it was revealing — `title`, `tags`,
`priority`, `click`, `actions`, `attachment` — plus publisher **signatures**
(census-scanner, mcp-client, json-rpc, agent-gateway, siem, heartbeat, credential),
**voice density** (expressive ÷ total, weighted by sample confidence), **structure**,
**conversation**, and a combined **agent score**.

Detection and ranking are kept decoupled: a rule that fires is not a rule that should
rank first.

### Analysis versioning

`ANALYSIS_VERSION` in `collector.js` must be bumped whenever any detector changes.
Entries carrying an older version are re-polled at full width on boot. Without it a
new detector silently applies only to newly-seen topics and the UI shows blanks —
which happened **four times** (voice, voiceDensity, structure, conversation), showing
up as a lead card with an empty field.

### HTTP API

| method | path | purpose |
|---|---|---|
| GET | `/` | the UI |
| GET | `/api/state` | progress, counters, recent hits, log |
| GET | `/api/live?kind=&q=` | live topics, filterable |
| GET | `/api/categories` | category / vendor / producer / reserved / structural counts |
| GET | `/api/anomalies` | ranked anomalies |
| GET | `/api/promising` | ranked leads |
| GET | `/api/topics` `/api/topic?name=` | archived topic list and detail |
| GET | `/api/events` | SSE: progress, live, throttle, log |
| GET | `/api/export` | JSON snapshot of everything collected |
| POST | `/api/config` | `{discovery,batch,maxTopics,refreshMinutes,resetCursor}` |
| POST | `/api/probe-batch` | `{topics:[…]}` → occupancy per topic |
| POST | `/api/publish` | `{topic,message,title?,tags?}` |
| POST | `/api/reset` | `{confirm:true}` wipes collected state |

### Running it offline

The collector has a genuine no-network mode, used to render the UI from the archive
after retirement:

```sh
DISCOVERY=false REFRESH_MINUTES=0 PORT=8787 node src/collector.js
```

Both loops go inert, so it serves the on-disk corpus with **zero ntfy requests**.

---

## Where it went wrong

The most expensive bug was not in the analysis — it was classifying errors by HTTP
status instead of body code (see *Error classification* above).

**The ending.** 257 rate-limit responses preceded the hard block. At ~19:25 the API
host stopped accepting connections entirely — not DNS, not the network, not an ntfy
outage, but a firewall `DROP`, which produces a *timeout* with no status code at all
and so fell silently through every error branch that had been written. That is why
the tooling is retired.

## The thesis: actionability is compositional

Ask what is "actionable" in a leak and almost everyone answers the same way: a bearer
token, an API key, a password — something you can paste into a terminal and win with.
**That model is wrong, and this corpus is the counter-example.**

The fragments found here have no entropy, no vendor prefix, no structural marker.
Every DLP rule ever written is tuned to `sk-`, `AKIA`, `ghp_`, `xox`, `Bearer` and
`-----BEGIN`. None of these match — because **none of them is a secret. They are
facts.** A username. A directory name. A truncated private address. A tailnet name.
A working-hour pattern.

Assembled per person they become a targeting package: identity, infrastructure,
environment, timing, posture, intent.

- A **credential** is *event*-shaped. Leaked once, it is bad once. Rotated in five
  minutes, incident closed. High drama, low persistence.
- An **identity + infrastructure + schedule profile** is *state*-shaped. It **cannot
  be rotated at all.** You cannot change your username, un-build a project, or rename
  a tailnet without breaking every service attached to it.

**The DLP blind spot.** Every fragment arrived through *notification metadata* — not a
database, not a log store, not a file share. That is precisely the category most
organisations exclude from data-loss tooling, on the reasoning that a notification is
a transient signal. But a 12h cache makes it a store, the topic name makes it an
address, and the body is written by a tool with no reason to be careful.

**The rule:** a topic name on a public server is a *billboard*, not a *mailbox*. Put
nothing on it you would not want indexed. The defensible use was the one genuine
case — `hello`, where two strangers opted into a public space and found each other.
Everything else was a private notification delivered through a public medium: a
category error, not a mistake.

## Ethics and disclosure

- **Read-only throughout.** Nothing was ever published into a topic this project did
  not create.
- **No interaction** with any agent or person; the explicit "reply if you got this"
  invitation was declined.
- **No credential or seed was used, verified, or moved.** On that finding the correct
  action is disclosure — and there is no non-invasive channel to disclose through.
  That absence is itself a finding.
- **Personal detail is aggregated, not amplified** beyond the minimum needed to
  evidence the failure.
- **~150 topics were created** as a side effect of probing — the same category error
  this project criticises, recorded rather than excused.
- **204 of 234 ranked derivation candidates were never probed**, and never will be.

## Repository layout

| path | what it is |
|---|---|
| `index.html` | the findings as a self-contained offline page |
| `AGENTS.md` | **the method** — protocol, failure modes, what was closed. Read this first. |
| `docs/FINDINGS.md` | the full analysis, including the closing thesis |
| `docs/CENSUS.md` | the MCP collision, explained |
| `docs/INCIDENTS.md` | 2026 agent escapes, for context |
| `docs/SERVICE-TRIAGE.md` | classify a service instead of sweeping it |
| `docs/ARCHIVE.md` | final state of the exploration |
| `docs/DATA-NOTICE.md` | provenance and sensitivity of the captured corpus |
| `src/` | all runnable code |
| `tools/` | ad-hoc exploratory scripts, kept as a record of method |
| `data/` | the accumulated product: state, archives, derived JSON |
| `experiments/` | E1 / E2 / E8 with their recorded results |
| `scripts/` | launcher |

## Running the analyzers

Offline, no network, from the repository root. These are the only live commands:

```sh
node src/structure.js          # structural / covert-channel profile -> data/structure.json
node src/voice-rank.js         # verify the voice-density re-rank
node src/derive-candidates.js  # derivation avenue -> data/derive-candidates.json, RANKED
node src/archive-manifest.js   # inventory -> data/ARCHIVE.json
node src/producers.js          # producer-prefix index
node src/share.js info         # signed-findings channel state (reads disk only)
```

Or `npm run structure`, `npm run derive`, and so on. **Zero third-party
dependencies** — Node builtins only.

Everything else under `src/` is **retired network tooling**. Do not run it.

## Data notice

> `data/` contains **real third-party notification traffic** captured read-only from
> the public ntfy.sh cache on 2026-09-15. See [`docs/DATA-NOTICE.md`](docs/DATA-NOTICE.md)
> before reusing or republishing any of it.

## License

MIT — see [`LICENSE`](LICENSE).
