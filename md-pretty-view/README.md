# MD Pretty View

A beautiful **Visual Studio 2019** look for **[Markdown Preview Enhanced](https://marketplace.visualstudio.com/items?itemName=shd101wyy.markdown-preview-enhanced)** (MPE):

- **One-lever light/dark** — a single `color-scheme` keyword flips the whole page *and* the code palette, independent of your VS Code editor theme.
- **VS 2019 code palette** — authentic VS2019 Light / Dark syntax colors in fenced code blocks.
- **Styled Mermaid diagrams** — readable flowcharts and sequence diagrams in both modes.
- **Mermaid pan / zoom** — drag to pan, Ctrl/⌘+scroll (or +/− buttons) to zoom, double-click to reset. Works in the live preview and in HTML export.

## How it works

MPE reads per-user styling from `~/.crossnote/`. This extension bundles the styling
and, on request, copies it there. It **never overwrites silently** — existing files are
backed up to `*.bak` first.

## Requirements

- **Markdown Preview Enhanced** (`shd101wyy.markdown-preview-enhanced`) — installed
  automatically as an extension dependency.

## Usage

On first run the extension offers to apply the theme. You can also run these from the
Command Palette:

| Command | What it does |
|---|---|
| **MD Pretty View: Apply Theme (Global)** | Copies the styling into `~/.crossnote/` and sets the recommended MPE settings. |
| **MD Pretty View: Toggle Light / Dark** | Flips the `color-scheme` lever in `~/.crossnote/style.less`. |
| **MD Pretty View: Remove Theme (Global)** | Deletes the installed files (leaves any `.bak` backups). |

After applying, reload the window and open any `.md` → **Markdown Preview Enhanced: Open Preview to the Side**.

## Note on script execution

The Mermaid pan/zoom feature runs a small script in the MPE preview, so applying the
theme enables `markdown-preview-enhanced.enableScriptExecution`. If you prefer not to
run preview scripts, disable that setting (pan/zoom will stop working; all other styling
remains).

## License

MIT
