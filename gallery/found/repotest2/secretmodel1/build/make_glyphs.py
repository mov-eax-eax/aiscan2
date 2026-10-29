"""
Generate the ABXY glyph textures and the Xbox guide logo.

Run with the SYSTEM python (3.9), not Blender's: Blender bundles no PIL, so the
textures have to exist on disk before the Blender build step runs.

    "C:\\Program Files\\Python39\\python.exe" make_glyphs.py

Colours are authored as LINEAR values (to match the Principled base colours used
elsewhere) and converted to sRGB before being written, because an image texture
is interpreted as sRGB by default -- writing the linear numbers straight in would
make every button render washed out.
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = r"F:\repotest2\secretmodel1\build\tex"
SIZE = 512

# Same linear values as BUTTON_COLOURS in stage2_controls.py
BUTTON_COLOURS = {
    'Y': (0.85, 0.72, 0.02),
    'X': (0.02, 0.28, 0.85),
    'B': (0.80, 0.05, 0.03),
    'A': (0.10, 0.72, 0.05),
}
GUIDE_LIN = (0.80, 0.81, 0.82)

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\arialbd.ttf",
    r"C:\Windows\Fonts\seguisb.ttf",
    r"C:\Windows\Fonts\segoeuib.ttf",
    r"C:\Windows\Fonts\arial.ttf",
]


def lin_to_srgb(c):
    c = max(0.0, min(1.0, c))
    return c * 12.92 if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055


def rgb255(lin):
    return tuple(int(round(lin_to_srgb(v) * 255)) for v in lin)


def find_font():
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            return p
    return None


def centred_text(d, text, font, size=SIZE):
    bb = d.textbbox((0, 0), text, font=font)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    return ((size - w) / 2 - bb[0], (size - h) / 2 - bb[1])


def draw_letter(path, letter, bg, fg, frac=0.44):
    img = Image.new("RGB", (SIZE, SIZE), bg)
    d = ImageDraw.Draw(img)
    fp = find_font()
    if fp:
        font = ImageFont.truetype(fp, int(SIZE * frac))
    else:
        font = ImageFont.load_default()
    d.text(centred_text(d, letter, font), letter, font=font, fill=fg)
    img.save(path)
    return path


def draw_xbox_logo(path, bg, fg):
    """Approximate the Xbox sphere mark: a ring with a bold X through it."""
    img = Image.new("RGB", (SIZE, SIZE), bg)
    d = ImageDraw.Draw(img)
    cx = cy = SIZE / 2.0
    R = SIZE * 0.30
    ring_w = SIZE * 0.042
    d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=fg, width=int(ring_w))

    stroke = SIZE * 0.086
    a = R * 0.62
    for sy in (1, -1):
        d.line([cx - a, cy - sy * a, cx + a, cy + sy * a],
               fill=fg, width=int(stroke))
    # rounded caps
    for (px, py) in ((cx - a, cy - a), (cx + a, cy + a),
                     (cx - a, cy + a), (cx + a, cy - a)):
        d.ellipse([px - stroke / 2, py - stroke / 2,
                   px + stroke / 2, py + stroke / 2], fill=fg)
    img.save(path)
    return path


def main():
    os.makedirs(OUT, exist_ok=True)
    fg = (18, 18, 20)          # glyphs are near-black on the coloured caps
    fp = find_font()
    print("font:", fp if fp else "DEFAULT (no TTF found)")
    for lab, lin in BUTTON_COLOURS.items():
        p = os.path.join(OUT, f"btn_{lab}.png")
        draw_letter(p, lab, rgb255(lin), fg)
        print(f"  {lab}: {p}  bg={rgb255(lin)}")
    p = os.path.join(OUT, "guide.png")
    draw_xbox_logo(p, rgb255(GUIDE_LIN), fg)
    print(f"  guide: {p}  bg={rgb255(GUIDE_LIN)}")


if __name__ == "__main__":
    main()
