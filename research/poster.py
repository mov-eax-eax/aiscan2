
# -*- coding: utf-8 -*-
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np, math

W = 1800
M = 80
CW = W - 2 * M

FF = {
 "reg":   "C:/Windows/Fonts/segoeui.ttf",
 "bold":  "C:/Windows/Fonts/segoeuib.ttf",
 "light": "C:/Windows/Fonts/segoeuil.ttf",
 "semi":  "C:/Windows/Fonts/segoeuisl.ttf",
 "mono":  "C:/Windows/Fonts/consola.ttf",
 "monob": "C:/Windows/Fonts/consolab.ttf",
 "cjk":   "C:/Windows/Fonts/msyh.ttc",
}
_fc = {}
def F(kind, size):
    key = (kind, size)
    if key not in _fc:
        _fc[key] = ImageFont.truetype(FF[kind], size, index=0)
    return _fc[key]

BG1 = (6, 10, 18); BG2 = (12, 19, 33)
PANEL = (15, 23, 40); PANEL2 = (18, 28, 47)
BORDER = (38, 55, 84)
TXT = (233, 238, 248); SUB = (150, 166, 196); MUT = (96, 112, 144)
CYAN = (56, 189, 248); VIOLET = (167, 139, 250); AMBER = (251, 191, 36)
GREEN = (52, 211, 153); ROSE = (251, 113, 133); BLUE = (96, 165, 250)

def background(H):
    top = np.array(BG1, dtype=np.float64); bot = np.array(BG2, dtype=np.float64)
    t = np.linspace(0, 1, H)[:, None]
    arr = (top * (1 - t) + bot * t).astype(np.uint8)[:, None, :].repeat(W, 1)
    img = Image.fromarray(arr, "RGB").convert("RGBA")
    g = Image.new("RGBA", (W, H), (0, 0, 0, 0)); gd = ImageDraw.Draw(g)
    gd.ellipse([W - 760, -420, W + 320, 700], fill=(56, 189, 248, 20))
    gd.ellipse([-460, int(H * 0.36), 620, int(H * 0.36) + 1000], fill=(167, 139, 250, 16))
    gd.ellipse([W - 680, H - 620, W + 260, H + 240], fill=(251, 191, 36, 11))
    img.alpha_composite(g.filter(ImageFilter.GaussianBlur(240)))
    gr = Image.new("RGBA", (W, H), (0, 0, 0, 0)); gdr = ImageDraw.Draw(gr)
    for x in range(0, W, 72): gdr.line([(x, 0), (x, H)], fill=(255, 255, 255, 4))
    for y in range(0, H, 72): gdr.line([(0, y), (W, y)], fill=(255, 255, 255, 4))
    img.alpha_composite(gr)
    return img

def tw(d, s, f): return d.textlength(s, font=f)

def text(d, xy, s, f, fill, anchor="la", spacing=0):
    if spacing:
        x = xy[0]
        for ch in s:
            d.text((x, xy[1]), ch, font=f, fill=fill, anchor=anchor)
            x += d.textlength(ch, font=f) + spacing
    else:
        d.text(xy, s, font=f, fill=fill, anchor=anchor)

def wrap(d, s, f, maxw):
    words = s.split(); lines = []; cur = ""
    for w_ in words:
        trial = (cur + " " + w_).strip()
        if tw(d, trial, f) <= maxw: cur = trial
        else:
            if cur: lines.append(cur)
            cur = w_
    if cur: lines.append(cur)
    return lines

def para(d, x, y, s, kind, size, fill, maxw, lh, maxlines=None):
    lines = wrap(d, s, F(kind, size), maxw)
    if maxlines and len(lines) > maxlines:
        lines = lines[:maxlines]
        lines[-1] = lines[-1].rstrip(" ,.;:") + "…"
    for i, ln in enumerate(lines):
        d.text((x, y + i * lh), ln, font=F(kind, size), fill=fill)
    return y + len(lines) * lh

def panel(img, box, r=16, fill=PANEL, outline=BORDER, shadow=True, dy=10, alpha=105):
    if shadow:
        sh = Image.new("RGBA", img.size, (0, 0, 0, 0)); sd = ImageDraw.Draw(sh)
        sd.rounded_rectangle([box[0] + 2, box[1] + dy, box[2] + 2, box[3] + dy], r, fill=(0, 0, 0, alpha))
        img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(16)))
    ImageDraw.Draw(img).rounded_rectangle(box, r, fill=fill, outline=outline, width=1)

def chip(d, x, y, label, fg, bg, size=12.5, padx=9, pady=5, r=7):
    f = F("monob", size)
    w_ = tw(d, label, f) + 2 * padx
    h_ = size + 2 * pady + 2
    d.rounded_rectangle([x, y, x + w_, y + h_], r, fill=bg)
    d.text((x + padx, y + pady + 1), label, font=f, fill=fg)
    return w_, h_

def section_head(img, d, y, num, title, accent):
    y += 16
    d.text((M, y + 8), num, font=F("mono", 22), fill=accent)
    d.text((M + 62, y), title, font=F("bold", 37), fill=TXT)
    w_ = tw(d, title, F("bold", 37))
    d.line([(M + 62 + w_ + 26, y + 25), (W - M, y + 25)], fill=(255, 255, 255, 26), width=1)
    return y + 72

def stat_strip(img, d, y):
    cells = [
        ("1,009", "CS-primary works: “continual learning”, ≥1\nmainland-China author, Jan 2025 – Oct 2026", CYAN),
        ("531", "in 2026 alone (Jan–Oct), vs 425 across\nall of 2025 — the field is accelerating", VIOLET),
        ("30%", "of works are LLM-centric — 31.5% in 2026,\n27.5% in 2025; vision is still the largest lane", AMBER),
        ("0", "median citations — the frontier is\npre-consensus, not settled science", GREEN),
    ]
    gap = 18; cw = (CW - 3 * gap) / 4; h = 116
    for i, (num, lab, acc) in enumerate(cells):
        x = M + i * (cw + gap)
        panel(img, [x, y, x + cw, y + h], r=14, fill=(14, 21, 37, 238))
        d.rectangle([x, y + 14, x + 4, y + h - 14], fill=acc)
        d.text((x + 22, y + 14), num, font=F("bold", 46), fill=TXT)
        yy = y + 74
        for ln in lab.split("\n"):
            d.text((x + 22, yy), ln, font=F("reg", 14.5), fill=SUB); yy += 19
    return y + h

def build(img):
    d = ImageDraw.Draw(img)
    y = 58
    # ---------- header ----------
    d.rectangle([M, y + 6, M + 10, y + 16], fill=CYAN)
    text(d, (M + 24, y - 2), "FIELD SCAN  ·  CONTINUAL LEARNING", F("monob", 19), CYAN, spacing=1.6)
    d.text((W - M, y), "corpus snapshot · 17 OCT 2026 · openalex + arxiv", font=F("mono", 16), fill=MUT, anchor="ra")
    y += 52
    d.text((M - 4, y), "CONTINUAL LEARNING", font=F("bold", 96), fill=TXT)
    y += 112
    d.text((M - 4, y), "FROM CHINA", font=F("bold", 96), fill=TXT)
    d.text((M - 4 + tw(d, "FROM CHINA", F("bold", 96)) + 12, y), ".", font=F("bold", 96), fill=CYAN)
    d.rectangle([M, y + 116, M + tw(d, "FROM CHINA", F("bold", 96)) - 6, y + 121], fill=CYAN)
    text(d, (M, y + 138), "中国持续学习研究前沿图谱  ·  2025–2026", F("cjk", 25), (150, 178, 214))
    y += 186

    sub = "What 1,009 papers say the field is actually doing. Replay is no longer the frontier — the unit of research has become the subspace you may update, the expert that owns a task, and the memory an agent keeps."
    y = para(d, M, y, sub, "light", 24.5, (208, 218, 235), 1130, 35, maxlines=2)
    y += 18

    # sidebar
    bx, by, bw, bh = W - M - 412, 96, 412, 264
    panel(img, [bx, by, bx + bw, by + bh], r=16, fill=(18, 28, 47, 242))
    d.rectangle([bx + 22, by + 24, bx + 26, by + 58], fill=AMBER)
    text(d, (bx + 38, by + 22), "THE ONE-LINE SHIFT", F("monob", 13.2), AMBER, spacing=1.4)
    para(d, bx + 22, by + 58, "From “what to store” to “which weights may change”: 150 of 956 papers now allocate capacity in a chosen subspace instead of replaying data.", "reg", 18, TXT, bw - 44, 25.5, maxlines=4)
    d.line([(bx + 22, by + 172), (bx + bw - 22, by + 172)], fill=(255, 255, 255, 26))
    text(d, (bx + 22, by + 186), "LoRA/PEFT 150  ·  replay 148", F("mono", 14.2), SUB)
    text(d, (bx + 22, by + 210), "distillation 119  ·  regularisation 94", F("mono", 14.2), SUB)
    text(d, (bx + 22, by + 234), "architecture 92  ·  merging 24", F("mono", 14.2), SUB)

    y = stat_strip(img, d, max(y, 520) if False else y + 4)

    # ---------- 01 shifts ----------
    y = section_head(img, d, y + 46, "01", "THREE SHIFTS", CYAN)
    shifts = [
      (CYAN, "METHOD", "Replay lost the frontier.",
       "148 papers still replay. But the 2025–26 method wave is capacity allocation: LoRA/PEFT (150), regularisation (94), architecture (92). The question changed from what to store to which subspace may change.",
       "LoRA  ·  null-space  ·  singular vectors"),
      (VIOLET, "SETTING", "CL moved onto pretrained models.",
       "300 vision-flavoured works, mostly frozen encoders plus task-specific projections, adapters or experts. Exemplar-free is the default, and class-incremental toy benchmarks are no longer the main stage.",
       "frozen backbone  ·  adapters  ·  MoE"),
      (AMBER, "OBJECT", "The object is knowledge itself.",
       "LLM adaptation, agent memory, model merging (24 papers), DP-CL, unlearning. Forgetting is now measured on capabilities — instruction following, reasoning, tool use — not only on labels.",
       "LLM  ·  agents  ·  DP  ·  merging"),
    ]
    gap = 20; cw = (CW - 2 * gap) / 3; ch = 284
    for i, (acc, tag, title, body, foot) in enumerate(shifts):
        x = M + i * (cw + gap)
        panel(img, [x, y, x + cw, y + ch], r=16)
        d.rectangle([x, y + 20, x + 3, y + 86], fill=acc)
        chip(d, x + 22, y + 20, tag, acc, (max(12, acc[0] // 6 + 8), max(14, acc[1] // 6 + 10), max(20, acc[2] // 6 + 14)))
        yy = para(d, x + 22, y + 60, title, "bold", 24.5, TXT, cw - 44, 31, maxlines=2)
        yy = para(d, x + 22, yy + 10, body, "reg", 17.6, SUB, cw - 44, 24, maxlines=6)
        text(d, (x + 22, y + ch - 32), foot, F("mono", 13), acc)
    y += ch

    # ---------- 02 six moves ----------
    y = section_head(img, d, y + 46, "02", "SIX TECHNICAL MOVES", VIOLET)
    moves = [
      ("01", "Subspace geometry replaced replay buffers.",
       "Null-space projection (O-LoRA lineage) fixes directions, but finite-precision updates still leak into old subspaces. 2026 work turns the step size into a function of accumulated rank — PaLoRA derives s* = √(R/c) — and moves the allocation unit from layers to singular-vector channels (SVC)."),
      ("02", "Orthogonality is not free.",
       "Strict isolation blocks transfer between related tasks; CoDe-LoRA names this the orthogonality dilemma. The fix is partial isolation: adaptive null-space projection plus semantic routing, i.e. shared versus private capacity allocated per task, not per parameter."),
      ("03", "Isolation by construction: block-diagonal experts.",
       "Monarch-MoE replaces dense LoRA experts with block-diagonal factors joined by a fixed permutation: blockwise gradient isolation while keeping 25–50% of the original adapter parameters. CL-MoE routes at task and instance level; SMoLoRA routes at capability level, separating visual understanding from instruction following."),
      ("04", "Multimodal forgetting is dual.",
       "Continual visual instruction tuning degrades visual understanding and instruction following separately (SMoLoRA); CLIP-based CL adds a drifting modality gap (Mind the Gap, ICCV’25). The response is separate routers and explicit gap compensation, not one regulariser."),
      ("05", "Agents: memory became the CL substrate.",
       "Hippocam consolidates experience along an intent hierarchy; TSRL supervises only failure states and bounds cumulative updates — a rare formal forgetting argument for agent post-training. EmbodiedCLBench supplies the missing evaluation for self-evolving agents."),
      ("06", "Generative and private CL are next.",
       "Continual diffusion needs gradient projection plus iterative SVD to survive the Markov memory cost; condition-anchored distillation replaces stored prompts with teacher rollouts; DP-SPA shows privatised LoRA training increases forgetting during later adaptation."),
    ]
    egs = ["PaLoRA · SVC · LoRA-", "CoDe-LoRA", "Monarch-MoE · CL-MoE · SMoLoRA", "SMoLoRA · Mind the Gap", "TSRL · Hippocam · EmbodiedCLBench", "One-for-More · CAGD · DP-SPA"]
    gap = 20; cw = (CW - gap) / 2; ch = 174
    for i, (num, title, body) in enumerate(moves):
        x = M + (i % 2) * (cw + gap)
        yy = y + (i // 2) * (ch + 16)
        panel(img, [x, yy, x + cw, yy + ch], r=16)
        d.rectangle([x, yy + 16, x + 4, yy + 48], fill=VIOLET)
        d.text((x + cw - 26, yy + 10), num, font=F("bold", 28), fill=(255, 255, 255, 24), anchor="ra")
        d.text((x + 24, yy + 14), title, font=F("bold", 22.5), fill=TXT)
        para(d, x + 24, yy + 48, body, "reg", 16.8, SUB, cw - 48, 22.2, maxlines=5)
        d.text((x + 24, yy + ch - 26), "→ " + egs[i], font=F("mono", 12), fill=(150, 140, 220))
    y += 3 * ch + 2 * 16

    # ---------- 03 papers ----------
    y = section_head(img, d, y + 44, "03", "TWELVE PAPERS TO KNOW", AMBER)
    cards = [
      ("LLM · SUBSPACE", CYAN, "PaLoRA: a derived pacing law", "Peking U + CAS", "arXiv 2610.04226 · Oct 2026",
       "The optimal step restriction under null-space projection is not a tuned constant: it grows with the effective rank R of accumulated updates, s* = √(R/c), because finite-precision updates leak along multiple directions.",
       "Pacing law derived, not tuned; +4 accuracy on 50-task ImageNet-A/R."),
      ("LLM · ISOLATION", CYAN, "CoDe-LoRA and the orthogonality dilemma", "BUPT", "arXiv 2610.08312 · Oct 2026",
       "Strict orthogonal isolation blocks transfer between related tasks. Splits learning into consolidating universal knowledge (adaptive null-space projection) and decoupling task-specific knowledge (semantic routing); replay-free.",
       "Best average accuracy across 4 backbones × 3 CL benchmarks."),
      ("LLM · CHANNELS", CYAN, "SVC: singular-vector channels", "Beihang + CAS ICT", "arXiv 2610.11076 · Oct 2026",
       "Each singular-vector channel becomes the unit of stability and plasticity: adaptation benefit is scored against forgetting cost, then channels are chosen by knee screening, Pareto filtering and Otsu thresholding.",
       "“Where to adapt” becomes a measured allocation, not a heuristic."),
      ("VISION · EXEMPLAR-FREE", BLUE, "LoRA- and the drift-resistant space", "Sun Yat-sen U", "CVPR 2025 · doi 10.1109/cvpr52734.2025.01426",
       "Subtracts old-task LoRA weights from the pretrained weight to construct a drift-resistant space, so each new task trains against a space that tracks feature drift — with no exemplars and no outdated statistics.",
       "Exemplar-free CL with no replay, prototypes or old-task statistics."),
      ("MULTIMODAL · CVIT", VIOLET, "SMoLoRA: dual catastrophic forgetting", "Hefei UT + Tsinghua", "ICCV 2025 · doi 10.1109/iccv51701.2025.00024",
       "Continual visual instruction tuning degrades visual understanding and instruction following separately. A separable mixture of LoRA experts with two routers adapts each capability through its own path.",
       "Reframes CVIT forgetting as two coupled failures, not one."),
      ("MULTIMODAL · EXPERTS", VIOLET, "Monarch-MoE: block-diagonal experts", "CAS ICT + UCAS + ShanghaiTech", "arXiv 2610.13215 · Oct 2026",
       "Replaces dense LoRA experts with block-diagonal factors tied by a fixed permutation: blockwise gradient isolation, all input–output blocks still connected, with batched and fused kernels for memory-limited hardware.",
       "Forgetting 0.52 pp / 0.10 pp on first task with 50–75% fewer adapter parameters."),
      ("AGENTS · RL", GREEN, "TSRL: supervise only failure states", "CAS Institute of Automation", "arXiv 2610.17726 · Oct 2026",
       "RL is the optimisation backbone; SFT switches on only at hard states where the policy fails. Restricting supervision to failure states yields an upper bound on cumulative parameter updates, so forgetting is reduced relative to full SFT.",
       "Gains on ALFWorld/WebShop/Deep Search at 7B and 32B; +9.6 pts retained capability over SFT→RL."),
      ("AGENTS · MEMORY", GREEN, "Hippocam: intent-structured memory", "CAS IIE + UCAS", "arXiv 2610.12124 · Oct 2026",
       "Structures an agent's work as nested intents: completed intents consolidate to the outcomes needed later, while recursive prefix consolidation makes long-unused experience progressively abstract, with detail recoverable on demand.",
       "Lifelong learning as memory organisation, not weight updates."),
      ("EMBODIED · BENCHMARK", GREEN, "EmbodiedCLBench", "Peking U + BIGAI", "arXiv 2610.13021 · Oct 2026",
       "The first embodied-simulation benchmark for continual learning, built on compositional generalisation: agents learn basic skills, then must recombine them to solve unseen advanced tasks.",
       "Experience helps consistently — but the gain does not scale with samples."),
      ("GENERATIVE · DIFFUSION", AMBER, "One-for-More: continual diffusion", "ECNU + Xiamen U + Tencent", "CVPR 2025 · doi 10.1109/cvpr52734.2025.00449",
       "Gradient projection protects learned knowledge during continual anomaly detection, while an iterative SVD exploits transitivity of linear representations to cut the memory cost of the diffusion Markov process.",
       "Continual generative modelling without per-task replay buffers."),
      ("THEORY · NEURO", ROSE, "CH-HNN: corticohippocampal circuits", "Tsinghua", "Nature Communications 2025 · doi 10.1038/s41467-025-56405-9",
       "Corticohippocampal dual representation in silicon: an ANN stores specific memories and an SNN generalises them, with episode inference for new concepts. Task-agnostic, memory-flat, and cheap at SNN energy cost.",
       "A biological circuit used as an architectural prior for CL."),
      ("MULTIMODAL · SYNTHETIC", VIOLET, "GIFT: synthetic data as replay", "Wuhan U + CAS IoA", "CVPR 2025 · doi 10.1109/cvpr52734.2025.00268",
       "A diffusion model recreates both pre-training and past-task image–text pairs, and the VLM distils on the synthetic pairs — protecting pre-training knowledge when the original data is gone.",
       "Replay without storing anything real: generative buffers replace exemplars."),
    ]
    gap = 18; cw = (CW - gap) / 2
    rows_ = []
    for i, (lane, acc, title, lab, vid, body, why) in enumerate(cards):
        tl = wrap(d, title, F("bold", 23), cw - 40)[:2]
        bl = wrap(d, body, F("reg", 16.2), cw - 44)[:4]
        wl = wrap(d, "→ " + why, F("semi", 15.2), cw - 44)[:2]
        hh = 46 + len(tl) * 27 + 6 + 16 + 22 + len(bl) * 20.8 + 12 + len(wl) * 19 + 20
        rows_.append((tl, bl, wl, max(hh, 200)))
    idx = 0
    while idx < len(cards):
        pair = rows_[idx:idx + 2]
        rh = max(r[3] for r in pair)
        for j in range(len(pair)):
            k = idx + j
            lane, acc, title, lab, vid, body, why = cards[k]
            tl, bl, wl, _ = rows_[k]
            x = M + j * (cw + gap); yy = y
            panel(img, [x, yy, x + cw, yy + rh], r=16)
            d.rectangle([x, yy + 16, x + 4, yy + 40], fill=acc)
            chip(d, x + 20, yy + 14, lane, acc, (max(12, acc[0] // 6 + 8), max(14, acc[1] // 6 + 10), max(20, acc[2] // 6 + 14)), size=11.5)
            d.text((x + cw - 20, yy + 18), vid, font=F("mono", 11.5), fill=MUT, anchor="ra")
            for jj, ln in enumerate(tl):
                d.text((x + 20, yy + 46 + jj * 27), ln, font=F("bold", 23), fill=TXT)
            ly = yy + 46 + len(tl) * 27 + 6
            d.text((x + 20, ly), lab, font=F("mono", 12.5), fill=SUB)
            by = ly + 22
            for jj, ln in enumerate(bl):
                d.text((x + 20, by + jj * 20.8), ln, font=F("reg", 16.2), fill=SUB)
            wy = by + len(bl) * 20.8 + 12
            for jj, ln in enumerate(wl):
                d.text((x + 20, wy + jj * 19), ln, font=F("semi", 15.2), fill=(206, 220, 240))
        y += rh + 16
        idx += 2

    # ---------- radar ----------
    panel(img, [M, y + 24, W - M, y + 24 + 300], r=16, fill=(13, 20, 35, 210))
    text(d, (M + 24, y + 40), "ALSO ON THE RADAR", F("monob", 13), MUT, spacing=1.4)
    d.line([(M + 24 + 196, y + 50), (W - M - 24, y + 50)], fill=(255, 255, 255, 22))
    radar = [
      ("ChainLoRA: task-vector merging as geometry", "SJTU + HUST · Sep 2026"),
      ("GORP: the low-rank constraint is the bottleneck", "ACL 2025"),
      ("Knowledge in Superposition: why editing fails", "CAS IoA · AAAI 2025"),
      ("Forgetting worsens with scale, 1B–14B", "Westlake + Tencent · TASLP 2025"),
      ("Beyond Forgetting: continual RLVR", "PKU + BIGAI · Aug 2026"),
      ("CMT: compress new knowledge into memory", "HIT · AAAI 2025"),
      ("GainLoRA: gated LoRA integration for CL", "Nanjing U · NeurIPS 2025"),
      ("NTK theory of PEFT continual learning", "Tianjin + Zhejiang · TPAMI 2026"),
      ("A buffer does not inherently reduce forgetting", "HUST/SYSU/NUDT · Neural Networks 2025"),
      ("Cumulative-error bound, noisy drifting streams", "SJTU + Nanjing · TPAMI 2025"),
      ("EFRE: prompt repertoires beat one prompt", "CUHK-SZ + USTC + Shanghai AI Lab"),
      ("DP-SPA: differentially private continual LoRA", "Tianjin + Xidian · Oct 2026"),
      ("Mind the Gap: CLIP modality gap in CL", "Nankai · ICCV 2025"),
      ("Proof: projection fusion for VLMs", "Nanjing U · TPAMI 2025 · 56 cites"),
      ("CL-MoE: dual momentum experts, VQA", "ECNU · CVPR 2025"),
      ("RIFAR: forgetting-aware replay for robots", "Tsinghua + Zhejiang · Oct 2026"),
      ("CL-VISTA: video-LLM continual benchmark", "CAS IoA · 2026"),
      ("Model merging in LLMs / MLLMs: survey", "Sun Yat-sen · ACM CSUR 2026"),
    ]
    colw = (CW - 48) / 3
    for i, (t_, meta) in enumerate(radar):
        col = i // 6; row = i % 6
        rx = M + 24 + col * (colw + 24)
        ry = y + 70 + row * 37
        d.text((rx, ry), "·", font=F("bold", 18), fill=[CYAN, VIOLET, AMBER, GREEN, ROSE][i % 5])
        d.text((rx + 13, ry + 1), t_, font=F("reg", 13.8), fill=(214, 224, 238))
        d.text((rx + 13, ry + 19), meta, font=F("mono", 10.2), fill=MUT)
    y += 300 + 26

    # ---------- 04 corpus ----------
    y = section_head(img, d, y + 40, "04", "THE CORPUS IN NUMBERS", GREEN)
    gap = 18; pw = (CW - gap) / 2; ph = 318
    # A - institutions
    px, py = M, y
    panel(img, [px, py, px + pw, py + ph], r=16)
    text(d, (px + 22, py + 16), "WHO PUBLISHES", F("monob", 12.5), GREEN, spacing=1.2)
    text(d, (px + 22, py + 36), "Top 12 institutions", F("bold", 19), TXT)
    d.text((px + 22, py + 60), "papers with a mainland-China author, 2025–26", font=F("reg", 12.2), fill=MUT)
    inst = [("CAS institutes", 170), ("Tsinghua", 81), ("UESTC", 73), ("Nanjing U", 61), ("Zhejiang", 49), ("SJTU", 43),
            ("Beihang", 39), ("HIT", 38), ("Sun Yat-sen", 38), ("Fudan", 36), ("BUPT", 32), ("Xi'an Jiaotong", 31)]
    maxv = 170; labw = 128; bar_h = 11; gg = 5.0
    for i, (lab, v) in enumerate(inst):
        byy = py + 82 + i * (bar_h + gg)
        d.text((px + 22, byy - 1), lab, font=F("reg", 12.2), fill=SUB)
        bw = (pw - labw - 96) * v / maxv
        d.rounded_rectangle([px + 22 + labw, byy + 1, px + 22 + labw + bw, byy + bar_h], 3, fill=(42, 116, 94))
        d.text((px + 22 + labw + bw + 8, byy - 3), str(v), font=F("monob", 11), fill=(166, 228, 202))
    d.text((px + 22, py + ph - 22), "CAS = its institutes rolled up · 491 works name at least one of these", font=F("mono", 10.2), fill=MUT)

    # B - venues
    px = M + pw + gap
    panel(img, [px, py, px + pw, py + ph], r=16)
    text(d, (px + 22, py + 16), "WHERE IT LANDS", F("monob", 12.5), GREEN, spacing=1.2)
    text(d, (px + 22, py + 36), "Venue mix", F("bold", 19), TXT)
    d.text((px + 22, py + 60), "normalised source names; preprints counted as such", font=F("reg", 12.2), fill=MUT)
    venues = [("arXiv preprint", 184, AMBER), ("PR / Neurocomputing", 101, CYAN), ("TIP / TNNLS / TCSVT", 42, CYAN),
              ("AAAI", 25, CYAN), ("TPAMI", 22, CYAN), ("NeurIPS", 19, CYAN), ("ICCV / ACM MM", 18, CYAN),
              ("ACL / EMNLP", 16, CYAN), ("KDD / WWW", 16, CYAN), ("CVPR", 15, CYAN)]
    maxv = 184; labw = 152
    for i, (lab, v, col) in enumerate(venues):
        byy = py + 82 + i * (bar_h + gg)
        d.text((px + 22, byy - 1), lab, font=F("reg", 12.2), fill=SUB)
        bw = (pw - labw - 96) * v / maxv
        d.rounded_rectangle([px + 22 + labw, byy + 1, px + 22 + labw + bw, byy + bar_h], 3, fill=(30, 88, 118) if col is CYAN else (150, 110, 30))
        d.text((px + 22 + labw + bw + 8, byy - 3), str(v), font=F("monob", 11), fill=(168, 220, 245))
    d.text((px + 22, py + ph - 22), "arXiv 184 · 29 surveys · 651 works still uncited", font=F("mono", 10.2), fill=MUT)

    # C - momentum
    px, py = M, y + ph + gap
    panel(img, [px, py, px + pw, py + ph], r=16)
    text(d, (px + 22, py + 16), "MOMENTUM", F("monob", 12.5), GREEN, spacing=1.2)
    text(d, (px + 22, py + 36), "Output per month", F("bold", 19), TXT)
    d.text((px + 22, py + 60), "2026 YTD already beats all of 2025: 531 vs 425, with 2.5 months fewer", font=F("reg", 12.2), fill=MUT)
    months = [102,20,29,34,22,51,23,19,15,49,27,34,149,35,47,50,45,43,39,48,46,29]
    bx0, by0, bw0, bh0 = px + 46, py + 96, pw - 74, 172
    mx = 160
    for gv in (0, 50, 100, 150):
        gy = by0 + bh0 - bh0 * gv / mx
        d.line([(bx0, gy), (bx0 + bw0, gy)], fill=(255, 255, 255, 16), width=1)
        d.text((bx0 - 8, gy - 6), str(gv), font=F("mono", 9.6), fill=MUT, anchor="ra")
    step = bw0 / len(months)
    for i, v in enumerate(months):
        col = (54, 116, 166) if i < 12 else CYAN
        if i == 12: col = VIOLET
        hgt = bh0 * v / mx
        d.rectangle([bx0 + i * step + step * 0.18, by0 + bh0 - hgt, bx0 + i * step + step * 0.82, by0 + bh0], fill=col)
    d.line([(bx0, by0 + bh0), (bx0 + bw0, by0 + bh0)], fill=(255, 255, 255, 40), width=1)
    for i, lab_ in [(0, "Jan 25"), (6, "Jul 25"), (12, "Jan 26"), (18, "Jul 26")]:
        d.text((bx0 + i * step, by0 + bh0 + 8), lab_, font=F("mono", 10), fill=MUT)
    d.text((bx0 + 12 * step - 2, by0 + bh0 - bh0 * 149 / mx - 16), "149", font=F("monob", 10.5), fill=VIOLET)
    d.text((px + 22, py + ph - 22), "* Oct 2026 partial · Jan buckets inflated by OpenAlex 1-Jan issue dates", font=F("mono", 10.2), fill=MUT)

    # D - lab map
    px = M + pw + gap
    panel(img, [px, py, px + pw, py + ph], r=16)
    text(d, (px + 22, py + 16), "DIVISION OF LABOUR", F("monob", 12.5), GREEN, spacing=1.2)
    text(d, (px + 22, py + 36), "Who owns which lane", F("bold", 19), TXT)
    d.text((px + 22, py + 60), "read from the authorship of the 2026 preprints", font=F("reg", 12.2), fill=MUT)
    labs = [
      ("CAS IoA", "editing theory · agent RL post-training"),
      ("CAS ICT", "structured experts (Monarch-MoE)"),
      ("Tsinghua · PKU", "LoRA-CL core · pacing · surveys"),
      ("Nanjing U", "VLM projection fusion (Proof)"),
      ("SJTU", "task-vector merging geometry"),
      ("ECNU", "multimodal MoE (CL-MoE)"),
      ("Sun Yat-sen", "exemplar-free CL · merging surveys"),
      ("HIT · Westlake/TC", "frozen memory · forgetting baselines"),
      ("PKU + BIGAI", "agent benchmarks"),
    ]
    for i, (lab_, lane) in enumerate(labs):
        ry = py + 84 + i * 21.2
        d.text((px + 22, ry), lab_, font=F("bold", 12.4), fill=(205, 218, 238))
        d.text((px + 22 + 158, ry), lane, font=F("reg", 12.4), fill=SUB)
    d.text((px + 22, py + ph - 22), "authorship-based, indicative — not an exhaustive census", font=F("mono", 10.2), fill=MUT)
    y = y + 2 * ph + gap

    # ---------- 05 open problems ----------
    y = section_head(img, d, y + 46, "05", "WHAT IS NOT SOLVED", ROSE)
    problems = [
      ("01", "No predictive theory of transfer.", "Bounds exist per method — pacing laws, update-norm bounds — but none predicts when shared structure helps and when it interferes. Theory is only ~6% of the corpus; “orthogonality dilemma” is a name, not yet a theory."),
      ("02", "Evaluation is fragmented.", "UCIT, MLLM-DCL, EmbodiedCLBench and ALFWorld each measure something different; few report backward transfer, forward transfer and compute together. 651 of 956 works are uncited — no consensus metric."),
      ("03", "Forgetting of capabilities is unmeasured.", "Instruction following, reasoning and tool use degrade without a clean metric; most benchmarks still score task accuracy on labels."),
      ("04", "Replay still wins on accuracy.", "Replay-free methods trail by roughly 10–20 points on class-incremental vision; the memory, privacy and latency costs of replay remain unpriced in most papers."),
      ("05", "Continual RL and embodiment.", "Non-stationary dynamics, sim-to-real transfer and long-horizon credit assignment are unsolved; the benchmarks are new and small."),
      ("06", "Privacy, unlearning and CL collide.", "DP noise compounds across tasks and interacts with LoRA’s two factors; the boundary between machine unlearning and continual learning is undefined in both method and regulation."),
    ]
    gap = 18; cw = (CW - gap) / 2; chh = 118
    for i, (num, title, body) in enumerate(problems):
        x = M + (i % 2) * (cw + gap)
        yy = y + (i // 2) * (chh + 14)
        panel(img, [x, yy, x + cw, yy + chh], r=14, shadow=False, fill=(16, 24, 41, 220))
        d.text((x + 22, yy + 18), num, font=F("monob", 17), fill=ROSE)
        d.text((x + 56, yy + 16), title, font=F("bold", 18.5), fill=TXT)
        para(d, x + 56, yy + 46, body, "reg", 14.6, SUB, cw - 78, 19.5, maxlines=4)
    y += 3 * chh + 2 * 14

    # ---------- footer ----------
    y += 44
    d.line([(M, y), (W - M, y)], fill=(255, 255, 255, 26), width=1)
    y += 20
    text(d, (M, y), "METHOD & CAVEATS", F("monob", 12.5), MUT, spacing=1.3)
    text(d, (M + 660, y), "READING PATH", F("monob", 12.5), MUT, spacing=1.3)
    y += 22
    method = ("OpenAlex works whose title or abstract contains “continual learning”, primary field Computer Science, with at least one mainland-China institution among the authors, published 2025-01-01 to 2026-10-17. 1,009 records matched (1,333 phrase matches across all fields); 956 unique titles analysed. Counts are multi-label — one paper can be vision and LLM — so shares overlap and do not sum to 100%. Citation counts are OpenAlex at snapshot date; the median is 0, so citation rank is not a quality rank. “Chinese” = any mainland-China institution on the author list, not necessarily the first author. Venue names are normalised from raw source strings; arXiv share reflects the pre-publication frontier.")
    my_end = para(d, M, y, method, "reg", 13.0, MUT, 580, 18.2, maxlines=12)
    path = [
      "1. Read the surveys first: TPAMI 2024 CL survey (1,087 cites) as the frame, then multimodal CL (TNNLS 2026), lifelong LLMs (ACM CSUR 2025), CL systematic review (Neural Networks 2025).",
      "2. Pick a benchmark that measures capabilities, not labels: UCIT, MLLM-DCL, CL-VISTA or EmbodiedCLBench.",
      "3. Pick a mechanism. Subspace geometry has the most theoretical traction, block-diagonal experts the most hardware reality, agent memory the least explored.",
    ]
    py_ = y
    for p in path:
        py_ = para(d, M + 660, py_, p, "reg", 13.0, MUT, 980, 18.2, maxlines=3) + 5
    y = max(my_end, py_) + 16
    d.text((M, y), "compiled 17 OCT 2026  ·  sources: OpenAlex, arXiv, DOI records  ·  corpus: research/openalex_full.ndjson  ·  spotlight claims are printed with arXiv IDs and DOIs", font=F("mono", 11.0), fill=(84, 99, 126))
    y += 28
    return y


tmp = background(8000)
yend = build(tmp)
H = int(yend + M - 20)
print("content height", yend, "final", H)
img = background(H)
build(img)
img.convert("RGB").save("research/poster_draft.png")
img.convert("RGB").save("continual-learning-china-2025-26.png")
img.convert("RGB").save("continual-learning-china-2025-26.pdf", resolution=150)
print("saved", img.size)