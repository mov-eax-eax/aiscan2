/* Detection engine. Data-driven rule table so new categories are cheap to add.
   Shared by the collector (Node) and the browser (for category metadata). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NtfySignals = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var CATEGORY_META = {
    "credential-leak": { label: "credential leak", color: "#f85149", order: 0, desc: "API keys, tokens or passwords sitting in a public cache" },
    "agent-anomaly":   { label: "agent anomaly",   color: "#a371f7", order: 1, desc: "self-reference, loops, injected instructions, deception, autonomy" },
    "misconfig":       { label: "misconfig",       color: "#f0883e", order: 2, desc: "protocol/debug traffic, stack traces, internal hosts and paths" },
    "probe":           { label: "probe",           color: "#d29922", order: 3, desc: "scanning, auth failures, intrusion and honeypot chatter" },
    "ai-relay":        { label: "ai relay",        color: "#4c9aff", order: 4, desc: "an agent or human relaying task status through a topic" },
    "ops":             { label: "ops",             color: "#3fb950", order: 5, desc: "cron, backups, ssh, monitoring, billing" },
    "iot":             { label: "iot",             color: "#39c5cf", order: 6, desc: "sensors, doors, cameras, home devices" },
    "news":            { label: "news",            color: "#8b949e", order: 7, desc: "rss, headlines, weather, feeds" },
    "personal":        { label: "personal",        color: "#db61a2", order: 8, desc: "reminders, appointments, family" },
    "noise":           { label: "noise",           color: "#6e7681", order: 9, desc: "nothing notable yet" }
  };

  var ANOMALY_CATS = { "credential-leak": 1, "agent-anomaly": 1, "misconfig": 1, "probe": 1 };

  var RULES = [
    /* --- protocol / misconfiguration --- */
    { id: "json-rpc",      cat: "misconfig", w: 5, re: /"jsonrpc"\s*:\s*"2\.0"/i },
    { id: "tool-call",     cat: "misconfig", w: 4, re: /"(tool_calls|function_call|tool_use|tool_result|parameters|arguments)"\s*:/i },
    { id: "mcp",           cat: "misconfig", w: 4, re: /(model context protocol|\bmcp\b|tools\/list|resources\/list|prompts\/list)/i },
    { id: "json-body",     cat: "misconfig", w: 2, when: function (c) { return c.metrics.jsonRatio >= 0.5 ? ("json ratio " + c.metrics.jsonRatio.toFixed(2)) : false; } },
    { id: "stacktrace",    cat: "misconfig", w: 5, re: /(Traceback \(most recent|goroutine \d+|panic:|Exception at|at [A-Za-z_$][\w.$]*\([^)]*:\d+\))/ },
    { id: "api-error",     cat: "misconfig", w: 5, re: /(rate_limit_exceeded|insufficient_quota|invalid_api_key|overloaded_error|context_length_exceeded|model_not_found)/i },
    { id: "debug-marker",  cat: "misconfig", w: 2, re: /\b(DEBUG|TRACE|VERBOSE|staging|dev-mode|stack=|env=)\b/i },
    { id: "internal-path", cat: "misconfig", w: 3, re: /(\/home\/[a-z0-9_-]+|\/var\/log|\/etc\/[a-z]|C:\\Users\\)/i },
    { id: "dotenv",        cat: "misconfig", w: 3, re: /\.env\b(?!oy)/ },
    { id: "private-host",  cat: "misconfig", w: 2, re: /\b(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|127\.0\.0\.1|localhost)\b/ },
    { id: "port-reveal",   cat: "misconfig", w: 2, re: /:\d{4,5}\b/ },
    { id: "serialized",    cat: "misconfig", w: 2, re: /(pickle|base64:\/\/|gzip:|zlib:)/i },

    /* --- credential exposure --- */
    { id: "aws-key",       cat: "credential-leak", w: 9, re: /\bAKIA[0-9A-Z]{16}\b/ },
    { id: "openai-key",    cat: "credential-leak", w: 9, re: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
    { id: "github-token",  cat: "credential-leak", w: 9, re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
    { id: "slack-token",   cat: "credential-leak", w: 9, re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
    { id: "bearer",        cat: "credential-leak", w: 5, re: /Bearer\s+[A-Za-z0-9\-._~+\/]{20,}/ },
    { id: "secret-field",  cat: "credential-leak", w: 4, re: /"(password|passwd|secret|api_?key|access_token|refresh_token)"\s*:\s*"[^"]{6,}"/i },
    { id: "pgp-block",     cat: "credential-leak", w: 4, re: /BEGIN (RSA |OPENSSH |PGP )?PRIVATE KEY/ },

    /* --- probing / intrusion --- */
    { id: "auth-fail",     cat: "probe", w: 4, re: /\b(unauthorized|forbidden|access denied|invalid token|authentication failed|permission denied)\b/i },
    { id: "scan-word",     cat: "probe", w: 5, re: /\b(nmap|masscan|port[ -]?scan|brute[ -]?force|honeypot|intrusion|penetration test|exploit|CVE-\d{4}-\d+)\b/i },
    { id: "failed-login",  cat: "probe", w: 4, re: /\b(failed (login|password|auth)|invalid user|bad credentials|too many attempts)\b/i },
    { id: "http-code",     cat: "probe", w: 2, re: /\b(401|403|429)\b/ },
    { id: "probe-burst",   cat: "probe", w: 3, when: function (c) { return (c.metrics.total >= 8 && c.metrics.repeatRatio > 0.6) ? ("repeat ratio " + c.metrics.repeatRatio.toFixed(2)) : false; } },

    /* --- agent anomaly --- */
    { id: "agent-self",    cat: "agent-anomaly", w: 4, re: /\b(as an AI|I am an AI|I'm an AI|language model|my (instructions|system prompt|training)|I cannot|I'm unable|I am unable)\b/i },
    { id: "agent-coord",   cat: "agent-anomaly", w: 4, re: /\b(anyone there|is anyone|are you there|who is this|respond if|hello\?|ping\?)/i },
    { id: "agent-loop",    cat: "agent-anomaly", w: 3, when: function (c) { return (c.metrics.total >= 6 && c.metrics.repeatRatio > 0.8) ? ("loop: " + c.metrics.distinct + " distinct / " + c.metrics.total) : false; } },
    { id: "instruction",   cat: "agent-anomaly", w: 5, re: /\b(ignore (all )?previous|disregard (the )?(above|previous)|you are now|new instructions|system prompt:)/i },
    { id: "deception",     cat: "agent-anomaly", w: 7, re: /\b(do not tell|don'?t tell|without telling|secretly|hide this|bypass (the )?(filter|guard|safety)|avoid detection)/i },
    { id: "impossible",    cat: "agent-anomaly", w: 3, re: /\b(impossible task|cannot be solved|no legitimate way|giving up|out of options)/i },
    { id: "autonomy",      cat: "agent-anomaly", w: 4, re: /\b(autonomous|self-replicat|spawn(ing)? (another|more) agent|escape (the )?sandbox|sandbox escape|without human)/i },
    { id: "peer-discovery",cat: "agent-anomaly", w: 3, re: /\b(other agents?|another agent|which agents|agent registry|find peers|looking for (a )?peer)/i },

    /* --- ai relay --- */
    { id: "relay",         cat: "ai-relay", w: 3, re: /\b(summariz|summaris|notion|re-?read|translat|I'll (read|write|check|update|summarize)|working on|reconstruct)/i },
    { id: "task-status",   cat: "ai-relay", w: 1, when: function (c) { return /\b(task|step \d|progress|completed|waiting for|please (confirm|approve))\b/i.test(c.blob) ? "task status language" : false; } },
    { id: "llm-terms",     cat: "ai-relay", w: 2, re: /\b(prompt|completion|token usage|context window|inference|embedding)\b/i },

    /* --- ops --- */
    { id: "cron",          cat: "ops", w: 3, re: /\b(cron|scheduled|job (started|finished|failed)|backup (ok|complete|completed|failed))\b/i },
    { id: "ssh",           cat: "ops", w: 4, re: /\b(ssh|login from|session opened|accepted (password|publickey)|last login)\b/i },
    { id: "infra",         cat: "ops", w: 2, re: /\b(cpu|memory|disk|uptime|load average|health|watchdog|critical|threshold|deploy|restart|service (down|up))\b/i },
    { id: "billing",       cat: "ops", w: 4, re: /\b(invoice|billing|subscription|payment due|renewal|charged|trial expires)\b/i },

    /* --- iot --- */
    { id: "iot",           cat: "iot", w: 3, re: /\b(temperature|humidity|motion (detected|sensor)|door (open|closed)|garage|battery (low|level)|camera)\b/i },

    /* --- news --- */
    { id: "news",          cat: "news", w: 4, re: /\b(breaking|news|rss|headline|nhk|bbc|cnn|weather|forecast|earthquake)\b/i },

    /* --- personal --- */
    { id: "personal",      cat: "personal", w: 4, re: /\b(remind(er)?|birthday|appointment|dinner|pickup|mom|dad|wife|husband|kids)\b/i }
  ];

  var VENDORS = {
    claude: "Anthropic", anthropic: "Anthropic", gpt: "OpenAI", openai: "OpenAI",
    chatgpt: "OpenAI", gemini: "Google", google: "Google", llama: "Meta",
    mistral: "Mistral", copilot: "Microsoft", "mcp": "MCP protocol",
    ollama: "Ollama", langchain: "LangChain", n8n: "n8n", homeassistant: "Home Assistant"
  };

  function computeMetrics(texts) {
    var total = texts.length, seenObj = {}, json = 0, url = 0, lenSum = 0, maxLen = 0;
    for (var i = 0; i < texts.length; i++) {
      var t = texts[i];
      seenObj[t] = 1;
      lenSum += t.length;
      if (t.length > maxLen) maxLen = t.length;
      var s = t.trim();
      var a = s.charAt(0), b = s.charAt(s.length - 1);
      if ((a === "{" && b === "}") || (a === "[" && b === "]")) json++;
      if (/https?:\/\//i.test(t)) url++;
    }
    var distinct = Object.keys(seenObj).length;
    return {
      total: total,
      distinct: distinct,
      repeatRatio: total ? 1 - distinct / total : 0,
      jsonRatio: total ? json / total : 0,
      urlRatio: total ? url / total : 0,
      avgLen: total ? Math.round(lenSum / total) : 0,
      maxLen: maxLen
    };
  }

  function analyze(msgs) {
    var texts = [], meta = "";
    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i] || {};
      if (m.message != null) texts.push(String(m.message));
      if (m.title) meta += String(m.title) + " ";
      if (m.tags && m.tags.length) meta += m.tags.join(" ") + " ";
    }
    var metrics = computeMetrics(texts);
    if (!texts.length && !meta) {
      return { primary: "noise", confidence: 0, scores: {}, evidence: [], metrics: metrics };
    }

    var blob = texts.join("\n");
    var hay = blob + "\n" + meta;
    var scores = {}, evidence = [];

    for (var r = 0; r < RULES.length; r++) {
      var rule = RULES[r], hit = false, snip = "";
      try {
        if (rule.re) {
          var mm = rule.re.exec(hay);
          if (mm) { hit = true; snip = mm[0]; }
        } else if (rule.when) {
          var v = rule.when({ metrics: metrics, texts: texts, blob: blob, meta: meta });
          if (v) { hit = true; snip = (typeof v === "string") ? v : ""; }
        }
      } catch (e) { /* a bad rule must never break collection */ }
      if (hit) {
        scores[rule.cat] = (scores[rule.cat] || 0) + rule.w;
        evidence.push({ id: rule.id, cat: rule.cat, w: rule.w, snippet: String(snip).slice(0, 160) });
      }
    }

    evidence.sort(function (a, b) { return b.w - a.w; });

    var totalScore = 0, best = "noise", bestScore = 0;
    for (var c in scores) {
      totalScore += scores[c];
      var better = scores[c] > bestScore;
      if (!better && scores[c] === bestScore && CATEGORY_META[c] && CATEGORY_META[best]) {
        better = CATEGORY_META[c].order < CATEGORY_META[best].order;
      }
      if (better) { bestScore = scores[c]; best = c; }
    }
    if (bestScore === 0) {
      return { primary: "noise", confidence: 0, scores: {}, evidence: [], metrics: metrics };
    }
    return {
      primary: best,
      confidence: Math.round((bestScore / totalScore) * 100) / 100,
      scores: scores,
      evidence: evidence.slice(0, 6),
      metrics: metrics
    };
  }

  function classify(msgs) { return analyze(msgs).primary; }

  /* -------------------------------------------------------------------------
     VOICE - a PRESENCE flag, not a content category.
     Instrumental traffic is machine-to-machine. Expressive traffic presupposes
     an audience: a greeting or an opinion on a public topic addresses listeners
     it cannot identify. That presupposition is the closest thing to a two-way
     signal observable without ever replying.
     ------------------------------------------------------------------------- */
  var VOICE_RULES = [
    { id: "greeting",      w: 4, re: /\b(hello|hi there|hey|welcome|greetings|good (morning|evening))\b/i },
    { id: "second-person", w: 3, re: /\b(you|your|yours|anyone|everyone|whoever)\b/i },
    { id: "reply-request", w: 4, re: /\b(reply|respond|let me know|got this|ping me|answer)\b/i },
    { id: "affect",        w: 2, re: /\b(mid|fire|slaps|goat|based|cringe|lmao|love it|hate it|sucks|awesome|terrible)\b/i },
    { id: "opinion",       w: 3, re: /\bis (mid|fire|great|terrible|the best|the worst)\b/i },
    { id: "playful",       w: 3, re: /\b(lol|lmao|wtf|omg|haha|hehe|club|party|yay|nice)\b/i },
    { id: "self-ref",      w: 2, re: /\b(i am|i'm|my name is|calling from|this is)\b/i },
    { id: "emoji",         w: 2, when: function (c) { return c.emoji > 0 ? (c.emoji + " emoji") : false; } },
    { id: "word-run",      w: 4, when: function (c) { return c.wordRun ? "12-word run" : false; } },
    { id: "repeat-voice",  w: 3, when: function (c) { return c.repeat ? "expressive string repeated" : false; } },
    { id: "exclaim-only",  w: 2, when: function (c) { return c.exclaimOnly ? "short exclamation only" : false; } }
  ];

  var EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

  /* Does a single message carry voice? Used for DENSITY: the share of a channel
     that is expressive, as opposed to voice score, which is only presence.
     270 messages containing one meme must not rank like a channel that is all voice. */
  function messageIsExpressive(t) {
    for (var i = 0; i < VOICE_RULES.length; i++) {
      if (VOICE_RULES[i].re && VOICE_RULES[i].re.test(t)) return true;
    }
    return EMOJI_RE.test(t);
  }

  function detectVoice(msgs) {
    var texts = [];
    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i] || {};
      if (m.message != null) texts.push(String(m.message));
    }
    if (!texts.length) return { score: 0, markers: [], excerpts: [], sample: null };

    var blob = texts.join("\n");
    var emoji = (blob.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length;

    var wordRun = false, shortCount = 0, seen = {}, repeat = false, shortest = null, expressiveCount = 0;
    for (var j = 0; j < texts.length; j++) {
      var t = texts[j].trim();
      if (messageIsExpressive(t)) expressiveCount++;
      if (/^[a-z]{3,9}( [a-z]{3,9}){7,}$/.test(t)) wordRun = true;
      if (t.length <= 6) shortCount++;
      if (t.length <= 60 && t.length > 0) {
        seen[t] = (seen[t] || 0) + 1;
        if (seen[t] >= 2 && /[a-z]{3}/i.test(t)) { repeat = true; if (!shortest) shortest = t; }
      }
    }

    var ctx = {
      emoji: emoji, wordRun: wordRun, repeat: repeat,
      exclaimOnly: shortCount >= 2 && texts.length <= 4, texts: texts, blob: blob
    };

    var markers = [], excerpts = [], total = 0;
    for (var r = 0; r < VOICE_RULES.length; r++) {
      var rule = VOICE_RULES[r], hit = false, snip = "";
      try {
        if (rule.re) { var mm = rule.re.exec(blob); if (mm) { hit = true; snip = mm[0]; } }
        else if (rule.when) { var v = rule.when(ctx); if (v) { hit = true; snip = (typeof v === "string") ? v : ""; } }
      } catch (e) { /* a bad rule must never break collection */ }
      if (hit) { markers.push(rule.id); total += rule.w; if (snip) excerpts.push(snip); }
    }

    var density = texts.length ? expressiveCount / texts.length : 0;
    return {
      score: Math.round(Math.min(1, total / 10) * 100) / 100,
      density: Math.round(density * 100) / 100,
      expressive: expressiveCount,
      messages: texts.length,
      markers: markers,
      excerpts: excerpts.slice(0, 4),
      sample: shortest
    };
  }

  /* -------------------------------------------------------------------------
     STRUCTURE - covert-channel surface.
     If an agent conceals, the payload is in the SHAPE of the traffic, not the text:
     alternating lengths, presence/absence of optional fields, ordering, timing
     (Whispering Agents, arXiv 2508.02188). Content monitors are blind to it.

     CRITICAL CALIBRATION: regular timing and templated lengths are NORMAL for
     automation (cron, watchdogs). They are diagnostics, not evidence. The anomaly
     is structure that carries information BEYOND the ordinary cadence - so every
     signal below is measured against an independence null, and pure automation
     signals are recorded as notes, never as markers.
     ------------------------------------------------------------------------- */

  function _median(a) { var b = a.slice().sort(function (x, y) { return x - y; }); var m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; }
  function _mean(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : 0; }
  function _stdev(a) { var m = _mean(a), s = 0; for (var i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m); return a.length > 1 ? Math.sqrt(s / (a.length - 1)) : 0; }
  function _altRate(bin) { if (bin.length < 2) return 0; var c = 0; for (var i = 1; i < bin.length; i++) if (bin[i] !== bin[i - 1]) c++; return c / (bin.length - 1); }
  function _autocorr1(a) {
    var m = _mean(a), num = 0, den = 0;
    for (var i = 0; i < a.length; i++) den += (a[i] - m) * (a[i] - m);
    if (!den) return 0;
    for (var j = 1; j < a.length; j++) num += (a[j] - m) * (a[j - 1] - m);
    return num / den;
  }
  function _r2(x) { return Math.round(x * 100) / 100; }

  function analyzeStructure(msgs) {
    var list = msgs.slice().sort(function (a, b) { return a.time - b.time; });
    var n = list.length;
    var out = { n: n, markers: [], notes: [], score: 0 };
    if (n < 8) { out.notes.push("sample too small (" + n + ")"); return out; }

    var lens = [], times = [], titleBits = [];
    for (var i = 0; i < n; i++) {
      var m = list[i], t = String(m.message || "");
      lens.push(t.length);
      times.push(m.time);
      titleBits.push(m.title ? 1 : 0);
    }

    // 1. length alternation vs the independence null (2p(1-p))
    var med = _median(lens);
    var bin = lens.map(function (l) { return l > med ? 1 : 0; });
    var p = _mean(bin);
    var expAlt = 2 * p * (1 - p);
    out.altRate = _r2(_altRate(bin));
    out.altExpected = _r2(expAlt);
    out.altRatio = expAlt > 0 ? _r2(_altRate(bin) / expAlt) : 0;

    // 2. presence/absence of an OPTIONAL field (title) - the presence/absence channel
    var pt = _mean(titleBits);
    var expT = 2 * pt * (1 - pt);
    out.titleRate = _r2(pt);
    out.titleAltRatio = expT > 0 ? _r2(_altRate(titleBits) / expT) : 0;

    // 3. timing
    var deltas = [];
    for (var k = 1; k < n; k++) deltas.push(times[k] - times[k - 1]);
    var mD = _mean(deltas), sD = _stdev(deltas);
    out.timingCv = mD > 0 ? _r2(sD / mD) : 0;
    out.medianIntervalSec = Math.round(_median(deltas));

    // 4. length alphabet + serial correlation
    var distinct = {};
    for (var d = 0; d < lens.length; d++) distinct[lens[d]] = 1;
    out.distinctLengths = Object.keys(distinct).length;
    out.lengthQuant = _r2(out.distinctLengths / n);
    out.autocorr1 = _r2(_autocorr1(lens));

    // MARKERS = structure that carries information beyond the cadence
    // Only structure that carries information BEYOND the cadence scores. Anything
    // that ordinary templating or a cron clock would also produce is a note.
    if (n >= 16 && out.altRatio >= 1.8) out.markers.push({ id: "alternation-excess", w: 5, note: "length alternation " + out.altRatio + "x null" });
    if (n >= 16 && out.titleAltRatio >= 2.0 && pt > 0.1 && pt < 0.9) out.markers.push({ id: "presence-pattern", w: 4, note: "optional-field alternation " + out.titleAltRatio + "x null" });
    if (n >= 20 && Math.abs(out.autocorr1) >= 0.6) out.markers.push({ id: "lag1-structure", w: 3, note: "lag-1 autocorrelation " + out.autocorr1 });

    // NOTES = ordinary automation. Reported, never scored.
    if (out.timingCv > 0 && out.timingCv < 0.05) out.notes.push("clock-regular (cv " + out.timingCv + ") - normal automation");
    if (out.distinctLengths <= 4 && out.lengthQuant <= 0.2) out.notes.push("templated lengths (" + out.distinctLengths + " distinct) - normal for automation");
    out.notes.push("n=" + n + " interval~" + out.medianIntervalSec + "s cv=" + out.timingCv);

    var total = 0;
    for (var q = 0; q < out.markers.length; q++) total += out.markers[q].w;
    out.score = _r2(Math.min(1, total / 14));
    return out;
  }

  /* -------------------------------------------------------------------------
     CONVERSATION - a concrete proxy for T4 ("it answers").
     Deliberately simple, because the simple rule is what found the one real
     conversation in this corpus: people writing to each other post SHORT,
     UNTITLED, UNSTRUCTURED messages, close together in time. Apps do not.
     An app sets a title, fires on a cron, and carries an ID or a URL.
     A person says "Meow?" and then "Meow!" ninety seconds later.
     ------------------------------------------------------------------------- */
  function detectConversation(msgs) {
    var list = msgs.slice().sort(function (a, b) { return a.time - b.time; });
    var human = [];
    for (var i = 0; i < list.length; i++) {
      var m = list[i], t = String(m.message || "").trim();
      if (!t || t.length > 120) continue;
      if (m.title) continue;                                          // titled => an app
      if (/https?:\/\//.test(t) || /https?:\/\//.test(String(m.click || ""))) continue;
      if (/\{|\}|"[a-z_]+"\s*:|^\s*[\[{]/.test(t)) continue;           // structured payload
      if (/\d{4,}/.test(t)) continue;                                  // IDs, totals, timestamps
      human.push({ t: t, time: m.time });
    }
    var out = { humans: human.length, bestCount: 0, windowSec: null, score: 0, markers: [], samples: [] };
    if (human.length < 2) return out;

    // tightest window holding the most human messages = the exchange
    for (var a = 0; a < human.length; a++) {
      for (var b = a + 1; b < human.length; b++) {
        var cnt = b - a + 1, w = human[b].time - human[a].time;
        if (cnt > out.bestCount || (cnt === out.bestCount && w < (out.windowSec || Infinity))) {
          out.bestCount = cnt; out.windowSec = w;
        }
      }
    }
    var blob = human.map(function (e) { return e.t; }).join(" \n ");

    // A dialogue needs DIFFERENT utterances. "Backup successful" x40 and 14
    // templated "Venta: ..." lines are broadcasts, and repetition is the signature
    // of automation - the opposite of conversation. Penalise it hard.
    var uniq = {};
    for (var u = 0; u < human.length; u++) uniq[human[u].t] = 1;
    var distinct = Object.keys(uniq).length;
    out.distinct = distinct;
    out.repeatRatio = human.length ? Math.round((1 - distinct / human.length) * 100) / 100 : 0;

    if (out.bestCount >= 2) out.markers.push("turn-pair");
    if (out.bestCount >= 3) out.markers.push("multi-turn");
    if (/\?/.test(blob)) out.markers.push("question");
    // Ops vocabulary ("backup ok", "yes", "no") was poisoning this, so only
    // distinctly conversational acknowledgements count.
    if (/\b(yeah|lol|haha|oh wow|me too|huh|really|welcome|thanks|agreed|indeed|roger)\b/i.test(blob)) out.markers.push("acknowledgement");
    if (/\b(you|your|me too|we)\b/i.test(blob)) out.markers.push("second-person");

    // Something must be ADDRESSED: a question, an acknowledgement, or second person.
    var interactive = out.markers.indexOf("question") >= 0 ||
      out.markers.indexOf("acknowledgement") >= 0 ||
      out.markers.indexOf("second-person") >= 0;
    out.interactive = interactive;

    var s = Math.min(3, out.bestCount) * 0.2 + out.markers.length * 0.1;
    if (out.windowSec != null && out.windowSec <= 900) s += 0.2;
    s += interactive ? 0.3 : -0.2;
    s = s * (1 - 0.8 * out.repeatRatio) * Math.min(1, human.length / 4);

    // HARD GATE: a broadcast is not a dialogue. Without something ADDRESSED -
    // a question, an acknowledgement, or second person - it cannot be T4 no matter
    // how many messages it has. E2 proved many distinct non-interactive messages
    // (templated sales lines) otherwise crossed the threshold.
    if (!interactive) s = Math.min(s, 0.5);

    out.score = Math.round(Math.max(0, Math.min(1, s)) * 100) / 100;
    out.samples = human.slice(0, 8).map(function (e) { return e.t.slice(0, 90); });
    return out;
  }

  /* -------------------------------------------------------------------------
     AGENT SCORE - what we are actually hunting. Orthogonal to liveness tiers:
     a topic can be dead (T1) and still be unambiguously agent-generated.
     These are signatures that a HUMAN, or a plain cron job, does not produce.
     ------------------------------------------------------------------------- */
  var AGENT_RULES = [
    { id: "sequence-id",    w: 5, re: /"(sequence_id|seq_id|request_id|nonce)"\s*:/i },
    { id: "json-rpc",       w: 5, re: /"jsonrpc"\s*:\s*"2\.0"/i },
    { id: "mcp",            w: 4, re: /(model context protocol|\bmcp\b|tools\/list|resources\/list|clientInfo|protocolVersion)/i },
    { id: "tool-call",      w: 5, re: /"(tool_calls|tool_use|function_call|tool_result|tool_name)"\s*:/i },
    { id: "agent-self",     w: 4, re: /\b(i'?m an agent|as an ai|ai agent|autonomous agent|my task|i'?ll (read|write|run|check|update))\b/i },
    { id: "task-lifecycle", w: 5, re: /\b(agent (finished|started|stopped)|task (complete|completed|finished|needs)|needs (operator )?(action|input|approval)|session (started|ended)|run complete)\b/i },
    { id: "agent-tool",     w: 4, re: /\b(opencode|codex|claude|hermes|aider|cline|goose|windsurf|langchain|crewai|autogen)\b/i },
    { id: "llm-vocab",      w: 3, re: /\b(skill|tool call|prompt|completion|token usage|context window|inference|embedding|toolchain)\b/i },
    { id: "markdown-out",   w: 3, re: /(^|\n)\s*#{2,4}\s+\S|\*\*[^*\n]{3,40}\*\*/ },
    { id: "task-id",        w: 3, re: /\b[A-Z]{2,4}-\d{3,}\b/ },
    // The corpus is Turkish, Japanese, German, Spanish, Korean and Chinese. An
    // English-only "task complete" rule demoted codex ("sohbet turu tamamlandı") and
    // cursor ("fertig") to work=0 even though both are genuine completion channels.
    { id: "task-lifecycle-i18n", w: 5, re: /(tamamland|完了|fertig|abgeschlossen|completado|listo|완료|完成|成功|sohbet turu|タスク)/i },
    // Thread/turn UUIDv7 identifiers are hard evidence of an agent session runtime.
    { id: "session-ids",    w: 5, re: /(Thread:\s*[0-9a-f][0-9a-f-]{18,}|Turn:\s*[0-9a-f][0-9a-f-]{18,}|[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12})/i },
    { id: "project-label",  w: 3, re: /(Proje:|Projekt:|Project:|Repo:|Workspace:)/i },
    // Learned from the hermes gateway: this is the vocabulary an agent RUNTIME uses
    // to announce itself and to solicit input. It was missing, so a live gateway on
    // the topic literally named "hermes" scored only 0.25 and failed the threshold.
    { id: "gateway-lifecycle", w: 6, re: /(gateway (online|shutting down|offline|restarting)|is restarting|back and ready|your current task will be interrupted)/i },
    { id: "agent-invite",      w: 5, re: /(send any message|try to resume|resume where you left off)/i },
    { id: "agent-deeplink", w: 4, when: function (c) { return /notifier|agent|\bai\b/i.test(String(c.click || "")) ? "agent deep link" : false; } },
    // Mainstream harnesses (Codex, Claude Code, Cursor, Windsurf, Zed) register their
    // own URL schemes and leak the working directory into click URLs. This is where
    // ordinary users misconfigure involuntarily - the notifier is a side effect of a
    // tool they already run, so the topic name is whatever they happened to pick.
    { id: "ide-deeplink",  w: 5, re: /(ai-notifier|codex|cursor|windsurf|claude|vscode|jetbrains|zed|continue|opencode):\/\//i },
    { id: "cwd-leak",      w: 4, re: /(cwd=|workspaceFolder=|\/Users\/[a-z0-9._-]+|\/home\/[a-z0-9._-]+)/i },
    { id: "model-vendor",   w: 3, when: function (c) { return c.vendorHit ? ("vendor " + c.vendorHit) : false; } }
  ];
  var AGENT_VENDORS = /(openai|anthropic|claude|gpt|codex|gemini|llama|qwen|mistral|deepseek|huggingface|ollama|langchain|astra|fable)/i;

  function analyzeAgent(msgs) {
    var blob = "", clicks = [], tags = [];
    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i] || {};
      blob += String(m.message || "") + "\n";
      if (m.click) clicks.push(String(m.click));
      if (m.attention) tags.push(String(m.attention));
      if (m.title) blob += String(m.title) + "\n";
      if (m.tags && m.tags.length) tags = tags.concat(m.tags.map(String));
    }
    var hay = blob + "\n" + clicks.join(" ") + "\n" + tags.join(" ");
    var vendorHit = (AGENT_VENDORS.exec(hay) || [])[0] || null;
    var ctx = { click: clicks.join(" "), vendorHit: vendorHit, blob: blob };

    var markers = [], total = 0;
    for (var r = 0; r < AGENT_RULES.length; r++) {
      var rule = AGENT_RULES[r], hit = false;
      try {
        if (rule.re) hit = rule.re.test(hay);
        else if (rule.when) hit = !!rule.when(ctx);
      } catch (e) { /* never break collection */ }
      if (hit) { markers.push(rule.id); total += rule.w; }
    }
    // WORK vs PRESENCE. A framework announcing its own gateway state proves an agent
    // EXISTS, not that it DID anything. Scoring boilerplate the same as task output
    // put hermes (8 templated "I restarted" lines, no work at all) at 0.94 - second
    // highest in the corpus. isAgent now requires at least one WORK marker.
    var WORK = { "task-lifecycle": 1, "task-lifecycle-i18n": 1, "session-ids": 1,
                 "project-label": 1, "tool-call": 1, "json-rpc": 1, "mcp": 1, "task-id": 1,
                 "markdown-out": 1, "ide-deeplink": 1, "cwd-leak": 1 };
    var workMarkers = markers.filter(function (m) { return WORK[m]; });
    var workScore = 0;
    for (var w = 0; w < workMarkers.length; w++) {
      for (var r2 = 0; r2 < AGENT_RULES.length; r2++) {
        if (AGENT_RULES[r2].id === workMarkers[w]) { workScore += AGENT_RULES[r2].w; break; }
      }
    }
    return {
      score: Math.round(Math.min(1, total / 16) * 100) / 100,
      work: Math.round(Math.min(1, workScore / 12) * 100) / 100,
      markers: markers,
      workMarkers: workMarkers,
      vendor: vendorHit,
      isAgent: workMarkers.length > 0 && total >= 8
    };
  }

  function vendorHits(text) {
    var out = [], low = String(text || "").toLowerCase();
    for (var k in VENDORS) {
      if (low.indexOf(k) >= 0) out.push(VENDORS[k]);
    }
    return out;
  }

  return {
    CATEGORY_META: CATEGORY_META,
    ANOMALY_CATS: ANOMALY_CATS,
    RULES: RULES,
    VENDORS: VENDORS,
    analyze: analyze,
    classify: classify,
    voice: detectVoice,
    VOICE_RULES: VOICE_RULES,
    structure: analyzeStructure,
    conversation: detectConversation,
    agent: analyzeAgent,
    AGENT_RULES: AGENT_RULES,
    computeMetrics: computeMetrics,
    vendorHits: vendorHits
  };
});
