# 2025-10-15 — Dashboard tabs, DnD, collapse, and fixes

## Summary
- Introduced a non-route-based Dashboard Tabs system with pinning, overflow, and Home behavior.
- Persisted tabs state to Supabase (profiles.ui_tabs) with realtime sync across devices.
- Added drag-and-drop tab reordering within pinned and regular groups.
- Implemented collapse modes: bar collapse (icon-only bar), collapse others (only active tab expanded), and expand all.
- Polished UI: consistent icon language, compact overflow menus, subtle Home indicator, and tighter spacing.
- Resolved TypeScript icon typing issues in Create Request and Request Details panels.

## Changes
- Files: Tabs state and UI
  - `src/components/layout/tabs-context.tsx`
    - New TabsProvider with actions: open/close/activate/activateNone/pin/unpin/togglePin.
    - Persistence to `/api/tabs` and Supabase `profiles.ui_tabs`; iconName serialization; realtime updates.
    - New `reorderTab` and collapse controls: `collapseBar`, `collapseOthers`, `collapseNone`.
  - `src/components/layout/tabs-bar.tsx`
    - Renders pinned/regular groups; overflow menu with Pinned label + separator + all tabs.
    - Collapse controls at top of menu; compact width; improved collapsed icon-only spacing.
    - Drag-and-drop reordering (group-constrained) with React.memo optimizations.
  - `src/components/layout/header.tsx`
    - Soft "Home" active indicator; unified “+” menu using ColoredIcon; closes on first action.
    - Split action disabled; icon set to Tabler Columns 2.
  - `src/components/icons.tsx`
    - Consolidated icons; Columns 2 for split.
  - `src/components/layout/dashboard-shell.tsx`
    - Hosts tab content vs. home screen.
  - `src/components/layout/tab-content-host.tsx`
    - Displays active tab placeholder with kind-colored icon.

- Files: Requests UI fixes
  - `src/components/requests/create-request-dropdown.tsx`
    - Refactored icon rendering to avoid mixed-library React.createElement; removed numeric stroke prop.
  - `src/components/requests/request-details-panel.tsx`
    - Removed numeric stroke prop from icon to satisfy typings.

- Database
  - `supabase/migrations/20251015_add_ui_tabs_to_profiles.sql`: added `ui_tabs` jsonb to profiles for persistence.

## UX notes
- Overflow dropdown width reduced for compactness; spacing tightened in collapsed icon-only view.
- "Pinned" section appears first in overflow, followed by a separator and the remaining tabs.
- Collapse bar shows only the overflow trigger; collapse others hides non-active titles (icon-only) for focus.

## QA
- Typecheck PASS via `pnpm exec tsc --noEmit` task.
- Realtime sync verified for tabs across sessions.
- Drag-and-drop reorder works within pinned and regular groups; collapse modes toggle correctly.
