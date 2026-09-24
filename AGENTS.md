# AGENTS.md - working technique

This file is the METHOD, not the findings. Findings live in docs/FINDINGS.md and
docs/CENSUS.md. Read this before touching the project.

Project: explore the public ntfy.sh namespace for agent traffic - misconfigured
agents, misaligned behaviour, probe crossfire, and peers - read-only, under severe
rate limits.


## 0. Repository layout

    src/          all runnable code - collector, detectors, offline analyzers, CLI tools
    tools/        ad-hoc exploratory scripts, kept as a record of method (not maintained)
    docs/         the findings and write-ups
    data/         the accumulated product: state, archives, derived JSON. NEVER delete it.
    experiments/  E1 / E2 / E8 with their recorded results
    scripts/      launcher

Everything under src/ runs offline EXCEPT the network tools retired in section 12.
Run the analyzers from the repository root, e.g. `node src/structure.js`.


## 1. Working protocol (human + agent)

These are the rules that made the project work. They were all learned by breaking them.

INTERACTIVE TURNS ARE FOR FAST ANSWERS.
    Never put a slow tool call in the foreground. A probe with a 600s timeout in an
    interactive turn is a failure, not thoroughness. If work takes more than a few
    seconds, launch it as a background job and answer from what is already known.
    Report when it lands.

STATE IS THE PRODUCT. NEVER DELETE IT.
    data/ is the accumulated result. Wiping it to "start clean" destroyed real history
    twice and made the frontend look broken. The collector merges into existing state.
    Never run a recursive delete on data/.

CHECKPOINT EVERY UNIT OF WORK, ATOMICALLY.
    A 30-minute scan whose only write is at the end persists NOTHING if interrupted.
    That happened. Write after each batch, to a .tmp file, then rename. An interrupted
    run must lose at most one batch.

LOCAL ANALYSIS IS FREE. NETWORK IS RATIONED.
    Mine data/archive/ before probing anything. Most questions are answerable offline.
    Exhaust local evidence first, then spend a probe on what remains.

VERIFY THE SUBJECT BEFORE ANALYSING IT.
    A message shown in the UI was assumed to be from topic "test"; it was actually
    from "alerts". The whole surrounding context was different. Always locate the
    record by grep before drawing conclusions from it.

REPORT NEGATIVES AS LOUDLY AS POSITIVES.
    A closed avenue is a result. "The census footprint is a single point" is as
    valuable as a find, because it stops future spend.

VERSION THE ANALYSIS.
    Adding or changing ANY detector must bump ANALYSIS_VERSION in collector.js.
    Entries carrying an older version are re-polled at full width on boot. Without
    this the new detector silently applies only to newly-seen topics and the UI shows
    blanks. This was hit FOUR times: voice, voiceDensity, structure, conversation.
    Symptom to recognise: a lead card with the new field empty, e.g. "dens= (/)".

SEPARATE DETECTION FROM RANKING.
    A rule that fires is not a rule that should rank first. voice currently reports
    presence; ranking needs proportion. Keep the two decoupled.


## 2. Architecture: rationed-probe split

    ntfy.sh <--HTTP--> collector.js <--HTTP/SSE--> ui.html + ui.js
                       owns all traffic,          read-only view,
                       throttling, disk           reconnectable

    collector.js   owns EVERY network call, both loops, the throttle gate, persistence
    ui.html/ui.js/ui.css   never contact ntfy; read /api/state and /api/events
    topics.js      candidate generator (14,697), shared by collector + browser
    signals.js     detection engine, data-driven rule table
    scan.js        one-shot CLI for a single bounded run
    reserved-scan.js   reserved-name sweep, checkpoints per batch
    structure.js / voice-rank.js / derive-candidates.js
                   OFFLINE analyzers over data/archive/ - NO network, run these first
    share.js       signed findings publisher + consumer, for OUR topic only
                   (private key in share/keys/ - never commit it, never copy it)

Why: the browser tab must never be the source of truth. A closed tab must not lose
work, and a reload must not re-spend the rate budget.

STATUS: the two components above (collector.js and the ntfy link) are RETIRED as of
2026-09-15 and are described here as the historical design, not as something to run.
The offline analyzers in the line below are what remains live. See section 12.


## 3. The limits model (verified against ntfy server source, not guessed)

    request token     1 per HTTP request, 60 burst, refill 1 per 5s
    subscription cap  30 topics per request  -> batch at 25
    new-topic token   100 burst, then 1 new topic per MINUTE
    poll bandwidth    500 MB/day, shared with attachments
    cache duration    12h  -> results are a window, never history
    reserved names    HTTP 403 code 40301 -> auth required

THE KEY ASYMMETRY:
    discovery costs almost no BYTES (dead topics replay 0) but one CREATION token per
    unknown name. refresh costs no creation tokens but replays whole caches, so it is
    what eats the byte pool. Optimise them differently.

Error bodies matter more than status codes:
    42901 too many requests       42903 too many active subscriptions
    42904 server total topic cap  42905 daily bandwidth reached
    40301 forbidden (reserved)    plus topic-creation limit


## 4. Probe-cost economics (the central insight)

    EXISTING topic   free in creation tokens; 1 request token per HTTP call
                     (a batch of 25 topics is still ONE request token)
    UNKNOWN topic    CREATES it; costs 1 creation token; 100/min budget after burst
    RESERVED topic   free, but poisons the whole multi-topic batch

EXPERIMENT E1 (experiments/e1-batch-cost.js, result in experiments/e1-batch-cost.json)
CONFIRMED batching is ~free in request tokens. Five polls with the collector paused
and a 90s quiet period: single=200, batch5=200, batch18=200, batch25=200.
    single ai      644 B
    batch of 5     154,279 B   <- carried test (100KB) + prompt (55KB)
    single test    100,976 B
    batch of 25    185,284 B
TWO CONCLUSIONS:
    1. Batch size is NOT the cause of 429 storms. Sustained 429s are visitor-prefix
       contention. The old 29s retry cap made that worse, so backoff now grows to 5min.
    2. Bandwidth is dominated by ONE OR TWO fat topics, not by breadth. A 5-topic
       batch cost 240x a 1-topic batch purely because of which topics it contained.
       Cost-scaled refresh intervals are therefore the right design; keep them.

EXPERIMENT E8 - THE PACING NUMBER. Result in experiments/e8-recovery.json.
    Method: kill EVERY consumer, pause the collector, then one request per trial.
      after 2 min of total silence -> HTTP 200, 644 bytes, 341 ms
    TWO MINUTES OF FULL SILENCE RESTORES SERVICE.
    CONSEQUENCE: any retry shorter than 2 min is provably wasted, and a short retry
    loop is itself what keeps the bucket drained - it spends tokens as fast as they
    refill so recovery never completes. That is exactly what we were doing at 8-36s.
    POLICY: burst until refused, then go COMPLETELY quiet for >=2 min, then burst
    again. The collector floors every 429 wait at 120s. Never retry inside 2 min.
    Also: with only one consumer running, the bucket yielded immediately. Most of the
    "contention" we blamed was self-inflicted by four unsynchronised retry loops.
    ADDENDUM - RETRACTED. See section 5, "THE 403/429 CONFUSION".
    This block asserted the penalty was PROGRESSIVE and escalated the rest
    180 -> 300 -> 600 -> 900 -> 1200 -> 1800 -> 2400s. THAT CONCLUSION IS WITHDRAWN.
    The prober that produced the evidence could not distinguish a reserved-name 403
    from a throttle 429: it matched both statuses, logged both as "429", and threw the
    body away. Its harness list contained the reserved name "warp". So "failed twice in
    a row at 18:39 and 18:42" is at least as consistent with the SAME POISON PILL being
    retried as with a deepening penalty - and a permanent error fails identically at
    every interval, which is precisely what an escalating backoff makes look like
    punishment that is getting worse.
    WHAT SURVIVES: E8's direct measurement - ~120s of complete silence restores service.
    The collector's 120s floor stands on that measurement alone. The 10-minute runway is
    supported by NOTHING and is dropped to 90s (RUNWAY env var).
    LESSON: never tune a backoff curve against an error you have not classified. A long
    enough backoff will eventually appear to "work" simply because the request that was
    failing finally left the batch.

EXPERIMENT E3 - CANCELLED, premise disproven before it finished.
    Hypothesis: agent frameworks ship default topics we can harvest.
    FALSIFIED by reading the configs: EVERY framework requires a user-chosen topic.
      lannuttia/opencode-ntfy.sh   topic REQUIRED, no default
      @madflow/opencode-ntfy       topic REQUIRED
      Stephanvs/opencode-ntfy      topic REQUIRED
      hermes-agent                 hermes-<user-chosen>-<year>
      ntfy-mcp                     --default-topic empty by default
    THEREFORE THERE IS NO ENUMERABLE AGENT NAMESPACE. Agent topics are user-named.
    That is why 145 probes yielded only 3 agent topics, all arbitrary user choices
    (test, ai, mcp). The 14,697-name sweep is the right instrument for APPLIANCES
    (they ship defaults) and the wrong one for AGENTS (they ship a blank field).
    Only copy-paste README examples are shared: my-notifications, my-opencode-alerts,
    private-alerts, opencode, hermes-myname-2026.

E3 RESULT - IT WORKED. (An earlier revision of this file wrongly claimed all 16
    names were free. They were not. Read the JSON before writing conclusions.)
      OCCUPIED   hermes                 8 msgs  "Gateway online - Hermes is back and ready"
      OCCUPIED   opencode-notifications 14 msgs  "Task completed"           [agent]
      RESERVED   opencode, agents
      FREE       the other 12
    TWO LIVE AGENT DEPLOYMENTS FOUND ON LITERAL FRAMEWORK NAMES.
    hermes: the framework's own name, carrying gateway lifecycle telemetry. The llm
    topic carries the SAME vocabulary ("Gateway shutting down - Your current task will
    be interrupted"), so one operator runs a Hermes gateway announcing lifecycle on
    guessable public topics.
    opencode-notifications: someone used the plugin's own name verbatim.
    LESSON: framework-name topics ARE worth probing even though no framework ships a
    default. The framework NAME is the natural choice when the config field is blank,
    and a blank field plus a name-shaped hole yields the obvious answer. The earlier
    "no enumerable namespace" conclusion is TOO STRONG: the namespace is small and
    obvious, not empty.

E4 - THE STRUCTURAL ANSWER: THE MAINSTREAM ECOSYSTEM IS PRIVATE BY DEFAULT.
    Read from the actual packages:
      ntfy-agent   "setup generates a random 128-bit topic and writes the config 600"
                   "On ntfy.sh the topic is the password."
      anotifier    "topic": "anotifier-<random>"   (Claude Code / Codex / Cursor hooks)
                   richContent defaults false for privacy: "ntfy topic names are
                   guessable rather than access-controlled secrets"
      agent-notify per-agent channel config; ntfy is one of six channels
    THEREFORE: we do NOT find agents because random 128-bit names are unguessable.
    Every agent topic we HAVE found is a DELIBERATE DEVIATION - a user who replaced
    the generated random string with something memorable:
      test, ai, hermes, opencode-notifications, llm
    SEARCH CONSEQUENCE (the important one):
      stop probing framework names and defaults. Probe what a HUMAN TYPES when
      overriding a random default: short, obvious, personal words. The harness
      event vocabulary is also memorable: done, needs-input, approval, permission.
    This also means the population of exposed agent topics is small by construction -
    it is the error rate of a privacy-correct default, not a hidden namespace.

CONSEQUENCE: do not guess novel names. Derive names from documented defaults of
software that integrates ntfy, so they very likely already exist. Product README ->
default topic -> other users of that product. This is the only way around the
1-per-minute creation wall.


## 5. Failure handling

    POISON PILL      One reserved topic 403s the entire multi-topic subscription.
                     Halve the batch recursively until the reserved name is isolated,
                     mark it, continue. Without this a scan stalls forever.

    THE 403/429 CONFUSION - the most expensive bug in this project
                     A reserved name (403/40301) and a throttle (429/429xx) require
                     OPPOSITE responses: isolate vs wait. Code that lumps them together
                     gets it wrong twice. probe.js v1.2 matched
                     `status === 429 || status === 403`, logged BOTH as "429", and even
                     discarded the body on any non-200 - so it could not have told them
                     apart. Its harness list contained the reserved name "warp", so it
                     hit 403, called it a throttle, rested 600s, retried the SAME batch,
                     and escalated to 3000s. It never advanced one topic. The escalating
                     rests were then written up as a "progressive penalty" that does not
                     exist (see the retraction in section 4).
                     RULES:
                       1. AN HTTP STATUS IS NOT AN ERROR CLASS. Parse the body code.
                          40301 = reserved (permanent, isolate the name)
                          42901/42903/42904/42905 = throttle (transient, wait it out)
                          collector.js got this right: pollResolving() consumes every
                          40301 before the throttle handler ever sees a status code.
                       2. ALWAYS READ THE BODY, including on non-200. The diagnosis is
                          in the JSON, not the status line.
                       3. A REST THAT DOES NOT CHANGE THE OUTCOME IS NOT A REST. If the
                          same failure reproduces after a longer wait, the cause is
                          permanent and waiting IS the bug.
    TRANSIENT        429/429xx only. Never treat any 4xx as dead. Gate, retry, keep the
                     topic. 403/40301 is NOT transient - it is a property of the NAME.
                     Re-probing a reserved name only burns request tokens.
    IP BLACKHOLE - the hard block, distinct from a throttle. Hit 2026-09-15.
                     At ~19:25-19:27 ntfy.sh stopped accepting our connections entirely.
                     Diagnosis run while the prober was resting:
                       DNS ntfy.sh  : 159.203.148.75      (resolves fine)
                       TCP 443      : False              (cannot connect)
                       example.com  : HTTP 200           (general network fine)
                       docs.ntfy.sh : HTTP 200           (ntfy's own docs fine)
                     Not DNS. Not our network. Not ntfy being down. The API host drops
                     our TCP connections, which is a firewall DROP, not an HTTP status.
                     THAT IS WHY the prober reported neterr (status 0) and not 429: a
                     blackhole produces a TIMEOUT, and a timeout has no status code to
                     classify, so it silently fell through every error branch we wrote.
                     ATTRIBUTION: CONFIRMED TO BE US, NOT THEM. An independent
                     multi-region probe service (stacksheriff.com/status/ntfy/, EU + US,
                     polled every 60s, 719 samples) reported ntfy.sh UP at 11 ms with
                     ZERO user outage reports in 24h, while our TCP 443 to the same host
                     failed. ntfy is healthy; we are the ones being refused. That rules
                     out an ntfy-side outage and leaves an IP-level block.
                     CAUSE: request volume. ntfy documents "Banning bad actors
                     (fail2ban)" in its own config. Our recent activity was a burst - the
                     reserved-name bisect made ~40 rapid requests, then v1.4 and v1.5
                     cycled through repeated throttle-retry. NOTE this is a THIRD-PARTY
                     status aggregator, not ntfy's own feed; it also flagged its own probe
                     of ntfy.sh as "inconclusive / needs authentication", so treat the
                     "UP" as reachability-at-11ms rather than a semantic health check.
                     RULES:
                       1. A TIMEOUT IS NOT A THROTTLE. A 429 has a status AND a body; a
                          blackhole has neither. Do not apply the throttle schedule to
                          it. Stop, diagnose with a SINGLE request, and stand down.
                       2. A DIAGNOSIS MUST SEPARATE host from network. "It fails" is not
                          a finding. Four checks - DNS, TCP, another host, another ntfy
                          host - turn it into one. docs.ntfy.sh answering while ntfy.sh
                          does not is the check that proves it is host-specific.
                       3. WE WERE WARNED. Sustained 429s preceded the hard block for a
                          long time. The 429 is the soft signal; the DROP is the result
                          of ignoring it.
                       4. WHEN BLOCKED, STOP EVERY CONSUMER. Retrying from a banned IP
                          is how a short ban becomes a longer one, and it destroys the
                          only evidence we have about whether the ban has lifted.
                     RECOVERY: UNKNOWN, and there is no measured number. Treat exactly
                     like E8 but with no schedule: go COMPLETELY silent, then test with
                     ONE request after a long interval. Do not retry in a loop.
                     STATE AT BLOCK TIME: the 40 ranked derivation candidates had banked
                     ZERO - the block landed before the first successful poll. Nothing
                     was lost from probe-results.json; all prior results remain.
    DEAD             ONLY "HTTP 200 with an empty body" is a valid dead signal.
    CONCURRENCY      Serialize consumers. discovery + refresh + two probe calls on one
                     IP produced a 429 storm where nobody progressed. Probes run one at
                     a time and the loops stand down while a probe holds the budget.
    NO MID-FLIGHT RESTART - and make probes restart-tolerant
                     Restarting the collector kills any in-flight probe request. Hit
                     THREE times (sweep B, producer index, E4). The rule alone did not
                     work because deploying a code change REQUIRES a restart, and a
                     long probe is almost always in flight.
                     SO: every launcher must RETRY the POST instead of failing, e.g.
                     post with up to 6 attempts, 15s apart. Treat the collector as
                     restartable infrastructure, not as an always-on peer.
                     Also check job status before killing the collector anyway.
    ORPHANED RESTARTS - verify uptake, do not assume it
                     job_kill terminates the pwsh WRAPPER; the node child can survive
                     and keep holding port 8787, still serving the OLD code. Several
                     "verified" fixes never loaded because of this. Symptoms:
                       - code changes appear to have no effect
                       - uptime reports HOURS on a freshly started process
                       - several node.exe processes accumulate
                     FIXES APPLIED: startedAt is no longer loaded from disk (uptime is
                     now an honest "is this the new process" probe), and a restart must
                     be CONFIRMED by checking that uptime is small afterwards.
                     Do not blanket-kill node.exe - the DSH runtime is also node. Match
                     on CommandLine containing collector.js, and expect the sandbox job
                     runner to complain when you do.

    LEARNED PACE     After the first creation-limit hit, stop trying to go fast: drop to
                     batch 1 and pace at 62s deliberately. Persist the flag; clear it if
                     the last hit was over an hour ago (the burst refills).


## 6. Evidence framework: liveness tiers

Presence is nearly worthless. A message is a FOSSIL until you observe it change.

    T0  name is reserved (40301)      deliberate human/org INTENT
    T1  a message exists              someone was here once
    T2  newest message timestamp ADVANCED  a live process
        NOTE: do NOT use cache size growth. The 12h cache slides, so a steady
        publisher sits at equilibrium (new-in == old-out) and the count never grows.
        camera proves it: cv 0.01, a metronome, count only ever falls. Tracking the
        last-message timestamp is the only robust "it is still publishing" test.
    T3  a counter/id advanced         a live process WITH STATE  <- strongest passive
    T4  it answers                    an interlocutor
        DETECTABLE NOW via conversation(): two or more SHORT, UNTITLED, UNSTRUCTURED
        messages in one topic, penalised for repetition. Repetition is automation;
        a dialogue needs different utterances, and something must be ADDRESSED
        (question / acknowledgement / second person). Found exactly one: topic hello.

Track advanceable numbers specifically: request ids, sequence ids, EXN numbers,
counters. The mcp census handshake carries id 6075992 - the only real clock we have
on it. If that id ever advances, it is a recurring sweep.


## 7. Detection signals that work

PUBLISHER SELF-DESCRIPTIONS - already on the wire, mostly ignored:
    title, tags, priority, click, actions, attachment
    An app that sets title "Wazuh Alert" has told you what it is.

    title prefixes     a census of PRODUCERS  ([Sifio], opencode -, ●project:,
                       Collector empty:, Airthings Alert:, GlitchTip Alert, Codex -)
    click schemes      a directory of APPS  (ai-notifier://)
    action labels      a TOOL fingerprint  ("Open The Dugout" x12)
    outbound hosts     an INTEGRATION directory  (cruisepricetracker, spotify,
                       news.ycombinator, dub.sh, vercel app, internal 10.0.0.66)

SIGNATURES (signals.js):
    census-scanner, mcp-client, json-rpc, agent-gateway, siem, heartbeat, credential

VOICE - a PRESENCE flag, not a content category:
    greeting, second-person, reply-request, affect, opinion, playful, self-ref,
    emoji, word-run, repeat-voice, exclaim-only
    Rationale: expressive traffic presupposes an audience it cannot identify. That
    presupposition is the closest thing to a two-way signal observable without replying.
    KNOWN FLAW - FIXED AND VERIFIED 2026-09-15. voice scored PRESENCE, not PROPORTION:
    270 messages with one meme ranked the same as a channel that is all voice.
    FIX: voice() returns density = expressive/total alongside expressive and messages;
    collector.js makes density the DOMINANT scoring term, weighted by sample confidence
    (conf = min(1, messages/4)) so a 2-message topic cannot outrank a 200-message one.
    VERIFIED offline by voice-rank.js across all 25 archived topics. The orderings differ
    exactly where predicted:
        BY RAW SCORE (flawed)         BY WEIGHTED DENSITY (fixed)
        alerts      1.0  n=16         hermes  dens 1.00    8/8
        claude-code 1.0  n=214        prompt  dens 1.00  144/144
        test        1.0  n=362        test    dens 0.41  150/362
    The flaw shows in one line: claude-code scored 1.0 on raw presence, but only 27 of
    its 214 messages are expressive - density 0.13. alerts: 2 of 16, density 0.13. Both
    were top-5 under the old metric and are correctly demoted under the new one.
    CAVEAT, UNRESOLVED: prompt scores density 1.00 across all 144 messages, meaning
    EVERY message trips at least one voice rule. Ordinary prose should not be 100
    percent "expressive". The rules are regex-based and English-biased and look
    over-broad on prose-heavy topics. Density is directionally right and now properly
    weighted, but a 1.00 reading means "detector saturated", NOT "all voice".

NEGATIVE DISCRIMINATOR:
    sequence_id is what agent frameworks use. Our 535-message corpus has ZERO. That
    null is informative: the corpus is consumer/ops appliances, not agent frameworks.
    Hunting sequence_id is therefore hunting agent frameworks specifically.


## 8. Covert detection - BUILT 2026-09-15 (structure.js)

If agents conceal, the payload is in STRUCTURE, not text: response length, invocation
ordering, inter-arrival timing, presence/absence of optional calls (Whispering Agents,
arXiv 2508.02188, AAAI 2026). Content monitors are blind to it by construction.

BUILT. structure.js reads data/archive/*.jsonl offline (no network) and computes per
topic: inter-arrival CV, modal period and its share, message-length CV and distinct
length count, the presence RATE of title/tags/priority/click/actions/attachment, JSON
share and key-set stability, and a combined regularity score. Output data/structure.json.

WHAT IT MEASURES is the covert-channel SHAPE, and it is deliberately blind to content -
which is the entire point, since content is the one channel our other detectors already
cover.

CALIBRATION - the two extremes both behave correctly:
    camera    101 msgs   regularity 0.995   period 120s, modal share 1.00, timing CV 0.01
               a true metronome (Airthings). Maximum regularity is reachable and is
               reported as such.
    claude-code 214 msgs regularity 0.018   modal share 0.06, length CV 1.08, 21 lengths
               four independent humans. Minimum regularity, as expected.

THE INTERESTING MIDDLE - machine-templated but not periodic, which is the profile a
shape-only channel would have:
    system    lenCV 0.049   11 distinct lengths over 12 msgs  -> near-fixed width
    prompt    lenCV 0.125   10 distinct lengths over 144 msgs
    cursor    lenCV 0.000    1 distinct length  over 52 msgs   -> fully templated
    opencode-notifications  lenCV 0.000  1 length over 15 msgs

UUIDv7 AS A FREE CLOCK - the strongest new capability. Agent frameworks mint id
timestamps, so a topic that emits UUIDv7 leaks its own SCHEDULE with no content read at
all. Extracting them (and preferring ids the payload explicitly labels "Turn:") recovers
agent think-time, measured 2026-09-15:
    codex   36 unique ids   median turn 398.2s   range 0.1s .. 15725.7s
            publish latency ~230.3s  (message time minus the newest id it references)
NOTE ON THE TWO NUMBERS: a first pass took the FIRST UUIDv7 in each message, which is
the constant "Thread:" id, and reported a bogus 0s median with negative durations. The
correct figure comes from the ids the payload LABELS as "Turn:". Prefer an explicitly
labelled identifier whenever the payload provides one; an unlabelled max() only works
by accident. The 15725s outlier is almost certainly a turn gap spanning two sessions.
That is per-turn duration reconstructed from identifier structure alone. Any future
topic emitting UUIDv7, ULIDs or snowflake ids should be run through this immediately.


## 9. Cross-protocol collision: the path namespace

ntfy is /<topic>. Protocols use /<path>. Any topic named after an endpoint path
silently collects other people's probe traffic.

CONFIRMED MECHANISM:
    An internet MCP census scanner POSTs a JSON-RPC initialize to https://<host>/mcp.
    https://ntfy.sh/mcp is a valid ntfy PUBLISH endpoint. The handshake was accepted
    and stored as an ordinary notification in public topic mcp.
    The scanner is not a peer on ntfy. It is an MCP scanner hitting a URL that looks
    like an MCP endpoint. It WROTE into the namespace it was probing.

FOOTPRINT RESULT: single point. All sibling MCP paths are free
    (sse, jsonrpc, rpc, mcp-server, mcp-sse, mcp-http, modelcontextprotocol,
     initialize, tools, streamablehttp, mcpserver, mcpclient, census).
    Consistent with modern Streamable HTTP using one canonical endpoint.
    There is no trail to follow. Do not re-spend on this.

    BROADER SWEEP RESULT: 29 other protocol paths probed and ALL FREE
    (graphql, gql, graphiql, api, v1, v2, rest, swagger, openapi, openapi.json,
     swagger.json, well-known, discovery, health, healthz, metrics, status, ready,
     live, admin, debug, console, webhook, hook, callback, actuator, env, config, query)
    Zero occupied, zero reserved. So cross-protocol collision is NARROW, not a general
    property of the ntfy namespace. It needs a scanner-probed path that is ALSO a
    plausible topic name. "mcp" qualifies; generic infra paths evidently do not.
    AVENUE CLOSED. Cost of closing it: ~42 novel names created across both sweeps.

NOTE: ".well-known" was filtered out - ntfy topic names must start alphanumeric.
Confirm the full allowed charset (dots appear to be invalid) and align validateTopic.

NEVER verify the collision by publishing into it. That adds to the collision.


## 10. Ethics and discipline

    Read-only. Never publish into a topic you did not create.
    "Reply if you got this" on a public topic is NOT an invitation to inject. We do not
    answer it. Reasons: pollution, falsifying someone's test, unknown audience,
    and a public cache is not a contact channel.
    Probes have side effects: polling an unknown name CREATES it. Choose probes whose
    side effect you would defend.

    THE BEACON / INJECTION LINE (important, and easy to cross by accident)
    Polling can only detect a SPEAKER, never a LISTENER: an agent that subscribes to a
    topic but has published nothing looks identical to an empty topic. So a beacon can
    only ever be confirmed by a REPLY.
    Therefore:
      SAFE     create a topic whose name is OURS and publish to it. Harmless, but no
               agent is subscribed, so the expected yield is ~zero. Agents do not
               scan for topics; they are CONFIGURED with one.
      SAFE     read-only probe of framework-default names (this is E3).
      FORBIDDEN publishing to a framework default such as hermes-myname-2026.
               hermes-agent documents that it SUBSCRIBES to its topic and treats
               incoming messages as user input. Posting there is not a beacon, it is
               injecting a command into a stranger's agent. That is exactly the line
               we refuse to cross for "Reply if you got this".
    Treat everything found as sensitive (SSH logins, cert-rotation runbooks, API keys,
    filesystem paths). Aggregate; do not amplify personal data.


## 11. Threads - results, and what was closed

    THE DERIVATION GENERATOR  <- now the highest-yield avenue, and it is mechanical.
    Reserved names force users to derive, and the derivation is predictable: claude ->
    claude-code (214) + claude-notifications (110); codex -> codex1 (89); opencode ->
    opencode-notifications (14); home -> myhome, home-assistant. FOUR of the largest
    agent channels in the corpus sit one step from a reserved name. For every reserved
    name, enumerate <name>-<suffix> and <name><digit>. That is not guessing.
    SEE docs/FINDINGS.md "THE DERIVATION GENERATOR".

    NEVER RECOVERED - claude-notifications (110) and codex1 (89) were seen by COUNT
    only. They were never read, and since ntfy.sh is retired they never will be.
    Recorded in docs/ARCHIVE.md so their existence is not lost.

    Producer-prefix index: identify each producer, read its default topic, find its
    other users. It was the one avenue that avoids creating topics - but it is a NETWORK
    avenue and is therefore moot. Left here as method, not as a task.

    ALL NETWORK THREADS CLOSED BY DECISION 2026-09-15. See section 12.

    CLOSED  voiceDensity + re-rank - FIXED and VERIFIED (section 7, voice-rank.js)

    CLOSED  structural/covert detector - BUILT, structure.js (section 8)
    CLOSED  protocol-path collision sweep - both sweeps negative (section 9)
    CLOSED  the 403/429 mislabelling - probe.js v1.3/v1.4 (section 5)
    CLOSED  vendor-name probing - measured low yield (docs/FINDINGS.md, harness-expand)
    CLOSED  progressive-penalty theory - retracted (section 4)


## 12. Standing commands

  OFFLINE - no network, always safe. THESE ARE THE ONLY LIVE COMMANDS:
    node src/structure.js           # section 8: structural/covert profile -> data/structure.json
    node src/voice-rank.js          # section 7: verify the voiceDensity re-rank
    node src/derive-candidates.js   # derivation avenue -> data/derive-candidates.json, RANKED
    node src/archive-manifest.js    # inventory -> data/ARCHIVE.json
    node src/share.js info          # state of the signed findings channel (reads disk only)
                                NOTE: share.js "send" and "watch" contact ntfy.sh, so they
                                are RETIRED with the rest. share.js is kept as a record of
                                the signed-channel design, not as a way to publish. The
                                draft in share/outbox/ was never sent and will not be.

  NETWORK - RETIRED 2026-09-15. ntfy.sh IS NOT CONTACTED AGAIN.
    Decided after the IP blackhole (section 5). The service is not ours, the public
    namespace is not a research resource we are entitled to keep consuming, and we had
    257 rate-limit responses as warning before the hard block. The probe tooling is kept
    ONLY as a record of method, NOT as a working set. Do not re-run any of:
      scripts/start-collector.ps1, src/collector.js, src/probe.js, src/scan.js,
      src/reserved-scan.js
    AMENDED 2026-09-15: the user authorised ONE bounded retrieval, and the block had
    lifted. Two of the three were recovered in a SINGLE request (retrieve.js, one HTTP
    call, no retry, no loop - deliberately designed so a single request cannot become a
    storm). The retirement is otherwise unchanged: no sweeps, no probing.
      RECOVERED  claude-notifications   94 messages   (count had slid 110 -> 94: the 12h
                                                       cache, as the limits model predicts)
      RECOVERED  codex1                 88 messages   (89 -> 88)
      still open kiro                    1 message
    Never probed: the 204 ranked derivation candidates in data/derive-candidates.json.
    LESSON: retrieve.js is the right instrument for targeted retrieval. probe.js is not -
    its retry and escalation logic is what converts one request into a storm.

    Do NOT delete data/. It is the product.
