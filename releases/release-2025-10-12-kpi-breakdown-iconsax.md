# 2025-10-12 — Dashboard KPI Breakdown + USD + Real-data overview

## Summary
- KPI Details Panel: Title/subtitle moved into the panel context; header simplified to period and tools.
- Breakdown: Mode/Incoterm/Route/Participants cards with icons (plane/ship/truck, mappin, users), sorted by latest.
- Top Partner: Real aggregation by shipments.forwarder_id joined to profiles; USD totals formatted.
- Responsive commentary: KPI cards adapt copy to viewport and trend.
- Overview: Real data charts (shipments & revenue) using shadcn/ui wrappers; loading/empty states added.
- Empty states: Polished, consistent messages across Trend, Details, Breakdown.
- Currency: USD indication in KPI cards and panel current values.

## Details
- File: `src/components/dashboard/kpi-details-panel.tsx`
  - Moved metric title/subtitle to content area.
  - Added Top Partners algorithm (group by forwarder_id; join profiles; period-aware filtering).
  - Breakdown cards render:
    - Mode (air/sea/road) + Incoterm
    - Route: origin → destination (fallbacks from cargo/details)
    - Participants count + created_at date
    - Code or short id
  - Introduced robust helpers `resolveMode`, `resolveRoute`, `pickFirstString`.
  - Trend chart empty state improved.
  - Details tab empty state improved.
  - USD formatting for currency-like KPIs.

- File: `src/components/dashboard/kpi-cards.tsx`
  - Responsive commentary lines (short vs rich copy based on container width).
  - Currency detection and USD formatting with fallback to existing formatted strings.

- File: `src/features/overview/components/bar-graph.tsx`
  - Real shipments (last 30d) aggregation; series: shipments, revenue (USD).
  - Loading and empty messages; shadcn chart wrappers retained.

- File: `src/features/overview/components/area-graph.tsx`
  - Year-to-date monthly aggregation for shipments and revenue.
  - Loading/empty states.

- File: `src/features/overview/components/pie-graph.tsx`
  - Top forwarders distribution (last 90d) with Other slice.
  - Center label shows total shipments; loading/empty states.

- File: `src/features/dashboard/hooks.ts`
  - Shipment selects now include: `code, incoterm, cargo, participants` for richer UI.

## QA / Verification
- Typecheck: PASS (`pnpm exec tsc -p tsconfig.json --noEmit`).
- KPI panel opens; Breakdown cards show data (or polished empty state), Top Partner populated when shipments exist.
- Overview charts render on real data or show empty states when none.
- Currency-labeled KPIs show USD formatting in cards and panel.

## Notes
- Name preference for partners defaults to `company_name || username`; TODO: wire to user settings.
- If some routes still show "—", map your actual JSON keys in `resolveRoute` as needed.
- Icons currently from lucide; plan to migrate to Iconsax (TwoTone) via a thin `Icon` wrapper.
