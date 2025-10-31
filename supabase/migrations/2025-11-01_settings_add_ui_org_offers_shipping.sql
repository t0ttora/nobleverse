-- Add missing JSONB columns to public.settings for UI, org, offers, and shipping preferences
-- Safe to run multiple times thanks to IF NOT EXISTS

alter table public.settings
  add column if not exists ui jsonb not null default '{}',
  add column if not exists org jsonb not null default '{}',
  add column if not exists offers jsonb not null default '{}',
  add column if not exists shipping jsonb not null default '{}';

-- Ensure updated_at is maintained by trigger (created in base migration)
-- No additional RLS changes required; existing policies cover the table.
