# Data notice — read this before reusing `data/`

## Provenance

Everything under `data/archive/` and `data/originals.md` was captured **read-only**
from the **public `ntfy.sh` cache** on 2026-09-15, using the unauthenticated public
read API that any ntfy client uses. Nothing was published into any topic this project
did not create. Nothing here was obtained by exploiting a vulnerability: these topics
were public, guessable names, and the cache is served to anyone who asks.

Current contents:

    27 topics        1,221 messages        397 KB        window 2026-09-15 -> 2026-09-16

## This is other people's traffic

These are **real notifications from real people and organisations** who did not
choose to be in a research corpus. On ntfy the topic name *is* the only credential, so
a topic name is functionally a password — which means **the archive filenames
themselves** (`hermes.jsonl`, `myhome.jsonl`, `codex1.jsonl`, …) identify live channels
that anyone could publish into.

Message content is unredacted and includes operational detail such as:

| category | measured |
|---|---|
| a real third-party email address | 1 message (`data/archive/claude-code.jsonl`) |
| RFC1918 private addresses | 6 messages (`192.168.0.x`, `10.x`) |
| filesystem paths | 107 messages |
| a **public IP + production service name** | 1 message (`supos-alarm-service-39.175.165.234`) |
| SIEM alerts, homelab watchdog output, agent transcripts | throughout |
| commercial transactions in several languages | e.g. a point-of-sale line in `yo.jsonl` |

**Explicit negative, and it is a finding in its own right:** a scan for API keys,
private keys, webhook URLs, bearer tokens and password fields returned **nothing**.
The exposure in this corpus is operational context, not credentials. See
`docs/FINDINGS.md`.

## Handling rules

1. **Do not republish raw message content.** Aggregate and characterise; do not
   reproduce individual people's notifications, addresses or hostnames.
2. **Treat topic names as credentials.** They are the passwords to those channels.
3. **Do not publish into any topic named here.** It is someone else's notification
   channel, and in at least one documented case (`hermes-agent`) the subscriber treats
   incoming messages as user input to an agent — publishing there is command
   injection, not a message.
4. **Do not re-probe to "verify" anything in this corpus.** `ntfy.sh` is retired for
   this project, and polling an unknown name creates it.

## Reducing exposure

`data/archive/` and `data/originals.md` are the sensitive part. The derived JSON
(`structure.json`, `derive-candidates.json`, `producers.json`, `ARCHIVE.json`) contains
statistics and name lists rather than message bodies. If you want the analysis without
the corpus, drop the archive and keep the derived files — but back it up elsewhere
first, and never delete it in place; see `AGENTS.md` §1, "STATE IS THE PRODUCT".

## Requesting removal

If you operate one of these topics and want your content excluded, open an issue.
Exclusion is honoured without argument.
