# Inbox Chat Setup

This project includes a minimal Supabase-backed chat schema with rooms, members, messages, and generic events (reactions, pins, stars, read receipts).

## Tables

- chat_rooms: `id, type(dm|group), title, created_by, created_at`
- chat_members: `room_id, user_id, role(admin|member), joined_at, last_read_at`
- chat_messages: `id, room_id, sender_id, content, attachments, created_at`
- chat_events: `id, room_id, message_id, user_id, type(reaction|pin|star|receipt), emoji, metadata, created_at`

View: `chat_room_last_message` for previews.

RLS policies limit access to room members, with sender edit/delete windows. A trigger syncs `last_read_at` on receipt events.

## Apply migration

Import the SQL in `supabase/migrations/2025-08-28_chat_inbox.sql` to your Supabase project (Dashboard > SQL Editor > Run).

The schema assumes a `profiles` table and `notifications` table (optional). Notifications insertion is best-effort.

## UI

- Route: `/inbox` lists rooms on the left and shows the chat on the right.
- New message dialog lets you start DMs or group chats.
- Message hover shows popover for pin/star/emoji; emoji opens a simple grid.
- Read receipts update via `receipt` events; room list uses last message view.

## Realtime

Realtime message sync uses a lightweight client-only broadcast in `use-realtime-chat`. For persisted messages, the inbox page writes to `chat_messages` and can be extended to also broadcast via Supabase Realtime.

## Next steps

- Replace local broadcast with database-triggered realtime (listen to `postgres_changes` on `chat_messages`).
- Add pinned/starred filters.
- Enhance notifications with deep link to `/inbox?room=<id>`.
