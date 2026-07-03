# Shared

Single source of truth for the MD Pretty View markdown theme, reused by every
target (VS Code + browsers) so a Markdown file renders identically everywhere.

| Item | Purpose |
|---|---|
| `crossnote/` | The theme itself: `style.less` (light/dark lever + VS2019 palette), `parser.js`, `head.html`, `config.js`, `mermaid-panzoom.js`. Consumed directly by Markdown Preview Enhanced. |
| `icon.svg` | Icon source; the VS Code extension renders it to `icon.png`. |

## How each target consumes this

- **VS Code** (`../vscode`): `npm run sync` copies `crossnote/` into
  `vscode/assets/crossnote` (runs automatically on `postinstall` and
  `vscode:prepublish`). Edit the theme here, never in `vscode/assets`.
- **Browsers** (`../chrome`, `../edge`, `../firefox`, `../safari`): they inject
  a compiled `theme.css`. Browsers can't consume `.less` directly, so a LESS
  build step (e.g. `lessc crossnote/style.less theme.css`) is still needed to
  produce each browser's `theme.css`.
