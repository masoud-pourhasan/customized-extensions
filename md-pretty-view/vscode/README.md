# MD Pretty View

A clean, polished look for **[Markdown Preview Enhanced](https://marketplace.visualstudio.com/items?itemName=shd101wyy.markdown-preview-enhanced)** (MPE), with two features it doesn't ship on its own:

- **Mermaid pan / zoom & fit-to-screen** — drag to pan, Ctrl/⌘+scroll (or the +/− buttons) to zoom, double-click to reset, and a **⛶ fit-to-screen** button that fills the viewport with the whole diagram crisply (Esc to exit). Works in the live preview *and* in HTML export.
- **One-lever light/dark** — a single switch flips the whole page *and* the code surface together, independent of your VS Code editor theme, with a consistent syntax palette that stays readable in both modes.

## Usage

Open any `.md` file, then open the Markdown Preview Enhanced preview:

| Action | macOS | Windows / Linux |
|---|---|---|
| Open preview | `⌘ ⇧ V` | `Ctrl ⇧ V` |
| Open preview to the side | `⌘ K` then `V` | `Ctrl K` then `V` |

Run these from the Command Palette (`⌘ ⇧ P` / `Ctrl ⇧ P`):

| Command | What it does |
|---|---|
| **MD Pretty View: Apply Theme (Global)** | Installs the styling and sets the recommended MPE settings. |
| **MD Pretty View: Toggle Light / Dark** | Flips the light/dark lever. |
| **MD Pretty View: Remove Theme (Global)** | Removes the installed files (backups kept). |

On first run the extension offers to apply the theme automatically. After applying, reload the window.

## Requirements

- **Markdown Preview Enhanced** (`shd101wyy.markdown-preview-enhanced`) — installed
  automatically as an extension dependency.

## Note on script execution

The Mermaid pan/zoom feature runs a small script in the MPE preview, so applying the
theme enables `markdown-preview-enhanced.enableScriptExecution`. If you prefer not to
run preview scripts, disable that setting (pan/zoom will stop working; all other styling
remains).

## License

MIT
