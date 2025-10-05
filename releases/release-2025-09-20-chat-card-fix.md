# Release 2025-09-20 — Chat card alignment fix

- Fix: Align negotiation (offer) cards with message bubbles in chat inbox and shipment rooms.
- Fix: Ensure outgoing (sent) cards are right-aligned and match incoming card layout.
- UX: Removed sender avatar from outgoing messages to reduce visual duplication and improve alignment with cards.

Files changed:

- `src/components/chat-message.tsx` — adjusted alignment classes, replaced `justify-self-*` with `self-*`, made outgoing content container use `ml-auto` and controlled width.
- `src/components/chat-cards/card-renderer.tsx` — updated `BaseCard` container to `w-full max-w-[560px]` for consistent card width.

Notes:

- Please run the app and verify chat inbox and shipment room layouts after deploy.
- If any responsive edge cases remain (mobile/narrow widths), I'll follow up with breakpoint-specific tweaks.
