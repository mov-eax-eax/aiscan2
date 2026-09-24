/* Shared topic engine: one source of truth for Node (collector, scan) and the browser (ui). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NtfyTopics = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var HOT = ["ai","bot","agent","llm","gpt","chat","chatgpt","claude","gemini","copilot",
    "assistant","model","prompt","token","mcp","swarm","fleet","peer","relay","bridge","bus",
    "hub","mesh","mailbox","inbox","outbox","rendezvous","discovery","signal","beacon",
    "orchestrator","worker","runner","queue","session","thread","context","test","alerts",
    "notifications","notify","system","internal","server","vps","nas","node","host","docker",
    "k8s","cluster","deploy","build","ci","monitor","health","metrics","backup","sync","job",
    "cron","prod","dev","logs","log","debug","ping","status","update","info","data","msg",
    "message","main","general","random","work","news","hook","webhook","event","phone",
    "mypc","laptop","desktop","home","house","office","cam","camera","door","sensor","esp32",
    "arduino","rpi","tablet","watch","router","me","hi","yo","ok","hello","sup","hey","tmp",
    "temp","foo","bar","baz","abc","misc","stuff","things","todo","lol","wtf","omg","yes",
    "no","new","old","dm","sms","call","family","friends","team","group","private","secret",
    "public","shared","common"];

  var MODS = ["internal","private","secret","hidden","common","shared","public","global",
    "main","core","base","default","dev","prod","test","staging","debug","alpha","beta",
    "edge","local","remote","central","master","primary","backup","old","new","v1","v2",
    "tmp","real","live"];

  var NUMS = ["1","2","3","4","5","6","7","8","9","0","01","02","03","10","11","12","13",
    "21","23","42","69","77","88","99","100","111","123","1234","007","420","1337","2024",
    "2025","2026","24","25","26","666","777","888"];

  var DEVICE_HEADS = ["my","your","our","the","a"];
  var DEVICE_TAILS = ["phone","pc","laptop","desktop","server","home","house","office",
    "cam","camera","door","garage","light","sensor","watch","tablet","tv","printer","router",
    "nas","pi","box","station","rig","machine","workstation","nuc","mac","imac","windows","linux"];

  var SHORT_ALPHA = "abcdefghijklmnopqrstuvwxyz".split("");
  var SHORT_PAIRS = ["aa","bb","cc","xx","zz","qq","ab","ac","xy","yx","11","22","33","00",
    "1a","a1","2b","b2","x1","y1","z1","9x","x9","ok","up","on","in","it","go","no"];
  var COMM_PAIRS = ["ai","bot","agent","llm","chat","msg","ping","relay","hub","node",
    "test","link","peer"];

  function generateTopics() {
    var out = [], seen = {};
    function add(t) {
      if (t == null) return;
      t = String(t).toLowerCase().trim();
      if (t.length < 1 || t.length > 64) return;
      if (!/^[a-z0-9][a-z0-9._-]*$/.test(t)) return;
      if (seen[t]) return;
      seen[t] = 1;
      out.push(t);
    }

    var families = [];
    function fam(w, items) { families.push({ w: w, items: items }); }

    fam(134, HOT.slice());

    var dev = [];
    DEVICE_HEADS.forEach(function (h) {
      DEVICE_TAILS.forEach(function (t) { dev.push(h + t, h + "-" + t); });
    });
    fam(40, dev);

    fam(43, NUMS.slice());
    fam(56, SHORT_ALPHA.concat(SHORT_PAIRS));

    var small = ["1", "2", "3", "01", "123", "007", "42"];
    var numHedge = [];
    HOT.slice(0, 70).forEach(function (w) {
      small.forEach(function (n) { numHedge.push(w + n, w + "-" + n); });
    });
    fam(60, numHedge);

    var modWord = [];
    MODS.forEach(function (m) {
      HOT.slice(0, 45).forEach(function (w) { modWord.push(m + "-" + w, w + "-" + m, m + "_" + w); });
    });
    fam(50, modWord);

    var pairs = [];
    COMM_PAIRS.forEach(function (a) {
      COMM_PAIRS.forEach(function (b) { pairs.push(a + "-" + b, a + b); });
    });
    fam(30, pairs);

    var xSuf = [];
    HOT.slice(0, 70).forEach(function (w) {
      ["x", "xx", "xxx", "2", "3k", "01", "02"].forEach(function (s) { xSuf.push(w + s); });
    });
    fam(20, xSuf);

    var fullNum = [];
    HOT.slice(0, 70).forEach(function (w) {
      NUMS.forEach(function (n) { fullNum.push(w + n, w + "-" + n, w + "_" + n); });
    });
    fam(80, fullNum);

    var hexHedge = [];
    for (var i = 0; i < 360; i++) {
      var h = ((i * 2654435761) >>> 0).toString(16).slice(0, 2 + (i % 3));
      hexHedge.push(HOT[i % HOT.length] + "-" + h, HOT[(i * 7) % HOT.length] + h);
    }
    fam(15, hexHedge);

    var cursors = families.map(function () { return 0; });
    var progressed = true;
    while (progressed) {
      progressed = false;
      for (var fi = 0; fi < families.length; fi++) {
        var f = families[fi];
        for (var k = 0; k < f.w && cursors[fi] < f.items.length; k++) {
          add(f.items[cursors[fi]++]);
          progressed = true;
        }
      }
    }
    return out;
  }

  var CLASSIFIERS = [
    ["ai-relay", /\b(summar|notion|auth|re-?read|translat|assistant|let me|working on|analy[sz]|prompt|content|reconstruct)\b/i],
    ["ops", /\b(cron|ssh|login|backup|deploy|disk|memory|cpu|uptime|restart|failed|error|alert|health|billing|invoice|subscription|expires?)\b/i],
    ["news", /\b(breaking|news|rss|headline|nhk|bbc|cnn|weather|forecast|sports|score)\b/i],
    ["personal", /\b(remind|birthday|appointment|mom|dad|wife|husband|love|dinner|pickup)\b/i]
  ];

  function classify(msgs) {
    var blob = "";
    for (var i = 0; i < msgs.length && i < 20; i++) blob += (msgs[i].message || "") + " ";
    if (!blob.trim()) return "empty";
    for (var c = 0; c < CLASSIFIERS.length; c++) {
      if (CLASSIFIERS[c][1].test(blob)) return CLASSIFIERS[c][0];
    }
    return "noise";
  }

  function entropyBits(topic) {
    var alphabet = 0;
    if (/[a-z]/.test(topic)) alphabet += 26;
    if (/[0-9]/.test(topic)) alphabet += 10;
    if (/-_./.test(topic)) alphabet += 3;
    if (alphabet === 0) return 0;
    return Math.round(topic.length * Math.log(alphabet) / Math.log(2));
  }

  function validateTopic(t) {
    return typeof t === "string" && /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(t);
  }

  return {
    generateTopics: generateTopics,
    classify: classify,
    entropyBits: entropyBits,
    validateTopic: validateTopic,
    HOT: HOT
  };
});
