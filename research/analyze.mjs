
import fs from 'node:fs';
const rows = fs.readFileSync('research/openalex_full.ndjson','utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
const uniq = new Map(); for (const r of rows) uniq.set(r.title.toLowerCase().replace(/\s+/g,' ').trim(), r);
const R = [...uniq.values()];
const canon = (s) => {
  if (!s) return null;
  if (/Chinese Academy of Sciences|Institute of Automation|Institute of Computing Technology|Shenzhen Institutes of Advanced Technology|Institute of Software|Institute of Information Engineering|Shanghai Institute of Microsystem/i.test(s)) return 'CAS institutes';
  if (/University of Chinese Academy of Sciences/i.test(s)) return 'UCAS';
  if (/Tsinghua/i.test(s)) return 'Tsinghua';
  if (/Peking University/i.test(s)) return 'Peking U';
  if (/Zhejiang/i.test(s)) return 'Zhejiang';
  if (/Shanghai Jiao Tong/i.test(s)) return 'SJTU';
  if (/Fudan/i.test(s)) return 'Fudan';
  if (/Nanjing University/i.test(s)) return 'Nanjing U';
  if (/University of Science and Technology of China/i.test(s)) return 'USTC';
  if (/Electronic Science and Technology/i.test(s)) return 'UESTC';
  if (/Beihang/i.test(s)) return 'Beihang';
  if (/Harbin Institute/i.test(s)) return 'HIT';
  if (/Xidian/i.test(s)) return 'Xidian';
  if (/Beijing University of Posts/i.test(s)) return 'BUPT';
  if (/Sun Yat-sen/i.test(s)) return 'Sun Yat-sen';
  if (/Southeast University/i.test(s)) return 'Southeast U';
  if (/National University of Defense/i.test(s)) return 'NUDT';
  if (/Chinese University of Hong Kong/i.test(s)) return 'CUHK-Shenzhen';
  if (/Hong Kong University of Science/i.test(s)) return 'HKUST';
  if (/Xi'an Jiaotong/i.test(s)) return 'Xi-an Jiaotong';
  if (/Nankai/i.test(s)) return 'Nankai';
  return null;
};
const cnt = (xs) => { const m = new Map(); for (const x of xs) if (x) m.set(x,(m.get(x)||0)+1); return [...m.entries()].sort((a,b)=>b[1]-a[1]); };
const inst = cnt(R.flatMap(r=>r.cn.map(canon).filter(Boolean)));
const month = cnt(R.map(r=>r.date.slice(0,7))).sort((a,b)=>a[0].localeCompare(b[0]));
const t = (r)=> r.title+' '+r.kw.join(' ');
const buckets = {
  llm_peft: r=>/large language|llm|lora|low-rank|instruction|prompt tuning|in-context/i.test(t(r)),
  vision: r=>/image|visual|vision|video|\bclip\b|class-incremental|object recognition/i.test(t(r)),
  multimodal: r=>/multimodal|multi-modal|vision-language|mllm/i.test(t(r)),
  generative: r=>/diffusion|generat|synthesis/i.test(t(r)),
  federated: r=>/federated|decentral|edge devices/i.test(t(r)),
  theory: r=>/theor|bound|generaliz|convergence|analys|scaling/i.test(t(r)),
  benchmark_survey: r=>/benchmark|survey|review|toolbox|dataset/i.test(t(r)),
  agent_rl: r=>/agent|embodied|robot|reinforcement|decision/i.test(t(r)),
  graph_ts_rec: r=>/graph|time series|node|recommend/i.test(t(r)),
};
const method = {
  replay: r=>/replay|rehearsal|exemplar|memory buffer/i.test(t(r)),
  lora_peft: r=>/lora|low-rank|adapter|parameter-efficient|peft/i.test(t(r)),
  prompt: r=>/prompt/i.test(t(r)),
  distillation: r=>/distill/i.test(t(r)),
  regularization: r=>/regulariz|ewc|elastic weight|orthogon|penalt/i.test(t(r)),
  architecture: r=>/architecture|expansion|mixture.of.experts|\bmoe\b|hypernetwork|modul/i.test(t(r)),
  merging: r=>/merg/i.test(t(r)),
  moe: r=>/mixture.of.experts|\bmoe\b/i.test(t(r)),
};
const out = { n: R.length, months: month, inst: inst.slice(0,22), buckets: Object.fromEntries(Object.entries(buckets).map(([k,f])=>[k,R.filter(f).length])), method: Object.fromEntries(Object.entries(method).map(([k,f])=>[k,R.filter(f).length])) };
fs.writeFileSync('research/stats.json', JSON.stringify(out,null,1));
console.log('N', R.length);
console.log('MONTH', month.map(x=>x.join(':')).join(' '));
console.log('INST', inst.slice(0,16).map(x=>x.join(':')).join(' | '));
console.log('BUCKETS', JSON.stringify(out.buckets));
console.log('METHOD', JSON.stringify(out.method));
const recent = R.filter(r=>r.date>='2025-09');
console.log('\n#### VENUE MIX (recent, non-arXiv)');
console.log(cnt(recent.map(r=>r.venue).filter(v=>v && !/arxiv|ssrn|research square|underline/i.test(v))).slice(0,14).map(x=>x.join(':')).join(' | '));
const themes = {
  'A LLM LoRA geometry': /lora|low-rank|subspace|singular|orthogon|gradient conflict/i,
  'B MLLM VLM': /multimodal|multi-modal|vision-language|mllm|\bclip\b/i,
  'C agents embodied memory': /agent|embodied|robot|memory consolidation/i,
  'D diffusion generative': /diffusion|generative|synthesis/i,
  'E theory bench survey': /theor|bound|survey|benchmark|toolbox|review/i,
  'F MoE merging hypernet': /mixture.of.experts|\bmoe\b|merg|hypernetwork/i,
};
for (const [name,re] of Object.entries(themes)) {
  const cand = R.filter(r=>re.test(t(r)) && r.date>='2025-06').sort((a,b)=>(b.cit-a.cit)||b.date.localeCompare(a.date));
  console.log('\n########## '+name+' ('+cand.length+')');
  for (const w of cand.slice(0,10)) {
    console.log('- '+w.date+' | '+w.title.slice(0,115)+' | '+(w.cn[0]||'?')+' | '+w.venue.slice(0,26)+' | c'+w.cit);
    console.log('   '+w.url);
  }
}
