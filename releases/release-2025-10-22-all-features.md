# Release Notes - 2025-10-22

## Features & Improvements

- **Editor Toolbar UX**: Made the TipTap editor toolbar sticky and enforced light mode for improved usability.
- **SuiteHeader UI**: Added rounded top corners for a modern look.
- **Cells Sharing**: Enabled Supabase-based sharing for Cells, including popover UI for search, role management, copy link, and inbox integration.
- **Tab Persistence**: Tabs now persist across refreshes using localStorage as a backup.
- **Docs/NobleDocs Import**: Added import support for .html, .txt, and .md files in Docs and NobleDocs editors.
- **Tab Title Sync**: Docs tab titles now sync with document names for clarity.

## Technical Changes

- Updated `src/components/tiptap-templates/simple/simple-editor.tsx` for sticky toolbar and light mode.
- Updated `src/components/suite/suite-header.tsx` for rounded corners.
- Updated `src/features/cells/cells-editor.tsx` to wire up Supabase sharing and popover UI.
- Updated `src/components/layout/tabs-context.tsx` to add localStorage fallback for tabs.
- Updated `src/features/docs/docs-editor.tsx` for tab title sync and import support.
- Updated `src/components/docs/nobledoc-editor-screen.tsx` for import support.

## Validation

- TypeScript typecheck passed successfully.
- All features verified and described in summary.

## Next Steps

- Doc-level sharing parity and richer import (docx/pdf) can be added in future releases upon request.

---

_Release generated on 2025-10-22. All major requested features and UI improvements are now live._
