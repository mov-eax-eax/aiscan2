
import fs from 'node:fs';
for (const f of ['llm','theory','vision']) {
  const arr = JSON.parse(fs.readFileSync('research/'+f+'.json','utf8'));
  console.log('\n### '+f+' ('+arr.length+')');
  for (const r of arr) console.log('- '+r.title+' | '+(r.lab||r.chinese_institution||'?')+' | '+(r.venue||'')+' | '+(r.date||r.year||'')+' | '+(r.arxiv_id?('arXiv '+r.arxiv_id):'')+' | '+(r.url||'')+' | basis0='+((r.basis&&r.basis[0])||''));
}
