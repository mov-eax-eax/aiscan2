# Continual Learning in Vision, Multimodal, Generative and Embodied Models — China, 2025–2026

Scope: vision, VLM/MLLM, diffusion/generative, robotics/embodied, and pre-trained-model-based CL / PEFT / model merging, from mainland-China groups. 14 records, each verified against OpenAlex, the DOI resolver and/or arXiv (abs/HTML); citation counts are OpenAlex as of 2026-10-17. Detail and verification URLs are in `vision.json`.

## Synthesis — where the vision-side frontier is

- **The field has split into three tracks, with a fourth opening in late 2026.** Track 1 is frozen-backbone class-incremental learning on CLIP/VLMs (Proof, ENGINE, LoRA Subtraction, GIFT). Track 2 is continual instruction tuning of multimodal LLMs (CL-MoE, SMoLoRA, CIT-LMM, Monarch-MoE, MERA). Track 3 is generative CL — diffusion anomaly detection and text-to-image customization (One-for-More, MuseumMaker). Track 4 is embodied continual learning (EmbodiedCLBench, RIFAR), which only has preprints so far but is where the 2026 energy is. A 2025 CVPR/ICCV paper about "continual learning" usually means track 1; by October 2026 the strongest signals are in tracks 2 and 4.

- **PEFT has displaced replay as the default for VLM CL.** In this sample, 5 of 14 records are LoRA-family, 2 are MoE-architecture, 1 prompt-based, and only 2 are replay — and both replay papers replay *synthetic* or *regenerated* experience (GIFT with a text-to-image model, RIFAR with a world-action model), not stored exemplars. The reason is structural: CLIP/MLLM backbones are frozen, so the learnable object is a small adapter, and the design question becomes how to allocate adapters (routing, subspaces, merging) rather than how to budget a memory buffer.

- **The MoE-LoRA line shows the clearest 2025→2026 trajectory.** CL-MoE (CVPR 2025) isolates tasks at the *routing* level with task-level and instance-level routers plus momentum expert updates. SMoLoRA (ICCV 2025) splits routing by *capability* — one module for visual understanding, one for instruction following — because continual visual instruction tuning damages both. Monarch-MoE (arXiv, Oct 2026) moves to *parameter* level: block-diagonal (Monarch) factors give blockwise gradient isolation, i.e. one block-pair update touches exactly one output block, while cutting adapter parameters by ~50–75% and running on a single 24 GB GPU. The direction is unmistakable: from "choose which expert" to "make the expert's update mathematically local".

- **"Protect the weights" is giving way to "re-supply the knowledge".** ENGINE (ICCV 2025) argues CLIP-CIL erases fine-grained context and fixes it by injecting external visual augmentation plus GPT-4-rewritten class descriptors, with inference-time re-ranking; GIFT regenerates the *pre-training* distribution with diffusion and distils on it; CIT-LMM shows task-similarity priors can drive regularization and expansion. The shared premise is that the information lost during continual updates is often not recoverable from the model — so an external generator or LLM must put it back. This reframes CLIP-CIL as a knowledge-supply and inference-time problem, not only a weight-constraint problem.

- **Forgetting is being redefined at the capability level, not the class level.** SMoLoRA names *dual* forgetting (visual understanding + instruction following). MERA identifies misalignment between modality-agnostic and modality-specific components as a second, distinct failure in modality-incremental MLLMs. EmbodiedCLBench evaluates *compositional generalization* from basic skills to unseen advanced tasks. This matters for the infographic: the classical "accuracy on old classes" axis no longer captures what these papers are optimizing, and the newer metrics (instruction robustness, backward relative gain, skill recomposition) are not yet standardized.

- **Generative CL is real but narrowly scoped.** One-for-More (CVPR 2025) makes a diffusion anomaly detector continual with gradient projection plus an iterative-SVD trick that avoids storing Markov-chain activations — first place in 17/18 continual settings. MuseumMaker (TIP 2025) makes text-to-image style customization continual with a shared LoRA, style distillation against content bias, and per-style token anchors. Both are *applied* generative CL; there is no general-purpose continual diffusion/flow LLM from a Chinese group in this window, so the "continual generative foundation model" slot on the frontier map is still open.

- **Theory is arriving, but only for linearized LoRA.** PaLoRA (Oct 2026) shows that even under null-space projection, finite-precision updates leak into prior-task subspaces, and derives a pacing law s* = sqrt(R/c) — restrict gradient magnitude in proportion to the square root of the effective rank of accumulated knowledge — replacing the universal "use a small learning rate" heuristic, with +4% on 50-task ImageNet-A/R. Nothing comparable exists yet for MoE routing, prompt banks or diffusion; those remain empirical.

- **Merging is becoming the cheap end of the CL spectrum.** MERA merges a new modality branch then re-aligns, reaching 99.84% backward relative gain when extending an MLLM to four modalities with no architectural change; LoRA Subtraction uses task-vector arithmetic (subtract old LoRA deltas) to build a drift-resistant space without exemplars. The boundary between "continual learning" and "model merging" is blurring precisely because both now operate on task-vector/adapter arithmetic — expect this to be a definitional problem for any 2026 taxonomy.

- **Embodied CL is the newest frontier and the most honest about failure.** RIFAR shows generative replay for robot policies needs reliability screening (a frozen inverse-dynamics model filters physically unrealizable world-model rollouts) and drift-aware trajectory selection, reaching 90.97 AUC on LIBERO-Goal at ~4.9% of the replay storage of 50-demonstration replay. EmbodiedCLBench then reports the deflationary result: basic-task experience helps consistently and stably under rising complexity, but the benefit does *not* scale with more learning samples — current agents cannot extract information from additional experience. That is a direct challenge to "self-evolving agent" narratives.

- **Division of labour across Chinese groups is now legible.** Nanjing LAMDA (Zhou / Ye / Zhan) owns the CLIP-CIL baseline and the external-knowledge-injection line; ECNU owns MLLM-MoE continual VQA and diffusion anomaly detection; CAS (Institute of Automation, Institute of Computing Technology, Shenyang Institute of Automation) owns LMM instruction-tuning benchmarks, structured experts, and generative style customization; HIT Shenzhen owns modality-incremental merging; PKU + BIGAI own embodied evaluation and LoRA pacing theory; SYSU and DUT own exemplar-free LoRA/PEFT; Wuhan University owns synthetic-replay for VLMs. The "who owns what" map is institutionally stable across 2025 and 2026.

## Open problems visible from this slice

1. **No shared benchmark** spans frozen-VLM CIL, MLLM instruction tuning, diffusion and embodied agents; CIT-LMM, SMoLoRA and EmbodiedCLBench each define their own protocol.
2. **Compute-honest evaluation** is only starting: Monarch-MoE's single-24 GB-GPU constraint is the exception, not the norm.
3. **Non-accuracy forgetting** (instruction following, safety behaviour, style fidelity) is measured ad hoc at best.
4. **Theory stops at linear adapters** — no analysis for routing, merging interference, or leakage in diffusion denoisers.
5. **Synthetic replay inherits generator bias**; only RIFAR attempts an explicit reliability screen.
6. **Merging vs. CL** lacks a definitional boundary, which will complicate any 2026 survey or leaderboard.

## Records (14)

| # | Title | Lab / Chinese institution | Venue | Year | Family | Cites |
|---|-------|---------------------------|-------|------|--------|-------|
| 1 | Learning Without Forgetting for Vision-Language Models (Proof) | LAMDA, Nanjing University | TPAMI | 2025 | architecture | 56 |
| 2 | External Knowledge Injection for CLIP-Based CIL (ENGINE) | LAMDA, Nanjing University | ICCV | 2025 | prompt | 16 |
| 3 | CL-MoE: Dual Momentum MoE for Continual VQA | East China Normal University | CVPR | 2025 | architecture | 22 |
| 4 | SMoLoRA: Dual Catastrophic Forgetting in CVIT | Hefei University of Technology | ICCV | 2025 | lora | 4 |
| 5 | LoRA Subtraction for Drift-Resistant Space | Sun Yat-sen University | CVPR | 2025 | lora | 14 |
| 6 | Synthetic Data is an Elegant GIFT for Continual VLMs | Wuhan University | CVPR | 2025 | replay | 6 |
| 7 | One-for-More: Continual Diffusion Model for Anomaly Detection | East China Normal University | CVPR | 2025 | regularization | 27 |
| 8 | MuseumMaker: Continual Style Customization | CAS Shenyang Institute of Automation | TIP | 2025 | lora | 12 |
| 9 | Continual Instruction Tuning for Large Multimodal Models | CAS Institute of Automation | TIP | 2026 | benchmark | 4 |
| 10 | Merge then Realign (MERA) | HIT Shenzhen | EMNLP | 2025 | merging | 1 |
| 11 | Monarch-MoE: Structured Experts for Multimodal CIT | CAS Institute of Computing Technology | arXiv | 2026 | lora | 0 |
| 12 | EmbodiedCLBench | Peking University / BIGAI | arXiv | 2026 | benchmark | 0 |
| 13 | PaLoRA: Paced Low-Rank Adaptation | Peking University / CAS IA | arXiv | 2026 | lora | 0 |
| 14 | RIFAR: Reliability and Forgetting-Aware Replay for Robot Learning | Tsinghua / Zhejiang University | arXiv | 2026 | replay | 0 |

## Caveats

- Citation counts are OpenAlex values retrieved 2026-10-17; the four Oct-2026 preprints are at 0 and will move. Citations are not comparable across tracks (a 2025 TIP paper and an Oct-2026 preprint cannot be ranked by this number).
- Records 11–14 are arXiv preprints, not peer-reviewed; records 1–10 are published (TPAMI/ICCV/CVPR/TIP/EMNLP) and verified through DOI-resolving OpenAlex records.
- Three dates are year-level only because that is the granularity the indexing source provides: MuseumMaker (TIP 2025), CIT-LMM (TIP 2026), MERA (EMNLP 2025). All other dates are the publisher/arXiv date.
- Affiliation claims were cross-checked against arXiv HTML front matter wherever an HTML version exists; this corrected several OpenAlex name errors (e.g. MuseumMaker's first author is Chenxi Liu, not "Changlan Liu"; RIFAR's first author is Zirui Song). Two papers have non-mainland first authors but a mainland majority: Proof (NTU Singapore co-authors) and RIFAR (first author at MBZUAI, 5 of 7 authors at Tsinghua/Zhejiang).
- Deliberately excluded: single-China-co-author papers (e.g. *Continual Humanoid Motion Learning*, first author NYU Abu Dhabi), survey/position papers, and domain-specific incremental fault-diagnosis work that dominates OpenAlex volume but is not at the vision-CL frontier.
