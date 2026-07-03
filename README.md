# Customized Extensions

A monorepo of my editor and browser extensions. Each project lives in its own
folder and shares a single styling source across every target (VS Code, Chrome,
Edge, Firefox, Safari) so content looks the same everywhere.

## Projects

| Folder | Name | Description |
|---|---|---|
| [`md-pretty-view`](md-pretty-view) | **MD Pretty View** | A Visual Studio 2019 look for Markdown — one-lever light/dark theme, VS2019 code palette, styled Mermaid diagrams, and Mermaid pan/zoom. Shared theme reused by the VS Code extension and the browser extensions. |

Each project is split into `shared/` (the reusable UI/theme, single source of
truth) plus per-target folders (`vscode/`, `chrome/`, `edge/`, `firefox/`,
`safari/`).

## Working on the VS Code extension

```sh
cd md-pretty-view/vscode
npm install                 # dev tooling; syncs shared assets on postinstall
npx @vscode/vsce package    # build a .vsix (re-syncs shared assets first)
```

See each project's own `README.md` for details.
