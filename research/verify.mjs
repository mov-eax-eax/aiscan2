
import fs from 'node:fs';
const rows = fs.readFileSync('research/openalex_full.ndjson','utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
const R = [...new Map(rows.map(r=>[r.title.toLowerCase().replace(/\s+/g,' ').trim(), r])).values()];
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
  if (/Electronic Science and Technology/i.test(s)) return 'UESTC';
  if (/Beihang/i.test(s)) return 'Beihang';
  if (/Harbin Institute/i.test(s)) return 'HIT';
  if (/Sun Yat-sen/i.test(s)) return 'Sun Yat-sen';
  if (/Xidian/i.test(s)) return 'Xidian';
  if (/Beijing University of Posts/i.test(s)) return 'BUPT';
  if (/Xi'an Jiaotong/i.test(s)) return "Xi'an Jiaotong";
  return null;
};
const top = new Set(['CAS institutes','Tsinghua','UESTC','Nanjing U','Zhejiang','SJTU','Beihang','HIT','Sun Yat-sen','Fudan','BUPT',"Xi'an Jiaotong"]);
let ge2 = 0, ge1 = 0;
for (const r of R) {
  const c = new Set(r.cn.map(canon).filter(x=>x && top.has(x)));
  if (c.size >= 1) ge1++;
  if (c.size >= 2) ge2++;
}
console.log('papers with >=1 top-12 inst:', ge1, 'with >=2:', ge2, 'of', R.length);
const survey = R.filter(r=>/survey|review/i.test(r.title)).length;
console.log('surveys', survey);
const llm = R.filter(r=>/large language|llm|lora|low-rank|instruction|prompt/i.test(r.title+' '+r.kw.join(' '))).length;
console.log('llm-ish', llm, (100*llm/R.length).toFixed(1));
