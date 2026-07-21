# Change Log

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
