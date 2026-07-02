# My VS Code Extensions

A monorepo of my Visual Studio Code extensions. Each extension lives in its own folder.

## Extensions

| Folder | Name | Description |
|---|---|---|
| [`md-pretty-view`](md-pretty-view) | **MD Pretty View** | A beautiful Visual Studio 2019 look for Markdown Preview Enhanced — one-lever light/dark theme, VS2019 code palette, styled Mermaid diagrams, and Mermaid pan/zoom. |

## Working on an extension

```sh
cd <extension-folder>
npm install                 # dev tooling only
npx @vscode/vsce package    # build a .vsix
```

See each extension's own `README.md` for details.
