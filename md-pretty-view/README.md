# MD Pretty View

A consistent Visual Studio 2019 look for rendered Markdown — one-lever
light/dark theme, VS2019 code palette, styled Mermaid diagrams, and Mermaid
pan/zoom. The same styling is shared across every target so a Markdown file has
the same shape everywhere.

## Layout

| Folder | Target |
|---|---|
| [`shared`](shared) | Source of truth for the theme (reused by all targets). |
| [`vscode`](vscode) | VS Code extension for Markdown Preview Enhanced. |
| [`chrome`](chrome) | Chrome (MV3) extension. |
| [`edge`](edge) | Edge (MV3) extension. |
| [`firefox`](firefox) | Firefox (MV3) extension. |
| [`safari`](safari) | Safari Web Extension (needs Xcode wrapper). |

Edit the theme in [`shared`](shared) only. See [`shared/README.md`](shared/README.md)
for how each target consumes it.
