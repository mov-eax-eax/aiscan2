
import fs from 'node:fs';
const rows = fs.readFileSync('research/openalex_full.ndjson','utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
const R = [...new Map(rows.map(r=>[r.title.toLowerCase().replace(/\s+/g,' ').trim(), r])).values()];
for (const re of [/Synthetic Data is an Elegant GIFT/i, /RIFAR/i]) {
  const w = R.find(r=>re.test(r.title));
  if (!w) { console.log('MISS', re); continue; }
  console.log('===', w.title, '|', w.date, '|', (w.cn||[]).join('; '), '|', w.venue, '|', w.url);
  console.log(w.abstract.slice(0,1000), '\n');
}
