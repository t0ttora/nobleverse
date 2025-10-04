# Release 2025-10-04 — Inbox details, mobile toggle, mentions restyle

## Overview
This release focuses on polishing the Inbox experience:
- Group details panel redesign (cleaner Info, banner + avatar stacks)
- Inline group title editing
- Group header shows member names
- Mobile list/chat toggle restored
- Mentions restyled to match Members cards

## Changes
- Inbox page structure fixed and simplified to eliminate a JSX parse error.
- Chat header
  - DM/group/shipment avatars rendered more clearly.
  - Group chats now show member names under the title (with +N overflow).
- Details panel
  - Pinned Info for groups: removed Type/Members rows; added GroupBanner and large avatar stack.
  - Inline title editing for groups (writes to `chat_rooms.title` via Supabase, and updates local state).
  - Media: auto-fit lazy grid with “Show more”; Links/Files lists retained.
  - Mentions: restyled list items to card-like rows (avatar + name + timestamp + preview). Clicking jumps to the message.
- Mobile UX
  - Restored previous behavior: on small screens, only the list shows by default; tapping a room opens chat full-screen with a back arrow to return to the list.

## Technical notes
- File: `src/app/inbox/page.tsx`
  - Header markup was restructured to remove unbalanced fragments and ensure valid JSX.
  - Added `editingTitle` / `savingTitle` state and `saveGroupTitle()` (updates Supabase and local `rooms`).
  - Guarded nullability of `active` inside closures to satisfy type-checker.
- Supabase tables touched: `chat_rooms` (update title).

## QA checklist
- Typecheck: pass for `page.tsx`.
- Mobile
  - See list-only by default; open chat -> full-screen; back arrow returns.
- Group details
  - Title edit saves and persists on refresh.
  - Banner appears if any member has a `banner_url`.
- Mentions
  - Items show avatar/name/time/preview; clicking scrolls to the message.

## Notes / follow-ups
- Optional: add Enter/Esc for title edit, highlight target message after jump, image lightbox.
