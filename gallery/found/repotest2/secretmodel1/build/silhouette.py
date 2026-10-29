"""
Extract a clean controller silhouette from a reference photo.

Naive thresholding fails on glossy black objects: specular highlights blow past
the threshold and punch holes in the mask. Instead we:
  1. threshold to find "light" pixels
  2. flood-fill light regions connected to the image border -> true background
  3. everything not reachable is foreground (this absorbs interior highlights)
  4. keep the largest connected component, then binary_fill_holes
  5. emit the width profile per row, normalised to the real-world dimensions
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage


def extract(path, thresh, cols=720, verbose=True):
    im = Image.open(path).convert("L")
    w = cols
    h = int(round(im.height * w / im.width))
    im = im.resize((w, h), Image.LANCZOS)
    im = im.filter(ImageFilter.GaussianBlur(1.2))
    a = np.asarray(im, dtype=np.uint8)

    light = a > thresh  # background candidates

    # label light regions; anything touching the border is background
    lab, n = ndimage.label(light)
    border = set()
    border.update(np.unique(lab[0, :]))
    border.update(np.unique(lab[-1, :]))
    border.update(np.unique(lab[:, 0]))
    border.update(np.unique(lab[:, -1]))
    border.discard(0)
    bg = np.isin(lab, list(border))
    fg = ~bg

    # largest connected component of foreground
    lab2, n2 = ndimage.label(fg)
    if n2 > 1:
        sizes = ndimage.sum(np.ones_like(lab2), lab2, index=range(1, n2 + 1))
        fg = lab2 == (int(np.argmax(sizes)) + 1)
    fg = ndimage.binary_fill_holes(fg)
    fg = ndimage.binary_closing(fg, structure=np.ones((3, 3)), iterations=2)

    if verbose:
        print(f"SRC: {path.split(chr(92))[-1]}  mask {w}x{h}  thresh={thresh}")
        print(f"foreground px: {int(fg.sum())}  ({100.0*fg.sum()/(w*h):.1f}% of frame)")
        # ASCII preview so the mask can be eyeballed
        step = max(1, w // 96)
        print("--- mask preview ---")
        for y in range(0, h, step * 2):
            row = "".join("#" if fg[y, x] else "." for x in range(0, w, step))
            print(f"{y:4d} {row}")

    ys, xs = np.nonzero(fg)
    if len(ys) == 0:
        print("EMPTY MASK")
        return None
    top, bot = int(ys.min()), int(ys.max())
    return fg, top, bot, w, h


def profile(fg, top, bot, w, samples=28, real_w=152.9, real_d=101.9):
    rows = []
    for s in range(samples):
        t = s / (samples - 1)
        y = int(round(bot - t * (bot - top)))
        xs = np.nonzero(fg[y])[0]
        if len(xs) == 0:
            rows.append((t, y, 0, 0.0, 0.0))
            continue
        rows.append((t, y, int(xs.max() - xs.min() + 1),
                     float(xs.min()), float(xs.max())))

    width_px = max(r[2] for r in rows)
    print()
    print("=" * 74)
    print(f"Real-world target : {real_w} mm wide x {real_d} mm deep "
          f"(aspect {real_w/real_d:.3f})")
    print(f"Measured aspect   : {width_px/(bot-top+1):.3f}   "
          f"(perspective will distort this)")
    print("=" * 74)
    print(f"{'t':>6} {'row':>5} {'width_px':>9} {'w_norm':>8} "
          f"{'mm_est':>8} {'xL_norm':>8} {'xR_norm':>8} {'ctr':>7}")
    for t, y, wp, xl, xr in rows:
        print(f"{t:6.3f} {y:5d} {wp:9d} {wp/width_px:8.3f} "
              f"{wp/width_px*real_w:8.1f} {xl/w:8.3f} {xr/w:8.3f} "
              f"{(xl+xr)/2/w:7.3f}")


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else \
        r"F:\repotest2\secretmodel1\ref\Xbox_Series_Controller_Carbon_Black.jpg"
    thresh = int(sys.argv[2]) if len(sys.argv) > 2 else 100
    res = extract(path, thresh)
    if res:
        fg, top, bot, w, h = res
        profile(fg, top, bot, w)
