# Change Log

## 0.0.2

- Fix: write the theme to the config folder Markdown Preview Enhanced actually reads (`~/.local/state/crossnote` on macOS/Linux, `~/.crossnote` on Windows, or `$XDG_CONFIG_HOME/crossnote` / the `markdown-preview-enhanced.configPath` setting when set) instead of always `~/.crossnote`, so the styling applies.
- Fix: Mermaid pan/zoom now works. "Apply Theme" also installs the theme into each open workspace's `.crossnote/` folder (added to `.gitignore`), because the pan/zoom script must live at the workspace root for MPE to load it in the preview.
- "Toggle Light / Dark" now flips the lever in both the global and workspace `style.less` copies.
- "Remove Theme" also removes the workspace-local copies.
- Fix: the VS2019 code palette now also applies in HTML export / "Open in Browser". Export swaps MPE's `vscode.css` code theme for `default.css` (which ignores the `--prism-*` variables), so the token colors are now bound directly to the palette and no longer depend on which prism theme MPE loads.

## 0.0.1

- Initial release: VS2019 theme for Markdown Preview Enhanced.
- One-lever light/dark, VS2019 code palette, styled Mermaid diagrams, Mermaid pan/zoom.
- Commands to apply, remove, and toggle light/dark.
