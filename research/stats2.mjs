
import fs from 'node:fs';
const rows = fs.readFileSync('research/openalex_full.ndjson','utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
const R = [...new Map(rows.map(r=>[r.title.toLowerCase().replace(/\s+/g,' ').trim(), r])).values()];
const t = r => r.title+' '+r.kw.join(' ');
const fam = [
  ['CVPR', r=>/computer vision and pattern recognition|cvpr/i.test(r.venue)||/cvpr\d/i.test(r.doi||'')],
  ['ICCV', r=>/international conference on computer vision|iccv/i.test(r.venue)||/iccv\d/i.test(r.doi||'')],
  ['AAAI', r=>/aaai/i.test(r.venue)||/aaai\./i.test(r.doi||'')],
  ['NeurIPS', r=>/neural information processing systems/i.test(r.venue)],
  ['ICLR/ICML', r=>/learning representations|international conference on machine learning/i.test(r.venue)],
  ['ACL/EMNLP/NAACL', r=>/association for computational linguistics|empirical methods in natural language/i.test(r.venue)],
  ['ACM MM', r=>/acm international conference on multimedia/i.test(r.venue)],
  ['KDD/WWW', r=>/knowledge discovery|web conference|www/i.test(r.venue)],
  ['TPAMI', r=>/pattern analysis and machine intelligence/i.test(r.venue)],
  ['TIP/TNNLS/TCSVT', r=>/image processing|neural networks and learning systems|circuits and systems for video/i.test(r.venue)],
  ['Pattern Recognition/Neurocomputing', r=>/pattern recognition|neurocomputing|neural networks/i.test(r.venue)],
  ['arXiv preprint', r=>/arxiv/i.test(r.venue)],
];
const famCounts = fam.map(([n,f])=>[n, R.filter(f).length]).sort((a,b)=>b[1]-a[1]);
console.log('VENUE FAMILIES:', famCounts.map(x=>x.join(':')).join(' | '));
const byYear = {2025: R.filter(r=>r.date<'2026'), 2026: R.filter(r=>r.date>='2026')};
console.log('YEAR', Object.fromEntries(Object.entries(byYear).map(([k,v])=>[k,v.length])));
const llm = r=>/large language|llm|lora|low-rank|instruction|prompt/i.test(t(r));
for (const [y,arr] of Object.entries(byYear)) console.log('LLM share', y, (100*arr.filter(llm).length/arr.length).toFixed(1)+'%');
const arxiv = R.filter(r=>/arxiv/i.test(r.venue)).length;
console.log('arxiv preprints', arxiv, 'surveys', R.filter(r=>/survey|review/i.test(r.title)).length);
console.log('with CN 1st author? n/a; median citations', R.map(r=>r.cit).sort((a,b)=>a-b)[Math.floor(R.length/2)]);
console.log('zero-cited', R.filter(r=>r.cit===0).length);
const q1 = R.filter(r=>r.cit>=10).length; console.log('cited>=10', q1);
// recent 90 days momentum
const cutoff='2026-07-17';
console.log('last 90d', R.filter(r=>r.date>=cutoff).length);
const recent = R.filter(r=>r.date>=cutoff);
console.log('last90d LLM share', (100*recent.filter(llm).length/recent.length).toFixed(1)+'%');
const topInst = (rs)=> { const m=new Map(); for(const r of rs) for(const c of new Set(r.cn)) m.set(c,(m.get(c)||0)+1); return [...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(x=>x.join(':')); };
console.log('TOPINST recent:', topInst(recent).join(' | '));
fs.writeFileSync('research/stats2.json', JSON.stringify({famCounts, byYear: Object.fromEntries(Object.entries(byYear).map(([k,v])=>[k,v.length])), arxiv, surveys: R.filter(r=>/survey|review/i.test(r.title)).length, total: R.length}, null, 1));
