# Continual-learning theory, surveys and benchmarks from Chinese groups (2024-2026)

Scope of this note: (a) theory work - forgetting/generalization bounds, stability-plasticity, task-arithmetic and merging theory, scaling behaviour; (b) major surveys and benchmarks with Chinese lead authors; (c) corpus statistics over China-affiliated continual-learning (CL) output indexed by OpenAlex, 2025-01-01 .. 2026-10-17.
Companion files: `research/theory.json` (12 verified records), `research/stats.json` (aggregates + full raw pull of 1,577 records).

## Method and verification standard

The paper records are not sampled from a leaderboard. Each was resolved to a machine-readable record - an OpenAlex work with DOI, an arXiv id that returns HTTP 200 on `arxiv.org/abs/<id>`, or both - and every DOI was confirmed to resolve through `doi.org` (HTTP 302 to publisher). Chinese affiliation is taken from OpenAlex authorship institutions filtered to `country_code: CN`, and in every record the first author is at a mainland-China institution (CAS/Institute of Automation, Tsinghua, Tianjin, SJTU, HUST, SCUT, Sun Yat-sen, Westlake, Shanxi). The verification URLs are in each record's `basis` field.

The corpus statistics come from one full-population OpenAlex pull (not a sample):

```
filter = title_and_abstract.search:continual learning
       , from_publication_date:2025-01-01
       , to_publication_date:2026-10-17
       , institutions.country_code:CN
       , primary_topic.field.id:17   # Computer Science
```

1,577 / 1,577 records were retrieved (8 pages of 200), with abstracts for 1,177 of them (75%; 56 further abstracts were backfilled from Semantic Scholar, the rest are absent from OpenAlex).

## What the Chinese CL theory literature is actually about

Four clusters, in order of how much real theory they contain.

**1. Forgetting as a bounded quantity, not a phenomenon.** The strongest recent Chinese theoretical work is no longer "here is a regularizer"; it is "here is the term that controls forgetting." Liu et al. (TPAMI 2026, Tianjin/Zhejiang) recast PEFT-CL forgetting as two NTK generalization gaps and name the controlling factors - training-sample size, task-level feature orthogonality, regularization. Luo et al. (TPAMI 2025, SJTU/Nanjing) derive the first upper bound on cumulative generalization error for noisy label streams under temporal drift, coupling label noise and distribution shift in one expression. Zheng et al. (Neural Networks 2025, HUST/SYSU) derive closed-form expected forgetting and generalization error for memory-buffer CL and show that a buffer does not by itself reduce forgetting: when tasks are similar, buffer size must be matched by model capacity; when tasks are dissimilar, replay can forget *more* than no replay. He et al. (arXiv 2602.20791, Shanxi) close the loop on rehearsal budget - closed-form adaptability/memorability/generalization in rehearsal scale, with rehearsal found to impair adaptability and memory error saturating at a diminishing lower bound.

**2. Task arithmetic and merging, given a geometry.** Merging is the smallest method family in the corpus (46 of 1,577 records, 2.9%) but it attracts the newest theoretical framing. Yang et al.'s ACM CSUR 2026 survey (Sun Yat-sen/Northeastern) is the reference taxonomy plus the collected theory of why merging works (task-vector interference, linear-mode connectivity, subspace alignment). ChainLoRA (arXiv 2610.00431, SJTU, Sep 2026) is the state of the art on the theory side: it separates directional overlap from coefficient coupling between successive task vectors, bounds inter-task interference with a one-sided orthogonality proxy, and merges via Adaptive SVD with a Procrustes step that is proved to approximately separate shared from task-specific components - all at constant parameter and regularization cost as the stream grows.

**3. Scaling behaviour.** The most-cited China-affiliated CL paper in the window is an empirical scaling result, not a method: Luo et al. (TASLP 2025, Westlake/Tencent) show that over 1B-7B, increasing model scale makes continual instruction tuning forget *more* (attributed to stronger initial competence), with BLOOMZ forgetting less than mT0 and general instruction tuning beforehand mitigating it. Together with the rehearsal-scale result above, the Chinese literature's scaling story is negative: neither parameters nor replay budget is monotone in benefit.

**4. Taxonomy and evaluation infrastructure.** Wang, Zhang, Su and Zhu (TPAMI 2024, Tsinghua) remain the field's reference frame - CL as stability-plasticity plus intra/inter-task generalizability under a resource budget - at ~1.1k citations. Two 2025-2026 surveys extend it in orthogonal directions: Zheng et al. (ACM CSUR 2025, SCUT) split LLM lifelong learning into internal-knowledge (continual pre/fine-tuning) vs external-knowledge (retrieval, tools) with 12 scenarios; Li et al. (IEEE COMST 2025, HUST) unify federated/non-centralized CL across the spatial and temporal axes and ship a large-scale benchmark. The newest benchmarks move evaluation to foundation models and product settings: CL-VISTA (CAS Institute of Automation, 2026) curates 8 genuinely shifted video tasks and 6 protocols for Video-LLMs over 10 CL methods; MemoryBench (Tsinghua THUIR, 2025) tests whether an LLM *system* improves from accumulated user feedback during service time rather than from long context.

## Corpus statistics (OpenAlex, China-affiliated CL, 2025-01 .. 2026-10)

**Volume and trend.** 1,577 CS-field works; 666 dated 2025, 911 dated 2026 (through 17 October). 416 records (26%) are arXiv preprints. Monthly series has a hard artifact: 273 records carry a 1-January publication date (journal issue-date assignment), producing spikes at 2025-01 (152) and 2026-01 (232). Month-level January values are upper bounds; the 2025-to-2026 growth is real but smaller than the raw counts suggest.

**Institutions** (paper counted once per distinct Chinese institution, CAS institutes merged): CAS 153, Tsinghua 116, UESTC 93, SJTU 73, HIT 71, Peking 63, Zhejiang 62, Beihang 62, Nanjing 55, Fudan 54, Xi'an Jiaotong 50, Xidian 48, Sun Yat-sen 46, BUPT 46. First-author-only ordering is more revealing of where the work is *led*: CAS 78, UESTC 75, Tsinghua 50, HIT 42, Beihang 41, SJTU 39, Nanjing 38, Fudan 33. UESTC at #2 by first authorship is the least obvious fact in the census.

**Venues.** arXiv 342, Springer LNCS/CCIS 79, AAAI 58, Pattern Recognition 45, ICASSP 38, IEEE TPAMI 37, Neurocomputing 36, Neural Networks 29, ACM MM 27, NeurIPS 27, IEEE TIP 26, Expert Systems with Applications 25, IEEE TMM 24, Knowledge-Based Systems 23, CVPR 20, ACL 20. The distribution is bimodal: a thin band of top-tier ML/DM venues and a very thick band of applied journals (Pattern Recognition, Neurocomputing, KBS, ESWA, Information Sciences).

**Topic mix** (multi-label keyword buckets, title + 600 chars of abstract; non-exclusive): vision 393, LLM/language 361, RL/agents 216, federated/distributed 139, graph 77, theory 67, benchmark/survey 54 (title-only), diffusion 21.

**Method family** (single-label two-tier keyword classifier): replay 259 (16.4%), architecture 145 (9.2%), distillation 143 (9.1%), lora 97 (6.2%), theory 96 (6.1%), prompt 89 (5.6%), regularization 71 (4.5%), benchmark 54 (3.4%), merging 46 (2.9%), other 577 (36.6%). The residual is real information: it is mostly CL applied to fault diagnosis, medical imaging, remote sensing, recommendation and security, plus the 25% of records whose abstracts OpenAlex lacks.

**Citation leaders** (OpenAlex, 2026-10-17): Luo et al., catastrophic forgetting in LLMs, TASLP 2025 (132, Westlake/Tencent); Learning Without Forgetting for VLMs, TPAMI 2025 (56, Nanjing); Preserving and combining knowledge in robotic lifelong RL, Nature Machine Intelligence 2025 (50, TUM-led with Nanjing/SYSU co-authors); Zheng et al., lifelong learning of LLMs survey, ACM CSUR 2025 (49, SCUT); Unleashing CL on non-centralized devices, IEEE COMST 2025 (25, HUST).

## Caveats a reader should carry into the infographic

- The population is a phrase search. Work labelled only "incremental learning" or "lifelong learning" is partly missed, and Chinese-language journals (e.g. Journal of Image and Graphics, which does appear once) are under-indexed in OpenAlex.
- Method-family and topic counts are keyword classifiers, not human labels; 'other' is a residual, not a class. Treat percentages as rankings, not measurements.
- Citations are OpenAlex counts. They differ from Semantic Scholar (Zheng et al. 2025: 0 vs 4) and structurally under-count 2026 work.
- Theory is thin in absolute terms: 96 records (~6%) pass a theory-family classifier and only a handful derive bounds. If the infographic claims "China leads CL theory", the corpus does not support it; if it claims "China leads CL volume and benchmark infrastructure, with a fast-growing theory wing in PEFT/merging and noisy-stream learning", it does.
