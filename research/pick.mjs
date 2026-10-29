
import fs from 'node:fs';
const rows = fs.readFileSync('research/openalex_full.ndjson','utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
const R = [...new Map(rows.map(r=>[r.title.toLowerCase().replace(/\s+/g,' ').trim(), r])).values()];
const picks = [
  /LoRA Subtraction/i, /Proactive Low-Rank Allocation/i, /dual catastrophic forgetting/i, /Analyzing and Reducing Catastrophic Forgetting in Parameter/i,
  /CoDe-LoRA/i, /PaLoRA/i, /Stable-Plastic Subspace/i, /condition-anchored distillation/i, /From a Prompt to Repertoires/i,
  /Use and Disuse/i, /CL-MoE/i, /Mind the Gap/i, /Monarch-MoE/i, /EmbodiedCLBench/i, /TSRL/i, /One-for-More/i,
  /Learning Without Forgetting for Vision-Language Models/i, /Hybrid neural networks for continual learning/i, /Knowledge Interaction in Hypernetwork/i,
  /Stability-Plasticity Balance via Singular-Vector/i, /Continual Humanoid Motion/i, /SLCA\+\+/i
];
for (const re of picks) {
  const w = R.find(r=>re.test(r.title));
  if (!w) { console.log('MISS', re); continue; }
  console.log('\n=== ' + w.date + ' | ' + w.title + '\nLAB: ' + (w.cn||[]).join('; ') + '\nVENUE: ' + w.venue + ' | cit ' + w.cit + '\nURL: ' + w.url + '\nABS: ' + w.abstract.slice(0,1150));
}
