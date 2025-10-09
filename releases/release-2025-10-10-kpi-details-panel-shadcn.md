# 2025-10-10 — Dashboard KPI Details Panel (ShadCN charts + footer)

## Summary
- Restored the polished KPI Details Panel UI and rewired dashboards (Shipper, Forwarder, Receiver) to use it.
- Converted charts to ShadCN-styled wrappers for a consistent theme:
  - Replaced raw Recharts containers with `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`.
  - Charts now use the memoized real `series` computed from Supabase data and KPI compute functions.
- Reintroduced a persistent footer with action buttons and role-specific CTAs:
  - Compare, Export CSV, Export PDF
  - Receiver: "Mark all as read"
  - Shipper: "New Request"
  - (Per request) Removed Share and Close buttons from the footer.
- Resolved stale TypeScript diagnostic about `SquareGantt` by ensuring safe lucide-react imports (e.g., `GitCompare`) and clearing the task runner cache; clean typecheck confirmed.

## Details
- File: `src/components/dashboard/kpi-details-panel.tsx`
  - Added ShadCN chart wrappers: `ChartContainer`, `ChartTooltip`, `ChartTooltipContent` (from `@/components/ui/chart`).
  - Trend and Forecast line charts wrapped in `ChartContainer` using `series` from KPI computations.
  - Footer provided via `SidePanel` `footer` prop; contains Compare/Export actions and role CTAs.
  - Removed Share/Close buttons in footer (remain in header tools if needed later).
  - Safe lucide-react icons only (e.g., `Maximize2`, `Minimize2`, `Filter`, `Download`, `FileDown`, `GitCompare`).
- File: `src/components/ui/side-panel.tsx`
  - Supports a `footer` slot by prop; persistent, sticky footer with backdrop/blur.
- File: `src/components/ui/chart.tsx`
  - Centralized ShadCN wrappers and tooltip content used by multiple charts across the app.

## QA / Verification
- Typecheck: PASS (`pnpm exec tsc -p tsconfig.json --noEmit`).
- Panel opens from KPI cards; Overview, Details, Insights tabs render without runtime errors.
- Exports produce correct CSV and printable PDF.
- Receiver: Mark all as read executes Supabase update; success toast shown.

## Migration Notes
- `kpi-details-panel2.tsx` (fallback) remains available but unused; safe to remove after validation.
- If you see a stale TS error in the task runner, restart the Typecheck task or Reload Window.

## Further Steps
1. Customs Officer role
   - Implement compute/hook/wiring and hook into panel details.
2. Compare periods UX
   - Add date-range selector in footer; overlay a dashed secondary series; legend + diff metrics.
3. Remove legacy panel2
   - Delete `src/components/dashboard/kpi-details-panel2.tsx` after sign-off.
4. Deeper breakdowns
   - Add partner/mode/route breakdown widgets; hook into real aggregations.
5. Tests & instrumentation
   - Add unit tests for compute helpers and CSV export; basic Playwright smoke for panel open/close and export flows.
6. Performance
   - Virtualize Details table for large datasets; debounce search; memoize heavy transforms.
