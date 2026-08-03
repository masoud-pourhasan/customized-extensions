# Change Log

## 0.2.6

- The effort indicator showed a stale value after changing effort level (e.g. via Claude Code's own picker) until a new assistant turn happened in the active session — it prioritized the last effort recorded in the session transcript over the live global setting, the opposite of how the Model indicator behaves (global setting primary, session's actual last-used value only as supplementary tooltip text). Effort now follows the same pattern: shows the current setting immediately, with the session's last-used value noted separately when it differs.
- Clicking the usage status bar item already re-read `~/.claude.json` fresh for its detail popup, but left the persistent status bar text and sidebar showing whatever was there before — now the click also refreshes those, so one click resyncs everything usage-related without a window reload.
- Usage numbers can legitimately lag behind what Claude Code's own UI shows, since they mirror Claude Code's local cache rather than a live query, and that cache doesn't refresh on the same cadence Claude Code's own live status does. Added a persistent note (status bar tooltip, sidebar footer, usage quick-pick) pointing at `/status` in a Claude Code session for the current figures, rather than only calling this out when the cache is stale enough to trip the reset-time check.

## 0.2.5

- The model picker and the display-name prettifier were two separately hand-maintained lists that had drifted apart — newly released models (e.g. Opus 5) were missing from both, so they fell back to a raw/guessed label and couldn't be selected at all. Unified them into one `MODEL_CATALOG`, added the missing models, and made the 1M-context option generic instead of hardcoded per-model.
- Neither list recognized bare model aliases (`opus`, `sonnet`, `fable`, `haiku`) — the form Claude Code itself writes to `settings.json` when you run `/model sonnet` (confirmed against `claude --model`'s own docs and a real `settings.json` in the wild, which had `"model": "sonnet"`, not a full id). These now resolve and display correctly, alongside pinned full/dated ids.
- The effort-level picker only offered `high`/`medium`/`low`, silently missing `xhigh` and `max` — both real, documented values (`claude --effort`), and `xhigh` in particular is a common current setting. Picking any of the three offered options would have downgraded a user already on `xhigh`. Now offers all five.
- Usage limits (5h/weekly) are only refreshed by Claude Code itself, not continuously — once a window's own reset time has passed, the cached percentage is a leftover from before that reset, not current usage. The status bar, sidebar, and usage quick-pick now flag stale windows (⚠) instead of presenting an outdated number with confidence, and stale values no longer trigger the warning/error color.
- The usage cache file (`~/.claude.json`) lives outside the directory the extension was already watching, so updates to it only showed up on the next poll tick (up to `pollIntervalSeconds`). Now watched directly for near-immediate updates.

## 0.2.4

- The Marketplace overview page's README renderer doesn't honor `<picture>`/`prefers-color-scheme`, so the light-theme screenshot never showed — only the dark fallback did. Replaced with two plain, always-visible images (dark, then light) stacked in the README.

## 0.2.3

- Fixed a display bug where a usage limit scoped to a specific model showed up as `weekly_scoped ([object Object])` — Claude Code's `scope` field is an object (e.g. the model's display name), not a string. Now shown as `Weekly Scoped (Fable)`.
- Usage and effort quick-pick labels are now capitalized and no longer show raw snake_case/camelCase identifiers (`session`, `weekly_all`, `high`, `acceptEdits`) — shown as `Session`, `Weekly All`, `High`, `Accept Edits`, etc. This also applies to the effort and mode text in the status bar and sidebar panel, which previously showed the raw lowercase value.
- Updated the README screenshots to reflect the corrected capitalization.

## 0.2.2

- Added an annotated screenshot to the README (light and dark) showing the three surfaces — sidebar panel, editor title bar icon, status bar — with numbered markers.

## 0.2.1

- Status bar items now use a much higher priority band so they stay grouped together and ahead of other extensions' items (e.g. GitHub Copilot's), which was wedging itself in the middle of the group.

## 0.2.0

- Replaced the placeholder icon with a proper Claude-style 8-point sparkle, generated for symmetry and shared across every surface.
- Added a Marketplace/Extensions-list icon (`resources/icon.png`) — previously unset, so the Extensions view showed a generic placeholder.
- Fixed the editor title bar icon rendering as invisible black-on-black in dark themes: VS Code does not theme `editor/title` command icons the way it themes Activity Bar icons, so the normal/warning/error states now ship with real baked-in brand colors (orange / amber / red) instead of relying on automatic theming.

## 0.1.1

- Added a dedicated sidebar panel (activity bar view) with all four indicators, per-limit progress bars, and Refresh/Choose-surfaces buttons.
- Added an editor title bar button (icon-only, per VS Code API constraints) that swaps shape as usage rises.
- Indicators can now be shown in the status bar, the sidebar, and/or the editor title bar in any combination — toggle via **Claude Companion: Choose Where Indicators Appear…** or the `claudeCompanion.surface.*` settings.

## 0.0.1

- Initial release: status bar indicators for Claude Code's current model, effort level, session permission mode, and usage limits, read locally from Claude Code's own config and session files.
- Quick pickers to change model and effort level for new sessions.
