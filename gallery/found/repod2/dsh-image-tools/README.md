# dsh-image-tools

A DeepSeek Harness plugin that lets agents and users **see images and process them**:

- **See** — `image_preview` and every transform return the processed image as a
  native image block (the same durable mechanism as the built-in `read_image`):
  the routed model sees the image, and the web UI renders it inline in the tool
  card. No base64 in text, no extra client-side plumbing for fetching.
- **Process** — sharp-powered tools for metadata, resize, convert, crop, and
  rotate, with optional sandbox-contained output files.

## Tools

| Tool | Description |
|---|---|
| `image_info` | Read-only metadata: format, dimensions, channels, color space, density, pages, alpha, orientation, byte size. |
| `image_preview` | Show an image: auto-orient, scale to fit `max_size` (default 512 px, no upscaling), return it as a native image block. |
| `image_resize` | Resize with `width`/`height` and a `fit` mode (`cover`, `contain`, `fill`, `inside`, `outside`). |
| `image_convert` | Convert between `png`, `jpeg`, `webp`, `gif` with `quality`. |
| `image_crop` | Crop by exact region (`left`/`top`/`width`/`height`) or anchored by `gravity` (default center). |
| `image_rotate` | Rotate by 90° steps (`degrees`: 0/90/180/270), auto-orient when omitted, plus `flip`/`flop`. |

Every transform accepts an optional `output_path` — the full-size result is
written there through the provider's execution world (the same sandbox that
confines `write`), and a downscaled preview is committed to the attachment
store and returned as the native image block. Attachment-bound images are
automatically refit when they would exceed the deployment's byte/pixel limits,
so a large conversion never fails just because the preview is big.

## Architecture

- **Server half** (`lib/index.js`) — a plain cordis plugin (`name`, `inject`,
  `Config`, `apply`) that registers tools via `ctx.tools.register(defineTool(...))`.
  Input bytes read through the bounded `ctx.fs` seam (`resolve` with the session
  cwd, `stat`, `readBytes`); displayed images committed via
  `ctx.attachments.saveImage`; the image-capability gate mirrors `read_image`
  (a text-only route refuses before any image block enters durable history).
- **Client half** (`lib/client.js`) — a web `dsh.client` bundle that registers
  keyed `tool.call.toolview` rows for each image tool. A settled row expands
  into the inline image(s) (fetched through the session-authorized
  `readAttachment` RPC) plus the model-facing output, with the standard
  trajectory `Inspect` affordance.

## Install

From the workspace root:

```powershell
# 1. copy the package into the web profile's module tree
New-Item -ItemType Directory -Force "$env:USERPROFILE\.dsh\profiles\web\node_modules" | Out-Null
Copy-Item -Recurse ".\dsh-image-tools" "$env:USERPROFILE\.dsh\profiles\web\node_modules\dsh-image-tools"

# 2. add the host-plane row to the profile patch (see cordis.patch.yml)
#    - insert:
#        - id: image-tools
#          name: dsh-image-tools

# 3. restart `dsh web` (or rely on the profile patch hot-reload; a restart is
#    the reliable activation path)
```

Module resolution needs no `pnpm install`: the profile walks up to the
installation's flat fallback (`$DSH_HOME/profiles/node_modules`), which already
links `sharp`, `@deepseek-ai/dsh-tools`, `@deepseek-ai/dsh-fs`,
`@deepseek-ai/dsh-attachment`, and `@deepseek-ai/dsh-llm`.

## Configuration

Optional `image-tools` config keys (profile `cordis.patch.yml` row `config`):

| Key | Default | Meaning |
|---|---|---|
| `maxInputBytes` | `67108864` | Byte cap for reading one input image. |
| `previewMaxSize` | `512` | Largest edge (px) of the attachment-committed preview. |
| `previewFormat` | `webp` | Preview encode format (`webp`/`jpeg`/`png`). |
| `previewQuality` | `72` | Preview quality 1-100. |
| `defaultQuality` | `85` | Default quality for lossy outputs. |

## Model Experience

The tools appear as ordinary function definitions (native presentation); no
system-prompt sections are added, so there is zero fixed per-request token
cost. Each image block is billed like any other image content until compaction.

## Known Limitations

- The attachment store accepts PNG/JPEG/WebP/GIF only, so outputs in other
  formats must use `output_path` (the image block shows a webp preview).
- Animated GIF input is decoded frame-by-frame; the preview shows the first
  frame, and GIF output keeps animation best-effort.
- Output files require the parent directory to exist; no implicit `mkdir`.
