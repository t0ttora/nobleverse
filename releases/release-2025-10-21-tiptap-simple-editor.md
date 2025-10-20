# Release 2025-10-21: Nobledocs TipTap Simple Editor Integration & Cells/Docs File Routing

## ✨ Features

- **Docs: TipTap Simple Editor**
  - Replaced Lexical with a reusable TipTap Simple Editor component (`SimpleEditor`).
  - Toolbar: undo/redo, headings, bold/italic/underline/strike, lists (bullet/ordered/task), alignment, blockquote, link, image upload, highlight, color.
  - Table support (import, edit, render).
  - SSR-safe (immediatelyRender: false).
  - Exposes imperative API (setContent, insertHTML, getHTML, getText).
  - Responsive, dark mode, and modern UI.
- **Docs: Supabase-backed HTML persistence**
  - All docs content is autosaved to the new `docs_data` table (see migration).
  - First non-empty create registers a file in the `files` table (with `.docs` extension).
  - Star/rename support with uniqueness.
  - Import: `.docx`, `.md`, `.xlsx`, `.csv`, `.html` (with table conversion).
  - Export: DOCX via server-side API (`html-to-docx`).
  - Image uploads to Supabase Storage.
- **Cells: FortuneSheet Integration**
  - Spreadsheet editor with import/export (SheetJS, fortune-excel), autosave, registration, rename/star, stable sizing.
  - Opens `.cells`, `.xlsx`, `.xls`, `.csv` in CellsEditor.
- **Files/Browser & Tabs**
  - Files browser and tab system routes `.docs`, `.docx`, `.md` to DocsEditor; `.cells`, `.xlsx`, `.xls`, `.csv` to CellsEditor.
  - Tabs support payload for editor context.
  - Star/rename, persist tabs, split view, and more.
- **Backend**
  - New API: `/api/noblesuite/docs/[id]/data` for docs HTML persistence (with fallback table create).
  - New API: `/api/noblesuite/docs/export` for DOCX export.
  - Migration: `supabase/migrations/20251020T210000_docs_data.sql` creates `docs_data` table with RLS and policies.
- **TypeScript**
  - All editors and APIs typechecked and validated.

## 🛠️ Refactors & Fixes

- Removed all Lexical code and dependencies.
- Fixed SQL migration policy syntax (now uses DO blocks for drop-if-exists).
- Patched Next.js validator types to match handler usage.
- Fixed TipTap SSR hydration error (immediatelyRender: false).
- Cleaned up duplicate code in `SimpleEditor`.
- Improved file open logic in FilesBrowser and tab-content-host.

## 📁 Migration

- Run the migration: `supabase/migrations/20251020T210000_docs_data.sql` to create the `docs_data` table and policies.

## 📝 To-Do

- [ ] Polish link dialog UI in SimpleEditor.
- [ ] Add font family/size and advanced table controls.
- [ ] Add outline panel (headings extraction).
- [ ] Add tests for import/export flows.
- [ ] Remove fallback table create in API if migrations are guaranteed.

---

**Commit & Push:**
- All changes above are included in this release.
- Typecheck and dev server pass.
- Ready for deployment and further polish.
