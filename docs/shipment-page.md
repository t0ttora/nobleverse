# Shipment Page & Escrow System

This document outlines the architecture for the `/shipments/[shipmentId]` page and related backend pieces.

## Overview

When an offer or negotiation is accepted, a shipment is created atomically along with an escrow HOLD entry and platform fee recording. The user is redirected to `/shipments/{id}` which presents a collaboration room (chat, milestones, escrow panel, documents, scans and admin ledger).

## Schema (Core Tables)

- shipments (status, amounts, fee, net, escrow_status, label_hmac)
- escrow_ledger (HOLD, RELEASE, FEE, REFUND, ADJUST)
- milestones (timeline events; DELIVERED auto releases escrow)
- scans (label / QR scan events)
- shipment_messages (basic shipment room chat)

## Escrow Lifecycle

1. HOLD: On creation store total, fee, net and ledger rows (HOLD + FEE).
2. RELEASE: Manual or auto on DELIVERED milestone (ledger row + status update).
3. REFUND: Future endpoint creates REFUND ledger row and updates escrow_status.

## Label Tokens

- Generated via random bytes.
- Only HMAC hash stored in shipments.label_hmac.
- /api/shipments/:id/label issues a fresh token and updates hash.
- /api/shipments/:id/scan validates by recomputing HMAC; on success inserts scan row.

## Security & RLS

Policies restrict table access to owner_id, forwarder_id or users listed in participants JSON array.

## Components

- ShipmentRoom: Orchestrates layout.
- ChatPanel: Real-time messages for shipment.
- MilestonesPanel: Displays and adds milestones.
- EscrowPanel: Shows totals and release/refund actions.
- Tabs: Overview, Documents, Scans, Admin.

## TODO / Next Steps

- Implement offer/negotiation accept API to create shipment + initial ledger.
- Add refund endpoint.
- Improve label endpoint to generate actual PDF/ZPL.
- Add Playwright and unit tests for escrow math & label token.

## Code-Based URLs

Shipments resolve via either UUID or human readable `code` (format: RDF-YYMM-####). Frontend navigation uses `/shipments/{code}`; server route accepts both by querying `or(code.eq.${param},id.eq.${param})`.
