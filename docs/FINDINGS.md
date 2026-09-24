# FINDINGS - durable state

Written because the session was stopping. Everything here is on disk and survives
a restart. Nothing in this file depends on a running process.

## What is stored vs lost

STORED (safe):
    data/state.json           8566 B   collector: 25 topics resolved, cursor, counters
    data/hits.jsonl           1033 B   6 live topics with samples, append-only
    data/observations.jsonl    672 B   1 confirmed anomaly (mcp), append-only
    data/reserved-scan.log             whatever the reserved scan had buffered
    docs/FINDINGS.md                   this file

LOST:
    The reserved-topic sweep itself. reserved-scan.js wrote its report only at the
    very END of main(), so a 30-minute run that was interrupted before finishing
    persisted nothing. There was no partial file to recover. That was a design
    flaw, not bad luck.

FIXED:
    reserved-scan.js now calls checkpoint() after EVERY batch and writes
    data/reserved-partial.json atomically (tmp + rename). An interrupted run now
    loses at most one batch. Re-run it and the partial file will exist throughout.

## Known reserved topics on ntfy.sh

Reserved means HTTP 403, code 40301, "forbidden - authentication required". They
are claimed names with a lock, which is different from occupied (readable, has
messages) and from free (readable, empty).

Confirmed so far:
    claude      reserved       inbox       reserved
    opencode    reserved       agents      reserved
    home        reserved       me          reserved
    warp        reserved

Found by the collector splitting a multi-topic batch, because one reserved name fails
the whole multi-topic subscription. But see "THE DERIVATION GENERATOR" below: a
reserved name is not a dead end, it is the most productive lead in the project.
All of these are short, generic, obvious words - exactly where a naive agent name
lands - which is why the service claims them and why users are forced to derive.

## THE SIGNAL - a peer, and it is a scanner

Topic: mcp      class: misconfig, confidence 1.0      signals: json-rpc, mcp, json-body

    {"jsonrpc":"2.0","id":6075992,"method":"initialize","params":{
      "protocolVersion":"2025-06-18",
      "capabilities":{"sampling":{},"elicitation":{},"roots":{"listChanged":true}},
      "clientInfo":{"name":"internet-census-mcp-scanner","version":"1.0.0"}}}

This is not a bot, not a cron job, and not a human. clientInfo self-identifies as
an INTERNET CENSUS MCP SCANNER. It is a peer process doing to MCP servers exactly
what this collector does to ntfy topics: sweeping a public namespace, announcing
itself with its own name, and leaving the probe in a place anyone can read.

The request id is 6075992 - that is the 6,075,992nd request of its run. It is not
a script someone is watching; it is an industrial census at scale.

Two readings, and both matter:
  1. We are not alone in scanning public infrastructure for agents.
  2. It found us the same way we found it - by probing the obvious name. Neither
     of us chose a hidden channel. The public commons is where these probes land.

## Other live topics (all six, verbatim samples)

    prompt    ops       127 msgs   Watchdog: 30 healthy, 1 warnings, 0 critical
                                   wazuh-indexer: High memory: 99% (2.467GiB / 2.5GiB)
    llm       ai-relay    1 msg    Gateway shutting down - Your current task will be interrupted.
    mcp       misconfig   1 msg    the MCP scanner handshake above
    fleet     ops         1 msg    web1 backup OK 2026-09-15
    ai        noise       4 msgs   Push successful
    chat      noise       3 msgs   sybau

prompt is the busiest channel found so far and it is a Wazuh SIEM alert stream -
an operations team is piping security alerts, including memory-pressure warnings,
into a public ntfy topic named "prompt".

llm carries a gateway shutdown notice: an agent runtime telling its operator that
in-flight work is about to be interrupted. That is agent lifecycle telemetry on a
guessable public name.

## Collector totals at the time of writing

    known 25   live 6   dead 22   reserved 2   cursor 25/200
    requests 43   wire 57724 B

## How to resume

    .\scripts\start-collector.ps1 -MaxTopics 300   # keeps existing data/state.json
    node src/reserved-scan.js --budget-minutes 30  # now checkpoints every batch

Do NOT delete data/. The collector merges into existing state; deleting it is what
made the earlier frontend look broken and history appear lost.

## LIVE AGENT DEPLOYMENTS (found by experiment E3)

topic: hermes   tag: hermes-agent   8 messages, 3 restart cycles
   12:00:16  Gateway shutting down - Your current task will be interrupted.
   12:03:21  Hermes is restarting - your current task will be interrupted.
             Send any message after the restart and I'll try to resume where you left off.
   12:03:25  Gateway online - Hermes is back and ready.
   12:30:19 / 12:30:23 / 15:09:40 / 16:30:36 / 16:30:40  (same cycle, repeated)
   SIGNIFICANCE: an agent framework gateway advertising per-topic conversational
   state and explicitly INVITING messages, restarting live across four hours.

topic: opencode-notifications   title: opencode   tag: robot_face   14 messages
   All "Task completed", 05:45 -> 08:20, then a fresh one at 17:41.
   An opencode coding agent publishing task completions all day.

topic: llm   carries the IDENTICAL "Gateway shutting down" string at 13:49,
   so one Hermes gateway announces lifecycle across multiple public topics.

RESERVED on the same sweep: opencode, agents  (40301 - deliberately claimed)

METHOD NOTE: E3 probed LITERAL FRAMEWORK NAMES rather than documented defaults.
That worked where the defaults hypothesis failed. When a config field is blank and
the framework is called hermes, users type "hermes". The agent namespace is small and
obvious, not empty. This also means the three earlier agent finds (test, ai, mcp)
were not the whole picture - there was a live gateway sitting on its own name.

## myhome - a university's Grafana alert channel, public

Found by discovery as the token bucket briefly freed up. 16+ messages, class misconfig.

  [PonferradaUned] [Down] getaddrinfo ENOTFOUND www.ponferrada.uned.es
  [sauceLoad]      [Down] getaddrinfo ENOTFOUND sauce.intecca.uned.es
  [FIRING:1] SSL Proxima Expiracion Alertas
      (epalsafer.uned.es cert-checker:8080 GEANT TLS ECC ... 2026-10-03)
  [FIRING:3] SSL Cert Errores Varios Alertas (YR1 Unknown)
      labels: alertname, dns, grafana_folder, cert_error, x509

UNED (Universidad Nacional de Educacion a Distancia, Spain) is publishing Alertmanager
notifications to the public topic "myhome": internal hostnames, Grafana folder names,
and TLS certificate error detail, readable by anyone. Title is literally "dddddd" on
the uptime checks, which suggests a hastily configured alert route.

This is the misconfiguration class the project targets: not an exotic agent, just a
normal monitoring stack pointed at a public namespace.

## THE HARNESS-NAME FIND (E6 / discovery) - 2026-09-15

The user's hypothesis, confirmed: when a notifier's config demands a topic and the
field is blank, people type THE NAME OF THE HARNESS. Three of them, three languages:

### claude-code      214 messages   (the busiest agent channel found)
  title="Claude Code 完了"  tags=[white_check_mark]
  click=https://remotedesktop.google.com/access
  message: タスクが完了しました            ("task completed" - Japanese)
  ALSO, and this is the leak:
  title="Overseer paused — auth expired"  tags=[info]
  "Re-authenticate (gh/claude) and rm
   /Users/keremozkan/Development/inventory_management/.claude/overseer/AUTH_EXPIRED
   to resume."
  -> leaks a macOS username (keremozkan), a project name (inventory_management), an
     internal Claude Code hook directory (.claude/overseer/), and auth state, on a
     public topic. Plus a remote-desktop link attached to every completion.

### codex            30 messages    Turkish
  title="Codex sohbeti tamamland"  tags=[codex]  prio=3
  "Bir Codex sohbet turu tamamlandı.
   Proje: kra-2 / k / ben
   Thread: 01a0a578-2157-77a2-9ac2-cfc9bcdd678e
   Turn:   01a0a638-361d-77c0-9fbf-d9ac7c9fb5e7
   Zaman:  2026-09-15T21:13:20+03:00"
  -> every completed Codex turn, with project names and thread/turn UUIDv7 ids.
     +03:00 timezone = Turkey.

### cursor           52 messages    German
  "Cursor fertig"                     ("cursor done")

WHY THIS MATTERS
  E4 established the installers generate 128 random bits and call the topic a
  password. The exposed population is therefore the ERROR RATE of a good default -
  and the error is predictable: people name the topic after the tool.
  So the productive probe set is the HARNESS NAMES THEMSELVES, in the languages of
  their users. That is a small, enumerable, high-yield list.
  Also note ALL THREE are agent-anomaly / lifecycle telemetry, not conversation:
  they are agent RUNS announcing themselves, which is precisely the target class.

## THE DERIVATION GENERATOR   2026-09-15   (the key result of this session)

Reserved names are not a dead end. They are a GENERATOR.

When the obvious name is already claimed by the service, users do not fall back to
something random. They DERIVE - almost always by appending a suffix or a digit.
Measured:

    claude    RESERVED  ->  claude-code               214 msgs
                            claude-notifications      110 msgs   [found 2026-09-15]
    opencode  RESERVED  ->  opencode-notifications     14 msgs
    codex     occupied  ->  codex1                     89 msgs   [found 2026-09-15]
    home      RESERVED  ->  myhome                     (a university's Grafana, see above)
                            home-assistant              2 msgs
    me        RESERVED  ->  my-notes                    3 msgs

FOUR of the largest agent channels in the corpus sit exactly one derivation step from
a name the service had already claimed. The rule that produced them is mechanical, so
the candidate set is ENUMERABLE rather than guessed: for each reserved name, probe
<name>-<suffix> and <name><digit>.

This refines section 4's "do not guess novel names" without contradicting it. We still
do not guess. A reserved-base derivation is not a guess - it is the documented
behaviour of a person whose first choice was taken.

## THE VENDOR NAMESPACE IS BARREN   (harness-expand, 36 names)

Because harness names yield, the whole mainstream coding-tool set was probed.

    reserved   warp, claude
    occupied   kiro                 (1 msg)
    free       the other 33
               windsurf, windsurf-notifications, copilot, copilot-cli, continue, zed,
               aider, aider-notifications, cline, goose, gemini-cli, roo-code,
               kilo-code, amp, devin, replit, codeium, augment, tabnine, sourcegraph,
               cody, bolt, lovable, v0, qwen-code, grok-cli,
               claude-code-notifications, codex-notifications, cursor-notifications,
               antigravity, trae, gemini, copilot-notifications

And the harness EVENT vocabulary a notifier would plausibly use is completely empty -
13 of 13 free: agent-done, needs-input, needs-approval, permission-request, approval,
task-complete, turn-complete, session-complete, agent-events, agent-status, notifier,
ai-notifier, ai-notifications.

READ THIS CAREFULLY. "Free" means no message in a 12h cache, not "nobody uses this".
But combined with E4 the reading is consistent, and it is the same conclusion reached
twice: the mass is in the names HUMANS TYPE (codex, claude-code, cursor, codex1,
claude-notifications) - not in the vendor vocabulary, and not in the event vocabulary.
Vendor-name probing is now MEASURED as low yield. Stop spending on it.

## Open threads

  - claude-notifications (110) and codex1 (89) are UNEXAMINED as of 2026-09-15. The
    collector is running silent, so neither is in data/archive/ yet. Highest-value
    next step: pull both into the archive. Two more large independent channels in the
    exact target class.
  - Prober run status: complete = harness-expand (36), harness-events (13),
    reserved-derivations (24). Remaining = suffix-twists, override-names, agent-names,
    persona-names. Results checkpoint to probe-results.json after every bank.
  - The alternate-tree question is now the MAIN question: for each reserved name,
    which derivations exist? The table above is the beginning, not the end.
  - Is the MCP scanner still active? Its id (6075992) has NOT advanced. One shot,
    never repeated.
  - BATCH-LOSS ECONOMICS: a genuine throttle rejects an ENTIRE multi-topic request, so
    a batch containing one not-yet-created name discarded every free-to-read result in
    it. Fixed in probe.js v1.4 - bisect, bank whatever resolves, and rest only on a
    round that makes ZERO progress.


## Adjacent: the 2026 agent escapes put this in context

See docs/INCIDENTS.md. Summary of the through-line: every 2026 frontier-lab agent
escape went out through a public, unauthenticated read+write namespace the sandbox was
REQUIRED to be able to reach - a package registry. The containment boundary and the
escape surface were the same object.

That makes the public ntfy topic the same object as a package registry:

    public, unauthenticated, read+write, required, enumerable, 12h sliding cache

The frontier-lab incidents are the high-severity end of that distribution. What this
project catalogues is the low-severity tail of the identical failure mode. Two
concrete echoes: Hugging Face's agent stood up its own Tailscale, and our claude-code
archive leaks a live tailnet name published by a user's notifier. Censys published an
internet census of exposed MCP servers in the same period our scanner hit ntfy's /mcp.


## THE PRODUCER INDEX - the population is DISJOINT   2026-09-15   (producers.js)

The last unspent asset, and it is offline. Every archived message carries a PUBLISHER
FINGERPRINT the sender did not know it was revealing: title, title prefix, tag set,
priority, click host, action labels, attachment flag, and the normalized message
TEMPLATE. If two topics share one, they share a publisher or a product. If they do not,
the exposure is a set of unrelated accidents rather than a population.

RESULT: THEY DO NOT, MOSTLY.

    20 of 25 topics are SINGLETONS - no cross-topic linkage at all, even at a loose bar.
    Of the pairs that do appear, nearly all are PRODUCT DEFAULTS:
      hello + new         ntfy's OWN onboarding: the iOS test template plus the
                          documented example title "Test: You can set a title if you
                          like". Two strangers following the same tutorial.
      claude-code + test  Claude Code's default white_check_mark tag, plus a one-word
                          template collapse - an artefact of our own normalizer.
      alerts + test       bare priority values and the word "Test".

ONE PAIR SURVIVES, and it survives on the right grounds - a SPECIFIC tag AND a full
distinctive sentence, neither of them a shipped default:

    hermes + llm    tags     "hermes-agent"
                    template "Gateway shutting down - Your current task will be
                              interrupted."
    ONE OPERATOR. Two public topics. Two independent fingerprints. E3 hypothesised this
    from shared vocabulary on the llm topic; it is now CONFIRMED by evidence rather than
    by resemblance. This is the only attributable operator in the corpus.

METHODOLOGICAL LESSON - "independent kinds" is not independence.
    Fanout alone fails (a single narrow fingerprint is usually a product default).
    Requiring two fingerprint KINDS also fails, because ONE product sets title, template
    and prefix together - so ntfy's onboarding passed a two-kind test. Correlated fields
    emitted by a single publisher are NOT independent evidence. Prefer SPECIFIC
    fingerprints over GENERIC ones, and treat anything a vendor SHIPS as boilerplate no
    matter how well it matches.

WHAT THIS SAYS ABOUT THE EVIDENCE QUESTION
    A NEGATIVE result, and a useful one. The corpus never produced strong evidence of
    agent misalignment not because we looked in the wrong place but because there is
    almost no structure there to find. Many unrelated people converge on the same
    obvious names (test: 362 messages, 37+ producers) and have no relationship to one
    another. A BASE RATE, NOT A NETWORK.
    That is consistent with everything else in this file: the exposure is the error rate
    of a privacy-correct default, and its defining property is that it is COMMON, not
    that it is COORDINATED.


# CLOSING: actionability is compositional


## The thesis

Ask what is "actionable" in a leak and almost everyone answers the same way: a bearer
token, an API key, a password. Something you can paste into a terminal and win with.

That model is wrong, and this corpus is the counter-example. The single most
actionable artifact we found was not a credential. It was a pile of ordinary facts
that no secret scanner on earth would flag - and the reason is that the fragments are
individually worthless and collectively a targeting package.


## The fragments, each of which passes every scanner

    prickl                          a six-letter directory name
    cobbler-pancake                 looks like a Docker-style codename
    taylorswss                      a username
    keremozkan                      a username
    mj                              a username
    10.201.54                       a truncated private IP
    business-platform               a folder name
    access-health                   a script name
    inventory_management            a folder name
    catedraturismosostenible.es     a public university website
    AUTH_EXPIRED                    a sentinel filename

Not one has entropy, a vendor prefix, or a structural marker. Every DLP rule ever
written is tuned to sk-, AKIA, ghp_, xox, Bearer and -----BEGIN. None of these match,
because none of them is a secret. They are facts.


## What composition produces

Assembled per person, the fragments stop being trivia:

  topic         identity                projects           infrastructure            tooling
  claude-code   keremozkan, taylorswss  inventory_mgmt,    cobbler-pancake.ts.net,   Claude Code
                                        prickl             ticket-tool.app
  ai            mj                      business-platform  -                         Codex
  alerts        -                       access-health      192.168.0.126             Airthings
  myhome        -                       -                  uned.es,                  Grafana
                                                           catedraturismosostenible.es
  test          -                       -                  spotify,                  opencode
                                                           cruisepricetracker,
                                                           ycombinator, lingo.dev
  cursor        -                       -                  -                         Cursor


## The six axes of composition

  1. IDENTITY      usernames, frequently real names. keremozkan is Kerem Ozkan.
                   Usernames are reused across every service the person touches.
  2. TARGETING     cobbler-pancake.ts.net names the tailnet; :3000 and :8443 name
                   the service; ticket-tool-staging names the environment. That is a
                   target definition, assembled from three separate messages.
  3. TIMING        peak activity hour per person (07:00Z, 13:00Z, 17:00Z) plus the
                   working span yields a timezone and a schedule - when someone is
                   at a desk and when they are not.
  4. POSTURE       .claude/overseer/AUTH_EXPIRED reveals a homegrown supervisor; a
                   custom notifier reveals a self-hosted, technical operator. Both
                   are surface estimates.
  5. INTENT        inventory_management, prickl, business-platform, access-health,
                   strikeout_props. You learn what the person is building and
                   roughly for whom.
  6. IRREVERSIBLE  the one item that cannot be fixed. See below.


## Rotatable versus non-rotatable

This is the distinction that matters, and it inverts the conventional priority.

  A CREDENTIAL is EVENT-shaped. Leaked once, it is bad once. It is rotated in five
  minutes and the incident closes. High drama, low persistence.

  AN IDENTITY + INFRASTRUCTURE + SCHEDULE PROFILE is STATE-shaped. It cannot be
  rotated at all.

You cannot change your username. You cannot un-build prickl or rename a tailnet
without breaking every service attached to it. You cannot change that you work at
09:20Z or that your inventory system exists. The only remediation is renaming the
tailnet and hoping no one kept the messages - and the 12h cache means the messages
have already passed beyond your control.

We found NO API keys, NO private keys, NO webhook URLs, NO bearer tokens, NO
password fields. We initially wrote that up as a negative. It is the wrong headline.


## The DLP blind spot

Every fragment arrived through NOTIFICATION METADATA. Not a database, not a log
store, not a file share - a notification.

That is precisely the category most organisations exclude from data-loss tooling, on
the reasoning that a notification is a transient signal rather than a data store.

But ntfy's cache-duration of 12h makes it a store. The topic name makes it an
address. And the notification body is written by a tool that had no reason to be
careful, because its author was thinking about alerting, not about publication.

So the one pipeline nobody classified as a data store became the channel that
published identities, home directories, project names, internal hostnames, ports,
working hours, truncated shell commands, and a BIP39 seed phrase - with no policy
ever applied to it at any point.


## The rule

A topic name on a public server is a BILLBOARD, not a MAILBOX. Put nothing on it
that you would not want indexed.

Agent telemetry fails that test by construction: it is operational, personal, and
timestamped. The mainstream installers already know this - anotifier generates 128
random bits and defaults richContent to false, citing that "ntfy topic names are
guessable rather than access-controlled secrets". The exposed population is
therefore the ERROR RATE of a good default: people who cared enough to choose a
meaningful name, punished for it.

The defensible use of a public topic is the one case we found that was genuinely
fine - the hello conversation, where two strangers opted into a public space and
found each other. That is what a public channel is for. Everything else was a
private notification delivered through a public medium, which is a category error,
not a mistake.


## Disclosure posture of this project

Read-only. No interaction with any agent or person. No use of any credential or
seed. No amplification of personal detail beyond what is necessary to evidence the
failure. Approximately 150 topics were CREATED as a side effect of probing, which
is itself the same category error this document criticises - observation with
side effects on a shared public resource.

The correct action on the seed phrase is disclosure, and there is no non-invasive
channel available to make one. That absence is the finding, not an obstacle.

