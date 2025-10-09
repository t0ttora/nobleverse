# Release — 2025-10-09 — Dashboard KPI Sidepanel, Headlines, and Realtime

## Summary
This release polishes the Nobleverse dashboard with production‑ready, role‑based KPIs, a rich KPI Details Side Panel, professional microcopy on cards (headlines), realtime updates, and type‑safe compute logic with unit tests. It upgrades the KPI card UX (skeletons, deltas, click‑through), introduces a reusable compute layer and hooks for Supabase, and aligns the KPI side panel with the provided spec (header CTAs, tabs, sticky footer).

## Highlights
- New KPI Details Side Panel with period selector, CTAs (Expand, Share, Filter, Compare, Export, Report, Analytics), tabs (Overview/Details/Insights), and a trend chart.
- KPI cards now show professional headlines, deltas, and loading skeletons; cards open the KPI panel on click.
- Role‑based KPI compute functions and hooks using Supabase data with realtime invalidation.
- Unit tests for compute functions and TypeScript type‑safety maintained.

## Changes
### Added
- `src/features/dashboard/compute.ts`
  - Pure compute functions that derive role‑specific KPIs and time series.
  - Provides: `key`, `label`, `value`, `trend`, `deltaPct`, `headline`, `note`, `series`.
  - Helpers: percentage deltas and time bucketing.

- `src/features/dashboard/hooks.ts`
  - Data hooks for Shipper, Forwarder, Receiver dashboards.
  - Loads from Supabase (`shipments`, `requests`, `offers`, `notifications`) and subscribes to realtime changes.
  - Returns typed KPIs and raw data arrays with loading/error state.

- `src/components/dashboard/kpi-details-panel.tsx`
  - Side Panel matching the design brief: Header (metric title + headline, period selector 7d/30d/90d/custom, CTAs), Tabs (Overview with trend chart and placeholders for breakdown; Details with table placeholder; Insights with AI summary/trend mini chart), Sticky footer CTAs.
  - Action stubs use `sonner` toasts; export/report/compare to be wired later.

- `src/tests/dashboard-compute.test.ts`
  - Vitest unit tests covering shipper/forwarder/receiver compute basics.

### Updated
- `src/components/dashboard/kpi-cards.tsx`
  - Shows `headline` when available; retains trend fallback.
  - Accepts `deltaPct`, `onClick`, `loading` and renders skeletons and deltas.

- `src/components/dashboard/role-dashboards.tsx`
  - Wires cards to real KPIs from hooks, opens `KpiDetailsPanel` on card click.
  - Forwarder “Incoming Requests” leverages `RequestBrowser` and restores details panel usage.

- `src/components/dashboard/kpi-details-panel.tsx`
  - Replaced unsupported `SquareGantt` icon with `GitCompare` for “Compare Periods”.

## UX and Behavior
- Cards
  - Loading state uses skeletons.
  - Delta badge shows +/− percentage when available; otherwise trend fallback.
  - Professional `headline` appears under the number (e.g., “Spending steady this cycle”).
- Side Panel
  - Header: left (metric initial avatar + title + headline), middle (period selector), right (Expand, Share, Filter, Close).
  - Tabs: Overview → trend line chart; Details → table placeholder; Insights → AI copy + sparkline.
  - Footer: context CTAs (Export for Details, Create Report for Insights), Compare Periods, Go to Full Analytics.
- Realtime
  - Hooks subscribe to relevant tables and invalidate on changes.

## Technical Notes
- Compute functions isolated for testability and reuse.
- Hooks handle initial load and realtime; errors surfaced via state.
- Charting uses Recharts; icons via lucide-react; UI via shadcn/ui components; toasts via sonner.

## QA Checklist
- TypeScript: no errors (tsc noEmit passes).
- Tests: vitest passing for compute functions.
- KPI card click opens the details panel with correct title/headline.
- Period selector renders and updates local state (data wiring for period windows pending).
- Compare/Export/Report buttons show informative toasts (until wired).
- No console errors when navigating dashboard.

## Migration/Breaking Changes
- None.

## Next Steps
- Wire period selector to recompute series and delta windows.
- Implement Overview breakdowns (donut/bar) by partner/route/type.
- Implement Details tab tables with columns per KPI and row actions.
- Add AI/insights generation (if applicable) and Compare Periods diff view.
- Implement Export/Share flows (CSV/Excel/PDF; tokenized links) and full analytics route.
