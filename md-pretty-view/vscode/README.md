# MD Pretty View

A clean, polished look for **[Markdown Preview Enhanced](https://marketplace.visualstudio.com/items?itemName=shd101wyy.markdown-preview-enhanced)** (MPE):

- **One-lever light/dark** — a single `color-scheme` keyword flips the whole page *and* the code surface, independent of your VS Code editor theme.
- **Consistent syntax palette** — a crisp Light / Dark editor-style palette applied to every language, so code stays readable in both modes and looks the same in the live preview and in exported HTML, regardless of your VS Code editor theme.
- **Styled Mermaid diagrams** — readable flowcharts and sequence diagrams in both modes.
- **Mermaid pan / zoom** — drag to pan, Ctrl/⌘+scroll (or +/− buttons) to zoom, double-click to reset, and a **⛶ fit-to-screen** button that fills the viewport with the whole diagram crisply (Esc to exit). Works in the live preview and in HTML export.

## How it works

MPE reads per-user styling from its config folder (`~/.local/state/crossnote` on
macOS/Linux, `~/.crossnote` on Windows, or `$XDG_CONFIG_HOME/crossnote` / the
`markdown-preview-enhanced.configPath` location when set). This extension bundles the
styling and, on request, copies it there. It **never overwrites silently** — existing
files are backed up to `*.bak` first.

For **Mermaid pan/zoom** the script must load from the workspace root, so applying the
theme also copies the styling into each open workspace's `.crossnote/` folder and adds
`.crossnote/` to that workspace's `.gitignore`. Styling still works globally without an
open workspace; pan/zoom only works where the workspace copy is present.

## Requirements

- **Markdown Preview Enhanced** (`shd101wyy.markdown-preview-enhanced`) — installed
  automatically as an extension dependency.

## Usage

On first run the extension offers to apply the theme. You can also run these from the
Command Palette:

| Command | What it does |
|---|---|
| **MD Pretty View: Apply Theme (Global)** | Copies the styling into the MPE config folder and each open workspace's `.crossnote/`, and sets the recommended MPE settings. |
| **MD Pretty View: Toggle Light / Dark** | Flips the `color-scheme` lever in the global and workspace `style.less` copies. |
| **MD Pretty View: Remove Theme (Global)** | Deletes the installed files, including workspace copies (leaves any `.bak` backups). |

After applying, reload the window and open any `.md` → **Markdown Preview Enhanced: Open Preview to the Side**.

## Note on script execution

The Mermaid pan/zoom feature runs a small script in the MPE preview, so applying the
theme enables `markdown-preview-enhanced.enableScriptExecution`. If you prefer not to
run preview scripts, disable that setting (pan/zoom will stop working; all other styling
remains).

## License

MIT
