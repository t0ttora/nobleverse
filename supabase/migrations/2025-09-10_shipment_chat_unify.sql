-- Unify shipment chats into chat_* tables
-- 1. Extend chat_rooms type constraint to include 'shipment'
-- 2. Ensure chat room + members for each shipment
-- 3. Migrate existing shipment_messages into chat_messages (one-time idempotent)
-- 4. Helper RPC ensure_shipment_chat(p_shipment uuid)

-- Step 1: relax / recreate constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
     WHERE table_name='chat_rooms' AND constraint_name='chat_rooms_type_check') THEN
    ALTER TABLE public.chat_rooms DROP CONSTRAINT chat_rooms_type_check;
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

ALTER TABLE public.chat_rooms
  ADD CONSTRAINT chat_rooms_type_check CHECK (type = ANY (ARRAY['dm','group','shipment']));

-- Step 2: create shipment rooms if missing
INSERT INTO public.chat_rooms(id,type,title,created_by,participants)
SELECT s.id,'shipment',COALESCE(s.code,'Shipment'),s.owner_id, ARRAY(SELECT DISTINCT uid FROM (
  SELECT s.owner_id as uid UNION
  SELECT s.forwarder_id UNION
  SELECT (jsonb_array_elements_text(coalesce(s.participants,'[]'::jsonb)))::uuid
) t)
FROM public.shipments s
LEFT JOIN public.chat_rooms r ON r.id = s.id
WHERE r.id IS NULL;

-- We must not reference the user_id alias in the same SELECT list; use a lateral subquery.
WITH ship_parts AS (
  SELECT s.id AS shipment_id,
         p.user_id,
         CASE WHEN p.user_id = s.owner_id THEN 'admin' ELSE 'member' END AS role
  FROM public.shipments s
  CROSS JOIN LATERAL (
    SELECT DISTINCT uid AS user_id FROM (
      SELECT s.owner_id AS uid
      UNION
      SELECT s.forwarder_id
      UNION
      SELECT (jsonb_array_elements_text(coalesce(s.participants,'[]'::jsonb)))::uuid
    ) u
    WHERE uid IS NOT NULL
  ) p
)
INSERT INTO public.chat_members(room_id,user_id,role)
SELECT sp.shipment_id, sp.user_id, sp.role
FROM ship_parts sp
LEFT JOIN public.chat_members cm ON cm.room_id = sp.shipment_id AND cm.user_id = sp.user_id
WHERE cm.user_id IS NULL;

-- Step 3: migrate shipment_messages -> chat_messages (skip if already migrated)
INSERT INTO public.chat_messages(id, room_id, sender_id, content, created_at, updated_at)
SELECT m.id, m.shipment_id, m.user_id, m.content, m.created_at, m.created_at
FROM public.shipment_messages m
LEFT JOIN public.chat_messages c ON c.id = m.id
WHERE c.id IS NULL;

-- Step 4: helper RPC ensure_shipment_chat
CREATE OR REPLACE FUNCTION public.ensure_shipment_chat(p_shipment uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE rid uuid; owner uuid; fwd uuid; extra uuid[]; cur uuid; me uuid; 
BEGIN
  me := auth.uid();
  SELECT id, owner_id, forwarder_id, ARRAY(SELECT (jsonb_array_elements_text(coalesce(participants,'[]'::jsonb)))::uuid) INTO rid, owner, fwd, extra
  FROM public.shipments WHERE id = p_shipment;
  IF rid IS NULL THEN RAISE EXCEPTION 'Shipment % not found', p_shipment; END IF;
  -- create room if missing
  IF NOT EXISTS (SELECT 1 FROM public.chat_rooms WHERE id = p_shipment) THEN
    INSERT INTO public.chat_rooms(id,type,title,created_by,participants)
    VALUES(p_shipment,'shipment',NULL, owner, ARRAY(SELECT DISTINCT unnest(array_prepend(owner, array_prepend(fwd,extra)))));
  END IF;
  -- ensure current user membership if participant
  IF me IS NOT NULL AND EXISTS (SELECT 1 FROM public.shipments s WHERE s.id=p_shipment AND public.is_shipment_participant(s, me)) THEN
    INSERT INTO public.chat_members(room_id,user_id,role)
      VALUES (p_shipment, me, CASE WHEN me = owner THEN 'admin' ELSE 'member' END)
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN p_shipment;
END $$;

GRANT EXECUTE ON FUNCTION public.ensure_shipment_chat(uuid) TO authenticated;
