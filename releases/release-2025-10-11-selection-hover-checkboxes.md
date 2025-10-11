# 2025-10-11 — Files: Always-on Selection + Hover Checkboxes

## Highlights
- Removed Select mode and tooltips; selection is now always available.
- Added hover checkboxes in both Grid and List views for quick toggle.
- Click behavior updated: plain click opens, Ctrl/Cmd toggles, Shift selects range.
- Bottom selection bar appears whenever items are selected (no mode required).
- Keyboard shortcuts ungated: Enter (open), F2 (rename), Delete/Backspace (delete).

## Details
- Removed Select button + Tooltip in the top toolbar.
- Deleted `selectMode` state and gated checks from selection helpers and keyboard handlers:
  - `selectSingle`, `toggleCtrl`, `selectRange`, `isSelected` now independent of a mode.
  - Keyboard shortcuts now work with any non-empty selection.
- Grid view:
  - Replaced left gutter with a small hover checkbox positioned at `left-2 top-2` on each tile.
  - When selected, tiles display a primary border.
  - Thumbnail/button click supports Ctrl/Cmd and Shift selection modifications.
- List view:
  - Header "Select all" checkbox is always active and selects visible files.
  - Each row shows a hover checkbox in the first column; toggles selection.
  - Filename cell supports Ctrl/Cmd and Shift behavior; plain click opens the item.
- "Recent" cards: Support Ctrl/Cmd and Shift selection; otherwise open the file.
- Bottom selection bar: Shows count and primary actions (Move, Send to people, Open, Download, Delete, Clear) whenever `selectedIds.size > 0`.

## In-app Preview
- Files open via an in-app side-panel preview by default (images, video, audio, and PDFs with an info card and embedded iframe). Download remains available.

## API & Supporting Changes
- Added `/api/contacts` (GET) endpoint to power the "Send to people" popover with contact search.
- No database migrations were required.

## Housekeeping
- Removed all Tooltip imports related to Select mode.
- Minor UI polish: kept bottom breadcrumb as primary navigation with drop targets.

## Verification
- Typecheck (tsc): PASS.
- Basic smoke test of selection behaviors in Grid/List and Recent confirmed working.

## Next Ideas
- Unify the folder screen into a single grid under a header (remove separate sections if desired).
- Implement global Recent across all folders if not already backed by API.
- Consider enlarging the hover checkbox hit area slightly for accessibility.
