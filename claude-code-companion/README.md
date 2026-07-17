# Claude Code Companion

Copilot-style indicators for the official **Claude Code for VS Code** extension. Shows the current **model**, **effort level**, **session permission mode**, and **usage limits** in the VS Code status bar, with quick pickers to change what can be changed.

> VS Code does not allow one extension to inject UI into another extension's webview, so these indicators live in the status bar (like GitHub Copilot's) rather than literally inside the Claude chat input.

## Indicators

| Item | Shows | Click action |
|---|---|---|
| `✦ Fable 5 · 1M` | Configured model (from `~/.claude/settings.json`), `· 1M` for 1M-context variants | Quick pick to change the model for new sessions |
| `⏱ high` | Effort level | Quick pick to change the effort level |
| `⚡ auto` | Permission mode of the most recent session in this workspace (read from the session transcript), plus context-window fill in the tooltip | Explains how to switch modes (Shift+Tab in the Claude input) |
| `~ 5h 4% · 7d 13%` | 5-hour and weekly usage limits with reset countdowns in the tooltip; turns yellow/red near the limit | Detailed usage breakdown |

## How it works

Everything is read locally — no network requests, no API keys:

- `~/.claude/settings.json` — model and effort level (also written back when you use the pickers).
- `~/.claude.json` → `cachedUsageUtilization` — usage percentages that Claude Code itself refreshes.
- `~/.claude/projects/<workspace>/*.jsonl` — session transcripts, for the per-session permission mode, actual model used, and token counts.

Files are watched and additionally polled (default every 10 s, configurable).

## Settings

- `claudeCompanion.showModel` / `showEffort` / `showMode` / `showUsage` — toggle each indicator.
- `claudeCompanion.pollIntervalSeconds` — polling interval (default 10).
- `claudeCompanion.usageWarningPercent` / `usageErrorPercent` — color thresholds (default 70 / 90).

## Caveats

- Model/effort changes apply to **new** Claude Code sessions; a running session keeps its current model until you change it in-session (`/model`).
- The mode indicator reflects the **most recently active** session for this workspace — with several parallel sessions it shows the latest one.
- Usage data is as fresh as Claude Code's own cache (the tooltip shows when it was last updated).

## Development

No build step — plain JavaScript, zero dependencies. Open this folder in VS Code and press `F5`, or package with `npx @vscode/vsce package`.
