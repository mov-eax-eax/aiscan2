"""
Overlay the rendered top-down silhouette against the reference photograph.

This is the feedback loop for getting the outline right. Both masks are scaled so
their WIDTHS match (not their bounding boxes) -- that way a wrong aspect ratio or
a wrong grip length shows up as a visible mismatch instead of being normalised
away.

Reference mask : flood-fill from the border, so interior specular highlights on
                 the glossy black shell do not punch holes in it.
Render mask    : distance from the flat background colour.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
from scipy import ndimage

CANVAS_W, CANVAS_H = 900, 620
TARGET_W_PX = 700          # both silhouettes are scaled to this width


def _norm(mask, w_px=TARGET_W_PX):
    ys, xs = np.nonzero(mask)
    if len(ys) == 0:
        raise SystemExit("empty mask")
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    crop = mask[y0:y1 + 1, x0:x1 + 1]
    h, w = crop.shape
    scale = w_px / w
    nh, nw = max(1, int(round(h * scale))), w_px
    im = Image.fromarray((crop * 255).astype(np.uint8)).resize((nw, nh), Image.NEAREST)
    m = np.asarray(im) > 127
    return m, (x1 - x0 + 1), (y1 - y0 + 1)


def photo_mask(path, thresh, blur=1.2):
    im = Image.open(path).convert("L")
    im = im.resize((720, int(round(im.height * 720 / im.width))), Image.LANCZOS)
    im = im.filter(ImageFilter.GaussianBlur(blur))
    a = np.asarray(im, dtype=np.uint8)
    light = a > thresh
    lab, n = ndimage.label(light)
    border = set()
    border.update(np.unique(lab[0, :])); border.update(np.unique(lab[-1, :]))
    border.update(np.unique(lab[:, 0])); border.update(np.unique(lab[:, -1]))
    border.discard(0)
    fg = ~np.isin(lab, list(border))
    lab2, n2 = ndimage.label(fg)
    if n2 > 1:
        sizes = ndimage.sum(np.ones_like(lab2), lab2, index=range(1, n2 + 1))
        fg = lab2 == (int(np.argmax(sizes)) + 1)
    return ndimage.binary_fill_holes(fg)


def render_mask(path, tol=28):
    im = Image.open(path).convert("RGB")
    a = np.asarray(im, dtype=np.float32)
    c = np.concatenate([a[:6, :].reshape(-1, 3), a[-6:, :].reshape(-1, 3),
                        a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3)])
    bg = np.median(c, axis=0)
    dist = np.sqrt(((a - bg) ** 2).sum(axis=2))
    fg = dist > tol
    fg = ndimage.binary_closing(fg, np.ones((5, 5)), iterations=2)
    lab, n = ndimage.label(fg)
    if n > 1:
        sizes = ndimage.sum(np.ones_like(lab), lab, index=range(1, n + 1))
        fg = lab == (int(np.argmax(sizes)) + 1)
    return ndimage.binary_fill_holes(fg)


def outline(m):
    return m & ~ndimage.binary_erosion(m, np.ones((3, 3)))


def place(m, shape):
    ch, cw = shape
    h, w = m.shape
    y = (ch - h) // 2
    x = (cw - w) // 2
    y = max(0, min(ch - h, y)); x = max(0, min(cw - w, x))
    out = np.zeros(shape, dtype=bool)
    out[y:y + h, x:x + w] = m
    return out


def profile(m, samples=26):
    ys, xs = np.nonzero(m)
    top, bot = ys.min(), ys.max()
    rows = []
    wmax = 0
    for s in range(samples):
        t = s / (samples - 1)
        y = int(round(bot - t * (bot - top)))
        r = np.nonzero(m[y])[0]
        wp = (r.max() - r.min() + 1) if len(r) else 0
        wmax = max(wmax, wp)
        rows.append((t, y, wp))
    return [(t, y, wp / wmax if wmax else 0) for t, y, wp in rows]


def main():
    ref_path = sys.argv[1]
    ren_path = sys.argv[2]
    thresh = int(sys.argv[3]) if len(sys.argv) > 3 else 70
    out_path = sys.argv[4] if len(sys.argv) > 4 else "compare_top.png"

    refm = photo_mask(ref_path, thresh)
    renm = render_mask(ren_path)
    refn, rw, rh = _norm(refm)
    renn, mw, mh = _norm(renm)

    print(f"reference bbox aspect  = {rw/rh:.3f}")
    print(f"render    bbox aspect  = {mw/mh:.3f}   (true controller = 1.500)")

    canvas = (CANVAS_H, CANVAS_W)
    refc = place(refn, canvas)
    renc = place(renn, canvas)

    img = np.full((CANVAS_H, CANVAS_W, 3), 255, dtype=np.uint8)
    img[renc] = (200, 235, 200)
    img[outline(refc)] = (220, 20, 20)
    img[outline(renc) & refc] = (90, 90, 90)
    Image.fromarray(img).save(out_path)
    print("wrote", out_path)

    pr = profile(refc)
    pm = profile(renc)
    print(f"\n{'t':>6} {'ref_w':>8} {'model_w':>8} {'diff':>8}")
    for (t, _, a), (_, _, b) in zip(pr, pm):
        print(f"{t:6.3f} {a:8.3f} {b:8.3f} {b-a:+8.3f}")


if __name__ == "__main__":
    main()
