Title: NobleSuite — Files parity tweaks
Date: 2025-10-15

Changes

- Selection UI parity
  - Grid/list selection check now uses the same circular checkbox button with hover affordances as NobleFiles.
  - Added select-all checkbox in list header for visible rows.

- Card/list context menus
  - Added Star/Unstar and Remove items to both the card overflow menu and right-click context menu.
  - Kept Open and Download actions consistent with Files.

- Sorting behavior
  - In list view, column headers are clickable: Name, Type, and Modified toggle ascending/descending sort.
  - Dropdown-based Sort By remains available.

- Selection action bar
  - When items are selected, a bottom action bar appears with Move, Share, and Delete—mirroring FilesBrowser.
  - Move opens a destination picker for folders; Share generates temporary links for selected files; Delete removes selected.

Notes

- Move/Share are implemented with a lightweight popover flow tailored to NobleSuite items.
- Size sorting remains via dropdown only for now (no dedicated header sort in NobleSuite).
