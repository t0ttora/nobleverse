<div align="center">

# 🌐 NobleVerse

### The AI-Native Operating System for Modern Freight

<i>Real-time coordination, intelligent automation, and unified visibility across the global supply chain.</i>

</div>

## 1. Overview

NobleVerse is a proprietary, AI-native freight operations platform that unifies shipment execution, collaboration, document intelligence, offer management, and real‑time decision support. Instead of disconnected portals, email threads, and static dashboards, it provides a living operational graph – a continuously updating picture of your logistics network.

## 2. Problem Space (Why It Exists)

Current freight workflows are fragmented: siloed systems, late exception handling, manual reconciliation, opaque pricing, and insecure document exchange. Legacy TMS suites are rigid and slow; visibility tools stop at tracking; digital forwarders lock users into closed networks. The result: margin leakage, delay amplification, and reactive firefighting.

## 3. Core Solution Pillars

| Pillar                   | Description                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Live Operational Graph   | Unified data model merging shipments, offers, negotiations, documents, chat, tasks, scans, milestones.        |
| NobleIntelligence        | AI layer watching events, flagging risks, generating summaries, proposing next actions.                       |
| NobleSuite (Docs & Data) | Secure encrypted repository (NobleFiles), collaborative text (NobleNotes), structured tables (NobleCells).    |
| Unified Inbox            | Multi-party real-time messaging with role context, attachments, task extraction, and inline knowledge recall. |
| Escrow & Ledger          | Shipment financial state with fee calculation, refund/partial refund flows, ledger events.                    |
| Offer & Request Engine   | Structured request → multi-offer evaluation with negotiation lifecycle.                                       |
| Workflow Automation      | Pattern detection + recommendation + optional auto-execution (NobleAutomate).                                 |
| Simulation & Planning    | “What-if” rerouting & disruption rehearsal on a digital twin.                                                 |

## 4. Feature Highlights

**AI & Decisioning**  
Risk scoring, ETA deviation detection, milestone anomaly tagging, natural language queries.  
**Collaboration**  
Threaded + contextual chat, request/offer negotiation panels, real-time presence, role-based dashboards.  
**Documents & Intelligence**  
OCR + NLP extraction, validation rules, hashed integrity (optional blockchain anchoring).  
**Escrow & Financial Events**  
Hold, release, refund, fee, adjustment ledger entries.  
**Security & Governance**  
Row-Level Security (Supabase), permission-scoped views, auditable notification + action log.  
**Extensibility**  
API-first, modular schema migrations, event-driven extension points.

## 5. Technology Stack (Implemented Portions)

- Next.js 15 (App Router) + TypeScript
- Supabase (Auth, Postgres, Realtime, Storage, RPC, RLS)
- shadcn/ui + TailwindCSS 4 for design system
- React Query / TanStack Table / Zustand state patterns
- Vitest + (planned) Playwright for testing
- Sentry & OpenTelemetry instrumentation hooks

## 6. Domain Modules (Current Code)

| Module                | Path Examples                                                    | Notes                                     |
| --------------------- | ---------------------------------------------------------------- | ----------------------------------------- |
| Shipments             | `src/app/shipments/*`, `supabase/migrations/*shipments*`         | Escrow, milestones, scans, share tokens.  |
| Offers & Negotiations | `src/components/offers/*`, `supabase/migrations/*offers*`        | Multi-offer + acceptance logic.           |
| Requests              | `src/components/requests/*`, `utils/supabase/requests.ts`        | Structured request & code-based share.    |
| Inbox & Chat          | `src/components/realtime-chat.tsx`, `supabase/migrations/*chat*` | Group + direct messaging with presence.   |
| Calendar & Tasks      | `supabase/migrations/*tasks_calendar*`                           | Personal + shipment-linked events.        |
| Profile & Roles       | `src/features/profile/*`, `supabase/migrations/*profiles*`       | Display name, privacy, activity touch.    |
| Notifications         | `supabase/migrations/*notifications*`                            | Insert-on-event pattern (server actions). |
| Escrow Ledger         | `supabase/migrations/*escrow*` & shipment ledger inserts         | Financial traceability.                   |

## 7. Environment Variables

See `env.example.txt` for the full list. Core required variables for a minimal local run:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
PLATFORM_FEE_PERCENT=5
SHIPMENT_LABEL_HMAC_SECRET=changeme_super_secret_key
```

## 8. Local Development

```bash
git clone <private-repo-url>
cd nobleverse
cp env.example.txt .env.local  # fill values
npm install
npm run dev
```

Run migrations manually in Supabase SQL editor (see `supabase/migrations/`).

## 9. Operational Concepts

| Concept               | Description                                                            |
| --------------------- | ---------------------------------------------------------------------- |
| Share Token           | Time-bound hashed token allowing public read of limited shipment data. |
| Escrow Status         | `hold` → `released` → `refunded` / partial adjustments.                |
| Negotiation Lifecycle | `pending` ↔ `counter` → `accepted` (others auto-reject).              |
| Milestones & Scans    | Append-only event lists powering timeline + risk heuristics.           |
| Notifications         | Insert-only feed; future: per-user read offsets + delivery guarantees. |

## 10. Roadmap (Condensed Forward View)

- NobleSuite workspace unification (Docs + Tasks + Shipments in a single graph view).
- NobleAutomate suggestion → one-click → autonomous execution chain.
- Mobile companion (offline-first cache + push sync).
- External API surface (REST + streaming events).
- NoblePilot v1 (predictive routing & offer scoring).
- Compliance: SOC2 Type II, ISO 27001 (post-seed).

## 11. Security & Compliance (Current State)

- RLS enforced on shipment, chat, offers, contacts.
- HMAC for label tokens; future: rotating secret + KMS.
- Optional blockchain anchoring (planned) for document hash proofs.

## 12. Contribution & Access

This repository is private & proprietary. External contributions are not accepted. Internal contributors follow:

1. Create feature branch: `feat/<scope>`
2. Add/adjust migrations with UTC date prefix.
3. Include minimal Vitest where logic is pure.
4. Open PR → automated lint + (future) test matrix.

## 13. License

This codebase is NOT open source. All rights reserved. See `LICENSE` for permitted and prohibited uses.

## 14. Contact

Partnerships & licensing: partnerships@nobleverse.com  
Security reports: security@nobleverse.com  
Legal: legal@nobleverse.com

---

© 2025 NobleVerse. Proprietary & Confidential.
