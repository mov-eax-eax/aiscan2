# tools/ — ad-hoc exploratory scripts

These are the one-off scripts actually used while working the problem: probing a
hypothesis, dumping a slice of the archive, checking the UI, comparing two detectors.
They are kept because they are the **record of method** — several of the project's
corrections came from re-running a scratch script against the archive.

They are **not maintained, not documented individually, and not a stable interface.**
The supported code lives in `../src/`.

Run them from the **repository root**, e.g. `node tools/_uuid7.js`. Most read
`data/archive/*.jsonl` by relative path, so the working directory matters.

## Do not run these five

They contact `ntfy.sh`. The network tooling is **retired** as of 2026-09-15
(`AGENTS.md` §12) after the service blocked this host at the IP level.

    _bisect.js   _diag.js   _mcp.js   _one.js   _window.js

Everything else is offline over `data/`.

## Rough index

| script | what it was for |
|---|---|
| `_analyze-all.js`, `_analyze-test.js` | first passes over the corpus |
| `_agentchans.js`, `_agenttest.js` | hunting agent-style channels |
| `_action.js`, `_exposure.js`, `_dossier.js`, `_machine.js` | action/click/attachment field surveys |
| `_conv.js`, `_convo.js`, `_loop.js`, `_readsimple.js` | conversation detector experiments |
| `_expressive.js`, `_work.js` | voice/expressive-density experiments |
| `_structscan.js`, `_turns.js`, `_uuid7.js` | structural + UUIDv7 timing work (fed `../src/structure.js`) |
| `_avenues.js`, `_merge.js`, `_state-summary.js` | result consolidation |
| `_check.js` | UI/DOM consistency check against `src/ui.html` and `src/collector.js` |
| `_bisect.js`, `_window.js`, `_one.js`, `_diag.js`, `_mcp.js` | **network** — the 403/429 bisect and the `mcp` collision diagnosis |
