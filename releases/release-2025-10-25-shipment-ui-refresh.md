# 2025-10-25 – Shipment UI refresh

Highlights

- Floating header: removed bottom separator, added rounded left corners and soft card shadow with sidebar-colored gap below.
- Chat panel polish: same spaced layout as header, thinner scrollbar.
- Context panel: wrapped tabs/content in a rounded card with consistent padding and spacing.

Overview

- Switched to a Bento Grid layout with:
  - Shipment Status stepper (Picked Up → In Transit → Delivered)
  - Key Info (merged Cargo Info + Participants)
  - Finance Summary (read-only) with quick link to Finance
- Removed Escrow and detailed Milestones from Overview (moved to Finance and Tracking).

Finance

- Renamed "Financial" to "Finance".
- Escrow card (with actions) moved to top.
- Escrow Ledger stays underneath.

Tracking & Milestones

- Renamed "Tracking" to "Tracking & Milestones".
- Removed separate Scans tab; merged into this view.
- Layout now shows:
  - Left: Last Known Position (map placeholder)
  - Right top: Milestones detailed list
  - Right bottom: Scans list + Regenerate Label button

Documents

- Split into two clear sections:
  - Actions: + Upload Document, + Request Documents (open in dialogs)
  - Lists: Tabs for All Documents and Incoming Requests

Notes

- This refactor keeps existing data flows intact (Supabase queries unchanged).
- Minimal visual-only changes to maintain stability. Map component can be swapped in later.
