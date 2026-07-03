# Demo media

These files are referenced by the extension README (and therefore the Marketplace
overview page) via absolute `raw.githubusercontent.com` URLs on the `main` branch, so
they render on the Marketplace without being shipped inside the `.vsix`.

Drop the following files here (keep the exact names — the README points at them):

| File | Shows | Suggested content |
|---|---|---|
| `mermaid-panzoom.gif` | Mermaid pan / zoom & fit-to-screen | Open a `.md` with a Mermaid diagram in the MPE preview. Drag to pan, ⌘/Ctrl+scroll to zoom, click **⛶** to fit, press Esc. |
| `light-dark-toggle.gif` | One-lever light / dark | Run **MD Pretty View: Toggle Light / Dark** a couple of times so the whole page + code blocks flip together. |
| `math-light-1.png` | Math (KaTeX) — light theme | Screenshot the rendered inline + block math from the example page in light mode. |
| `math-dark-1.png` | Math (KaTeX) — dark theme | Same math screenshot in dark mode. |

## Recording tips

- Record the VS Code preview pane only, not the whole screen — keeps the file small and readable.
- Target ~720px wide (the README sizes the images to 720px) and keep clips short (5–10s).
- Export as an optimized **GIF** (loops and autoplays on the Marketplace). Aim for < 5 MB each.
  - macOS: [Kap](https://getkap.co/) or [Gifski](https://gif.ski/) work well.
- After adding the files, commit and push to `main` so the raw URLs resolve, then bump
  the version and push a `md-pretty-view-v*` tag to publish.
