# MD Pretty View

A clean, polished look for **[Markdown Preview Enhanced](https://marketplace.visualstudio.com/items?itemName=shd101wyy.markdown-preview-enhanced)** (MPE), with two features it doesn't ship on its own:

### Mermaid pan / zoom & fit-to-screen

Drag to pan, Ctrl/⌘+scroll (or the +/− buttons) to zoom, double-click to reset, and a **⛶ fit-to-screen** button that fills the viewport with the whole diagram crisply (Esc to exit). Works in the live preview *and* in HTML export.

<!-- <img src="https://raw.githubusercontent.com/masoud-pourhasan/customized-extensions/main/md-pretty-view/vscode/media/mermaid-panzoom.gif" alt="Mermaid pan, zoom and fit-to-screen demo" width="100%" /> -->

### One-lever light / dark

A single switch flips the whole page *and* the code surface together, independent of your VS Code editor theme, with a consistent syntax palette that stays readable in both modes.

<!-- <img src="https://raw.githubusercontent.com/masoud-pourhasan/customized-extensions/main/md-pretty-view/vscode/media/light-dark-toggle.gif" alt="One-lever light and dark mode toggle demo" width="100%" /> -->

## Example page

A single page that exercises every capability of the extension in one place.

### Consistent syntax palette

The same editor-style palette is applied to every language, in both the live preview and
exported HTML, regardless of your VS Code theme.

#### Codes

<img src="https://raw.githubusercontent.com/masoud-pourhasan/customized-extensions/main/md-pretty-view/vscode/media/code-light-1.png" alt="C#, TypeScript, Python, Bash — light theme" width="49%" /> <img src="https://raw.githubusercontent.com/masoud-pourhasan/customized-extensions/main/md-pretty-view/vscode/media/code-dark-1.png" alt="C#, TypeScript, Python, Bash — dark theme" width="49%" />

<img src="https://raw.githubusercontent.com/masoud-pourhasan/customized-extensions/main/md-pretty-view/vscode/media/code-light-2.png" alt="JSON, SQL — light theme" width="49%" /> <img src="https://raw.githubusercontent.com/masoud-pourhasan/customized-extensions/main/md-pretty-view/vscode/media/code-dark-2.png" alt="JSON, SQL — dark theme" width="49%" />

### Mermaid pan / zoom & fit-to-screen

Hover a diagram and use the controls: **drag** to pan, **⌘/Ctrl + scroll** (or the +/−
buttons) to zoom, **double-click** to reset, and **⛶** to fit the whole diagram to the
viewport (Esc to exit).

#### Diagrams

<img src="https://raw.githubusercontent.com/masoud-pourhasan/customized-extensions/main/md-pretty-view/vscode/media/diagram-light-1.png" alt="Mermaid diagrams — light theme" width="49%" /> <img src="https://raw.githubusercontent.com/masoud-pourhasan/customized-extensions/main/md-pretty-view/vscode/media/diagram-dark-1.png" alt="Mermaid diagrams — dark theme" width="49%" />

### Math (KaTeX)

Inline math renders too: the toggle cost is $O(1)$ per switch.

$$
\text{contrast}(fg, bg) = \frac{L_{\max} + 0.05}{L_{\min} + 0.05}
$$

### Horizontal rule & footnote

Above each numbered section is a horizontal rule (`---`). Footnotes work as well.[^1]

[^1]: Footnote text — check that it renders legibly in both light and dark modes.

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
