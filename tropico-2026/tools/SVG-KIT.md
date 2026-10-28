# SVG-KIT — tested recipes for painting in SVG
Rendered with librsvg 2.40.20 via ImageMagick on Windows. Everything below was
rendered and inspected. Do not invent filter tricks without rendering and looking.

## Render

    magick -background none <file.svg> -resize 1600x <file>.png

or

    pwsh -File F:\repo-aiscan2\tropico-2026\tools\render.ps1 -Svg <file.svg>

Then open the PNG with the image tool and LOOK at it. Do not trust the markup.
Sanity check: PNG over ~150 KB means real content rendered; a 20 KB PNG means a blank
or clipped filter.

## Canvas

    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1200" width="1600" height="1200">

Author in viewBox units of 1600x1200. Never nest <svg> with another viewBox unless you
know why.

---

## 1. GRAIN (the difference between paint and plastic) — TESTED

    <filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0
                                           0 0 0 0 0
                                           0 0 0 0 0
                                           0.30 0.30 0.30 0 0"/>
    </filter>
    ...
    <rect width="1600" height="1200" filter="url(#grain)" opacity="0.14"/>

Black noise, alpha from luminance. Last element. 0.10–0.20 opacity.
Lighter grain variant (for bright/high-key pieces): same but feColorMatrix last row
`0.30 0.30 0.30 0 0` replaced with white — use a white rect and alpha from the inverse,
i.e. keep black grain but drop opacity to 0.08 and add a second white-grain rect at
opacity 0.06 with feColorMatrix last row `0 0 0 0 0 / 0 0 0 0 0 / 0 0 0 0 0 / -0.3 -0.3 -0.3 0 0.3`.
Test it; approximate grain is fine, clipped grain is not.

## 2. SOFT SHADOW — TESTED

    <filter id="b14" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
    <ellipse cx="600" cy="800" rx="240" ry="46" fill="#000" opacity="0.6" filter="url(#b14)"/>

Blur filters need the big region or they clip to a rectangle. Two shadows per object:
a tight dark contact shadow (opacity .8, blur 8) and a wide soft ambient one (opacity .35, blur 30).
Shadows tinted toward the shadow colour of the scene, not pure black.

## 3. EDGE BREAK-UP / PAINTERLY CONTOUR — TESTED (with caveat)

    <filter id="rough" x="-15%" y="-15%" width="130%" height="130%">
      <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="4" result="t"/>
      <feDisplacementMap in="SourceGraphic" in2="t" scale="5" xChannelSelector="R" yChannelSelector="G"/>
    </filter>

Apply to a GROUP of large opaque shapes. Scale 2–6 at 1600px. Generous region.
CAVEAT: applying this to broad LOW-OPACITY washes produces hard rectangular seams where
the filter region ends. For washes use blurred radial gradients instead of translucent paths.

## 4. FORM SHADING (the way to avoid plastic spheres)

Do not rely on a single radialGradient for a 3D object. Bake three layers:

    <ellipse ... fill="url(#baseGrad)"/>                                  <!-- local colour -->
    <ellipse ... fill="#1a0c05" opacity="0.55" filter="url(#b14)"         <!-- terminator -->
       transform="translate(24,18)"/>                                     <!-- shadow side -->
    <ellipse ... fill="#fff2cc" opacity="0.35" filter="url(#b6)"/>        <!-- light side -->
    <ellipse ... fill="#fffdf0" opacity="0.85" filter="url(#b2)"/>        <!-- specular -->

Place the light side offset toward the sun; keep the terminator soft and let it spill
over the contour a little. Inside a clipped group, so it never leaves the object.

## 5. WASHES / ATMOSPHERE

    <radialGradient id="pool" cx="0.35" cy="0.2" r="0.7">
      <stop offset="0" stop-color="#ffe9c0" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#ffe9c0" stop-opacity="0"/>
    </radialGradient>

Radial gradients with a transparent stop = light pools, haze, glow, colour bounce.
They never seam. This is the workhorse of atmosphere.

## 6. TEXTURE WITH PATTERNS — safe

    <pattern id="weave" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="none"/>
      <path d="M0 3 H6 M3 0 V6" stroke="#000" stroke-width="0.5" opacity="0.25"/>
    </pattern>

Fine patterns at low opacity read as canvas/tile/hatch. Safe in librsvg; keep the tile
small (4–10 px) and the opacity below .3 or it moirés at 1600px.
Do NOT scale patterns with transforms on the patterned element unless you verify.

## 7. THINGS librsvg 2.40 does NOT do well

- CSS `mix-blend-mode` / `isolate` — NOT supported. Use opacity + dark/light overlays.
- `filter` chains with `feBlend` against a transparent SourceGraphic → grey wash.
  Blend against opaque content only.
- Very large blur radii (> 120) are slow and can band. Stack two medium blurs instead.
- `textPath`, CSS `filter:`, `backdrop-filter` — avoid.
- Fonts: only generic families render reliably. Prefer NO text. If a stamp or stencil is
  needed, letter it as simple vector paths or accept "Georgia, serif" as a shape.
- Emoji do not render.

## 8. Composition checks

- Render at 1600 for detail, then downscale a copy to 400 wide and look again. The piece
  must survive the thumbnail.
- Squint test: convert to greyscale (`magick in.png -colorspace Gray out.png`) and check
  you still have 4 distinct value masses and one bright event.
- Check the 4 corners of the canvas for accidental clipping or empty dead space.

## 9. Performance

Filters are expensive; librsvg re-renders them at target resolution. If a render takes
more than ~30 s, reduce numOctaves / blur radii, or cache a texture as a <pattern>.
