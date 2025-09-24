## Release 2025-09-24: Settings Modal, shadcn UI, Prefill, and Typecheck Overhaul

### Major Features
- **Settings Modal Redesign**: Replaced legacy settings page with a shadcn-styled modal. All dropdowns now use shadcn Select, with preserved heights and only the content area scrollable. Appearance section matches the provided reference (theme radios, brand color palette, sidebar feature).
- **Supabase Prefill & Persistence**: Settings prefill now merges Supabase `auth.users` (UID, display name, email, phone, provider, created at, last sign-in) with `profiles` data. Saving updates both profiles and auth metadata. All fields are editable and validated.
- **Typecheck Task Update**: `.vscode/tasks.json` now runs a full clean before typechecking, ensuring no stale errors. Hard cache clean instructions added for contributors.
- **Sidebar/Navigation**: Sidebar menu and submenus now reflect user role, with improved structure and shadcn components.

### Fixes & Improvements
- All settings dropdowns converted to shadcn Select; visual heights preserved.
- Only the right content area of the settings dialog scrolls; header/tabs remain static.
- Appearance UI: theme radios, brand color palette, sidebar feature select, and density radios implemented.
- Prefill logic: prioritizes Supabase auth data, falls back to profiles; saving updates both.
- Typecheck task: now runs `pnpm exec tsc -b --clean; pnpm exec tsc -p tsconfig.json --noEmit` via PowerShell for reliable results.
- Hard cache clean instructions: use `pnpm dlx rimraf .next node_modules/.cache tsconfig.tsbuildinfo; pnpm exec tsc -b --clean; pnpm exec tsc -p tsconfig.json --noEmit`.
- Deprecated `username` prop in chat components fully removed from all call sites; only `nobleId` is used.

### Migration Notes
- Run the new typecheck task or the hard clean command above if you see stale TS errors.
- Profile and settings data now merge from both Supabase auth and profiles; ensure your user has both records.

---

See diff in `tmp/last-release.diff` for full details.
