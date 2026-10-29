# Continual Learning from China — 2025–2026 Field Map

*Companion reading list to `continual-learning-china-2025-26.png`. Snapshot date: 17 Oct 2026. All links are arXiv or publisher DOI.*

## What the corpus says

Built from OpenAlex: works whose title/abstract contains "continual learning", primary field Computer Science, at least one mainland-China institution among the authors, published 2025-01-01 → 2026-10-17. **1,009 records matched** (1,333 phrase matches across all fields); **956 unique titles** analysed.

- **531 works in 2026 (Jan–Oct) vs 425 across all of 2025** — the output is accelerating.
- **~30% are LLM-centric** (31.5% in 2026 vs 27.5% in 2025), but vision is still the largest single lane (~300 works).
- **Replay lost the frontier**: 148 works still replay, while capacity-allocation methods dominate — LoRA/PEFT 150, regularisation 94, architecture 92, merging 24.
- **Median citations = 0** (651 of 956 uncited): this frontier is pre-consensus, not settled science. 29 surveys/reviews exist, 184 works are arXiv preprints.
- **Theory is thin (~6% of the corpus)** but sharpening: pacing laws, NTK generalisation gaps, closed-form buffer results. "China leads CL theory" is not supportable; "China leads CL volume and benchmark infrastructure, with a fast-growing theory wing" is.

## The twelve spotlights

| # | Paper | Lab | Venue | Link |
|---|-------|-----|-------|------|
| 1 | PaLoRA: Paced Low-Rank Adaptation — derives step-size law s* = √(R/c) under null-space projection | Peking U + CAS IoA | arXiv, Oct 2026 | https://arxiv.org/abs/2610.04226 |
| 2 | CoDe-LoRA — names the "orthogonality dilemma", partial isolation + semantic routing | BUPT | arXiv, Oct 2026 | https://arxiv.org/abs/2610.08312 |
| 3 | SVC: singular-vector channels as the unit of stability/plasticity | Beihang + CAS ICT | arXiv, Oct 2026 | https://arxiv.org/abs/2610.11076 |
| 4 | LoRA Subtraction (drift-resistant space) — exemplar-free CL without old-task statistics | Sun Yat-sen U | CVPR 2025 | https://doi.org/10.1109/cvpr52734.2025.01426 |
| 5 | SMoLoRA — dual forgetting in continual visual instruction tuning, separable MoE LoRA | Hefei UT + Tsinghua | ICCV 2025 | https://doi.org/10.1109/iccv51701.2025.00024 |
| 6 | Monarch-MoE — block-diagonal LoRA experts, blockwise gradient isolation | CAS ICT + UCAS + ShanghaiTech | arXiv, Oct 2026 | https://arxiv.org/abs/2610.13215 |
| 7 | TSRL — RL backbone + SFT only on failure states, bounded cumulative updates | CAS Institute of Automation | arXiv, Oct 2026 | https://arxiv.org/abs/2610.17726 |
| 8 | Hippocam — intent-structured hierarchical memory for lifelong agents | CAS IIE + UCAS | arXiv, Oct 2026 | https://arxiv.org/abs/2610.12124 |
| 9 | EmbodiedCLBench — first embodied continual-learning benchmark | Peking U + BIGAI | arXiv, Oct 2026 | https://arxiv.org/abs/2610.13021 |
| 10 | One-for-More — continual diffusion for anomaly detection via gradient projection + iterative SVD | ECNU + Xiamen U + Tencent | CVPR 2025 | https://doi.org/10.1109/cvpr52734.2025.00449 |
| 11 | CH-HNN — corticohippocampal ANN+SNN circuit for task-agnostic CL | Tsinghua | Nature Communications 2025 | https://doi.org/10.1038/s41467-025-56405-9 |
| 12 | GIFT — diffusion-generated synthetic replay for continual VLMs | Wuhan U + CAS IoA | CVPR 2025 | https://doi.org/10.1109/cvpr52734.2025.00268 |

## Also on the radar

| Paper | Lab | Venue | Link |
|-------|-----|-------|------|
| ChainLoRA: geometry-preserving task-vector merging | SJTU + HUST | arXiv, Sep 2026 | https://arxiv.org/abs/2610.00431 |
| Continual gradient low-rank projection (GORP line) | Beijing Jiaotong U | ACL 2025 | https://arxiv.org/abs/2507.02503 |
| Knowledge in Superposition: why lifelong editing fails | CAS IoA | AAAI 2025 | https://arxiv.org/abs/2408.07413 |
| Forgetting worsens with scale (1B–14B) — the empirical baseline | Westlake U + Tencent | TASLP 2025 | https://arxiv.org/abs/2308.08747 |
| Beyond Forgetting: continual RLVR | PKU + BIGAI + BIT | arXiv, Aug 2026 | https://arxiv.org/abs/2608.18574 |
| CMT: memory compression for continual knowledge learning | HIT | AAAI 2025 | https://arxiv.org/abs/2412.07393 |
| GainLoRA: gated LoRA integration for CL | Nanjing U | NeurIPS 2025 | https://arxiv.org/abs/2505.15424 |
| NTK theory of PEFT continual learning | Tianjin U + Zhejiang U | TPAMI 2026 | https://arxiv.org/abs/2407.17120 |
| A memory buffer does not inherently reduce forgetting | HUST/SYSU/NUDT | Neural Networks 2025 | https://doi.org/10.1016/j.neunet.2025.108522 |
| Cumulative-error bound for noisy drifting streams | SJTU + Nanjing U | TPAMI 2025 | https://doi.org/10.1109/tpami.2025.3643174 |
| EFRE: evolving prompt repertoires | CUHK-SZ + USTC + Shanghai AI Lab | arXiv, Oct 2026 | https://arxiv.org/abs/2610.11373 |
| DP-SPA: differentially private continual LoRA | Tianjin U + Xidian | arXiv, Oct 2026 | https://arxiv.org/abs/2610.17904 |
| Mind the Gap: CLIP modality gap in CL | Nankai U | ICCV 2025 | https://doi.org/10.1109/iccv51701.2025.00360 |
| Proof: projection fusion for VLMs (56 cites) | Nanjing U (LAMDA) | TPAMI 2025 | https://arxiv.org/abs/2305.19270 |
| CL-MoE: dual momentum experts for continual VQA | ECNU | CVPR 2025 | https://arxiv.org/abs/2503.00413 |
| RIFAR: forgetting-aware replay for robots | Tsinghua + Zhejiang U | arXiv, Oct 2026 | https://arxiv.org/abs/2610.03079 |
| CL-VISTA: video-LLM continual benchmark | CAS IoA | arXiv, 2026 | https://arxiv.org/abs/2604.00677 |
| Model merging in LLMs/MLLMs: survey | Sun Yat-sen U | ACM CSUR 2026 | https://arxiv.org/abs/2408.07666 |
| ENGINE: re-inject external knowledge for CLIP-CIL | Nanjing U (LAMDA) | ICCV 2025 | https://arxiv.org/abs/2503.08510 |

## Where to start (a PhD reading path)

1. **Frames:** *A Comprehensive Survey of Continual Learning* (TPAMI 2024, 1,087 cites) — https://arxiv.org/abs/2302.00487; multimodal CL survey (TNNLS 2026) — https://doi.org/10.1109/tnnls.2026.3658485; lifelong LLM survey (ACM CSUR 2025) — https://arxiv.org/abs/2406.06391.
2. **Benchmark that measures capabilities:** UCIT, MLLM-DCL, CL-VISTA, EmbodiedCLBench.
3. **Mechanism:** subspace geometry has the most theoretical traction (PaLoRA, SVC, CoDe-LoRA); block-diagonal experts the most hardware reality (Monarch-MoE); agent memory the least explored (Hippocam, TSRL, EmbodiedCLBench).

## Caveats

- **Preprint-heavy:** nine of the twelve spotlights are 2026 arXiv preprints with 0 citations — "latest" means freshness and mechanism novelty, not uptake. No ICLR/ICML 2026 proceedings are indexed for these ids.
- **Counts are multi-label** (one paper can be vision and LLM), so shares overlap and do not sum to 100%.
- **January buckets are inflated** by OpenAlex 1-January issue dates; treat monthly peaks as upper bounds. Yearly totals are the safer signal.
- **Citations are a snapshot** (OpenAlex, 17 Oct 2026) and near-zero for 2026 preprints. Do not rank across tracks by citations.
- **Affiliation rule:** any mainland-China institution on the author list, not necessarily first author; a few papers have non-mainland first authors with mainland majorities.
- Verified records and raw data: `research/vision.json`, `research/llm.json`, `research/theory.json`, `research/openalex_full.ndjson`.
