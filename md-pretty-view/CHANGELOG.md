# Change Log

## 0.0.2

- Fix: write the theme to the config folder Markdown Preview Enhanced actually reads (`~/.local/state/crossnote` on macOS/Linux, `~/.crossnote` on Windows, or `$XDG_CONFIG_HOME/crossnote` / the `markdown-preview-enhanced.configPath` setting when set) instead of always `~/.crossnote`, so the styling applies.
- Fix: Mermaid pan/zoom now works. "Apply Theme" also installs the theme into each open workspace's `.crossnote/` folder (added to `.gitignore`), because the pan/zoom script must live at the workspace root for MPE to load it in the preview.
- "Toggle Light / Dark" now flips the lever in both the global and workspace `style.less` copies.
- "Remove Theme" also removes the workspace-local copies.
- Fix: the C# code palette now also applies in HTML export / "Open in Browser". Export swaps MPE's `vscode.css` code theme for `default.css` (which ignores the `--prism-*` variables), so the token colors are now bound directly to the palette and no longer depend on which prism theme MPE loads.
- Mermaid: double-clicking the +/− /reset buttons no longer triggers a reset (rapid button clicks are no longer hijacked by the double-click-to-reset gesture).
- Mermaid: new **⛶ fit-to-screen** control fills the viewport with the whole diagram, crisply (vector-resized, no quality loss). Press the ⛶ button or Esc to exit; double-click re-fits while filled. Works in both the VS Code preview and exported HTML.
- Mermaid: Ctrl/⌘ + mouse-wheel now zooms the diagram in the VS Code preview instead of zooming the whole preview page. (MPE has its own `document`-level Ctrl+wheel page-zoom; our handler now runs first on `window` and suppresses it only when the cursor is over a diagram.)
- The C# code palette applies only to C# code blocks now; every other language keeps its own highlighter colors, so the theme is generic. Removed all "Visual Studio 2019" branding.
- Fix: "Toggle Light / Dark" now actually switches the preview and is independent of the VS Code editor theme. The lever now lives only in the global `style.less` (a duplicate in the workspace copy could override it), and the toggle no longer accidentally edits a `color-scheme` example inside a CSS comment (LESS preserves `/* */` comments) instead of the real rule.

## 0.0.1

- Initial release: a clean theme for Markdown Preview Enhanced.
- One-lever light/dark, a C# code palette, styled Mermaid diagrams, Mermaid pan/zoom.
- Commands to apply, remove, and toggle light/dark.
