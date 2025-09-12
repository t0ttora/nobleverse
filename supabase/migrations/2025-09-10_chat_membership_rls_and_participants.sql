-- Ensure chat_messages RLS uses chat_membership (not only chat_rooms.participants)
-- and optionally backfill/maintain chat_rooms.participants from chat_members for consistency.

-- 1) Replace chat_messages policy to authorize via chat_members
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname='chat_messages_rw' AND tablename='chat_messages') THEN
    DROP POLICY chat_messages_rw ON public.chat_messages;
  END IF;
END $$;

CREATE POLICY chat_messages_rw ON public.chat_messages
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.chat_members m
    WHERE m.room_id = chat_messages.room_id
      AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_members m
    WHERE m.room_id = chat_messages.room_id
      AND m.user_id = auth.uid()
  )
);

-- 2) Optional: backfill participants array to reflect current chat_members
UPDATE public.chat_rooms r
SET participants = COALESCE(
  (
    SELECT array_agg(m.user_id)
    FROM public.chat_members m
    WHERE m.room_id = r.id
  ),
  '{}'::uuid[]
)
WHERE TRUE;

-- 3) Keep participants in sync on membership changes (optional but helpful)
CREATE OR REPLACE FUNCTION public.sync_participants_on_member_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.chat_rooms r
  SET participants = COALESCE((SELECT array_agg(m.user_id) FROM public.chat_members m WHERE m.room_id = r.id), '{}'::uuid[])
  WHERE r.id = COALESCE(NEW.room_id, OLD.room_id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_members_sync_participants ON public.chat_members;
CREATE TRIGGER trg_chat_members_sync_participants
AFTER INSERT OR DELETE OR UPDATE ON public.chat_members
FOR EACH ROW EXECUTE FUNCTION public.sync_participants_on_member_change();
