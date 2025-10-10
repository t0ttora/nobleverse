# Release 2025-10-11 — Files: New Folder Dialog UI & Share

## Highlights

- Dialog width set to 60% of viewport; centered, clean shadcn look.
- Left panel redesigned as a folder “card”:
  - Large folder icon, live title below it.
  - Visibility badge (Public/Private) at top-left.
  - Star toggle button at top-right.
  - Color picker anchored at the bottom.
- Right panel hierarchy refined:
  - Name field, then Visibility selector (Public/Private), then “Include items”.
  - Include items shown as a responsive grid of mini-cards (icon, name, size). Click to select.
- Footer actions updated:
  - Buttons: Create, Share (visible only when Public), and Cancel pinned far right.
  - Share mirrors Create (create folder, move selected files) and then generates share links and copies to clipboard. Sonner toast indicates success; if clipboard fails, a fallback dialog shows the links.

## Technical Notes

- UI state extended with `visibility: 'public' | 'private'` for the dialog.
- Star toggle is handled in the left card; if selected, we PATCH `is_starred` after creation.
- Share uses existing Supabase signed/public URL generation for included files and copies links via `navigator.clipboard` with Sonner toasts.
- No server persistence for folder visibility yet; it gates the UI (Share button) only.
- Dialog width via `DialogContent` classes: `sm:max-w-none w-[60vw]`.

## How to Use

1) Go to NobleFiles → New → New Folder.
2) Enter a Name. Set Visibility to Public to enable the Share button.
3) Optionally select items to include using the grid.
4) Choose a color and (optionally) star via the left card.
5) Click Create to make the folder (and move included items), or Share to also copy generated links to the clipboard.

## TODOs

- Persist folder visibility in the database and enforce access rules.
- Generate and copy a single folder-level share link (not only per-file).
- Add expiry presets to Share (5m, 1h, 24h) and integrate with the existing Share dialog.
- Make the right panel scroll independently for long include lists; refine max heights.
- Add search/filter inside the include grid for large folders.
- Validate mobile responsiveness and adjust breakpoints/spacings if needed.
