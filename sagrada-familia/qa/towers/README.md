# Towers & roofs — QA views

Preview harness: `qa/towers/preview.html` (imports `src/towers.js` directly, with a
ground plane, sun + shadows and a static camera). Query parameters:

| param | meaning | default |
|-------|---------|---------|
| `cam` | camera position `x,y,z` | `106,30,132` |
| `look` | look-at point `x,y,z` | `0,70,-4` |
| `fov` | vertical field of view | `58` |
| `exposure` | tone-mapping exposure | `1.02` |

The page logs `[towers-preview] {triangles, meshes, instancedMeshes, colliders,
hotspots}` when it has built the model, and sets `window.__ready` after 3 frames.

## CPU-only preview (no browser, no GPU)

`qa/towers/render-wire.mjs` builds the real geometry and rasterises it with a
z-buffer to a PNG via Node. It is a flat-shaded shape check (no textures,
shadows or lights), useful when headless browsers must stay off the machine:

```powershell
cd F:\repo-aiscan2\sagrada-familia
node --import ./qa/towers/register.mjs qa/towers/render-wire.mjs out.png camX,camY,camZ lookX,lookY,lookZ [fov] [w] [h]
# e.g. plaza-level skyline
node --import ./qa/towers/register.mjs qa/towers/render-wire.mjs qa/towers/cpu-wide.png 104,16,112 0,84,0 58 800 450
```

## Required views

Run **one** browser at a time (the shared `qa/shot.mjs` is GPU-backed now):

```powershell
cd F:\repo-aiscan2\sagrada-familia
$env:SHOT_W='800'; $env:SHOT_H='450'

# 1. plaza-level wide: all eighteen towers / skyline
node qa/shot.mjs "http://127.0.0.1:8141/qa/towers/preview.html" "F:/repo-aiscan2/sagrada-familia/qa/towers/10-wide.png" 6000

# 2. low angle on the apostle bell towers (nativity pair)
node qa/shot.mjs "http://127.0.0.1:8141/qa/towers/preview.html?cam=48,6,30&look=26,62,7&fov=62" "F:/repo-aiscan2/sagrada-familia/qa/towers/11-apostles-low.png" 6000

# 3. Virgin tower + Star of Bethlehem from the plaza side
node qa/shot.mjs "http://127.0.0.1:8141/qa/towers/preview.html?cam=0,150,-6&look=0,136,-52&fov=50" "F:/repo-aiscan2/sagrada-familia/qa/towers/12-virgin-star.png" 6000

# 4. tower of Jesus: lantern, shaft, inscription bands, crown and cross
node qa/shot.mjs "http://127.0.0.1:8141/qa/towers/preview.html?cam=44,178,46&look=0,166,0&fov=48" "F:/repo-aiscan2/sagrada-familia/qa/towers/13-jesus-cross.png" 6000

# 5. roof close oblique: nave/transept gables, crests, parapets, dormers
node qa/shot.mjs "http://127.0.0.1:8141/qa/towers/preview.html?cam=58,78,64&look=0,48,-6&fov=58" "F:/repo-aiscan2/sagrada-familia/qa/towers/14-roofs.png" 6000

# 6. the whole temple from above (all 18 towers + rooflscape)
node qa/shot.mjs "http://127.0.0.1:8141/qa/towers/preview.html?cam=124,110,146&look=0,82,-6&fov=58" "F:/repo-aiscan2/sagrada-familia/qa/towers/15-overview.png" 6000
```

## Headless geometry test (no browser, safe to run any time)

```powershell
cd F:\repo-aiscan2\sagrada-familia
node --import ./qa/towers/register.mjs qa/towers/build-test.mjs
```

It builds every module against a validating fake builder (bad batch entries,
missing instance matrices and triangle budgets fail loudly).

## Integration check (full app)

```powershell
node qa/shot.mjs "http://127.0.0.1:8141/?debug=1&skipSplash=1&mode=fly&pos=100,40,120&look=0,70,0" "F:/repo-aiscan2/sagrada-familia/qa/towers/16-app.png" 9000
```

Expect `window.__errors` to be empty apart from missing optional modules that other
builders are still landing.
