# 2025-10-15 — Inbox group/shipment polish

## Summary
- Group details card: Moved the group name into the card next to the avatar stack and added a subtle pencil icon on the right for inline rename.
- Removed the old top "Group" header/edit block for a cleaner layout.
- Members in Details: Fixed empty state by sourcing members from chat_rooms.participants first, falling back to legacy join, then to active room members as display-only.
- Shipments UI: Rounded shipment icon containers (list and header) and removed the literal "Shipment" label; now shows the shipment id/code derived from shipment cards when title is missing.
- Minor: Kept mentions/files/links tabs with inline filter; smooth jump/highlight to mentioned messages.

## Changes
- File: `src/app/inbox/page.tsx`
  - Details Panel (Group): Inline title + pencil in the card; save/cancel flow preserved; removed the separate header section.
  - Members loader: Primary source `chat_rooms.participants` → `profiles`; fallback to `chat_members` join; final display-only fallback from active room's `members`.
  - Shipments: Icon containers now `rounded-full`; header/list title resolves to room `title` or `shipment_card` code/title/id parsed from messages.
  - List and header polish: No literal "Shipment" text; subtle UI tweaks.

## UX Notes
- The pencil icon is muted by default (opacity-60) and brightens on hover.
- If a shipment room has no title and no shipment card yet, the header/list will remain blank until a card appears.

## QA
- Typecheck PASS.
- Group rename updates persist to `chat_rooms.title` and reflect immediately in UI.
- Details members render for groups and shipments with avatar and role badges; "No members" only shows when the room truly has none.
