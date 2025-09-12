begin;

-- 1) Add dm_key column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='chat_rooms' AND column_name='dm_key'
  ) THEN
    ALTER TABLE public.chat_rooms ADD COLUMN dm_key text;
  END IF;
END $$;

-- Compute pair as sorted text to avoid MIN/MAX over UUID
UPDATE public.chat_rooms r
SET dm_key = m.a_text || ':' || m.b_text
FROM (
  SELECT s.room_id,
         (s.arr)[1] AS a_text,
         (s.arr)[2] AS b_text,
         s.c
  FROM (
    SELECT room_id,
           array_agg(user_id::text ORDER BY user_id::text) AS arr,
           COUNT(*) AS c
    FROM public.chat_members
    GROUP BY room_id
  ) s
) m
WHERE r.id = m.room_id
  AND (r.dm_key IS NULL OR r.dm_key = '')
  AND m.c = 2;

-- 3) Optional cleanup: delete duplicate DM rooms (same dm_key) that have zero messages
WITH dup AS (
  SELECT dm_key, array_agg(id ORDER BY created_at) AS ids, COUNT(*) AS cnt
  FROM public.chat_rooms
  WHERE dm_key IS NOT NULL
  GROUP BY dm_key
  HAVING COUNT(*) > 1
), victims AS (
  SELECT unnest(ids[2:]) AS id FROM dup
), victims_no_msg AS (
  SELECT v.id FROM victims v
  LEFT JOIN public.chat_messages m ON m.room_id = v.id
  GROUP BY v.id
  HAVING COUNT(m.id) = 0
)
DELETE FROM public.chat_rooms r USING victims_no_msg v
WHERE r.id = v.id;

-- 4) (optional) dm_key zorunluluğu: Şema farklılıkları nedeniyle atlandı. Unique index ve fonksiyon ile korunuyor.

-- 5) Unique dm_key for rooms where dm_key is set
CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_dm_key_unique
ON public.chat_rooms (dm_key)
WHERE dm_key IS NOT NULL;

-- 6) Stronger get_or_create_dm_room using dm_key + advisory lock + unique_violation handling
DROP FUNCTION IF EXISTS public.get_or_create_dm_room(p_user1 uuid, p_user2 uuid) CASCADE;
CREATE FUNCTION public.get_or_create_dm_room(p_user1 uuid, p_user2 uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a uuid;
  b uuid;
  a_text text;
  b_text text;
  key text;
  v_room_id uuid;
BEGIN
  IF p_user1 = p_user2 THEN
    RAISE EXCEPTION 'Cannot create DM with self';
  END IF;

  -- Normalize pair by text ordering to avoid type-specific LEAST/GREATEST
  IF p_user1::text <= p_user2::text THEN
    a_text := p_user1::text; b_text := p_user2::text;
  ELSE
    a_text := p_user2::text; b_text := p_user1::text;
  END IF;
  a := a_text::uuid; b := b_text::uuid;
  key := a_text || ':' || b_text;

  -- Pairwise advisory lock (two 32-bit keys) to avoid races
  PERFORM pg_advisory_xact_lock(hashtext(a_text), hashtext(b_text));

  -- Quick existing check
  SELECT id INTO v_room_id FROM public.chat_rooms WHERE dm_key = key LIMIT 1;
  IF v_room_id IS NOT NULL THEN
    RETURN v_room_id;
  END IF;

  BEGIN
    -- Insert handling both schemas (room_type or type); fallback without type if absent
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='chat_rooms' AND column_name='room_type'
    ) THEN
      INSERT INTO public.chat_rooms (room_type, created_by, dm_key)
      VALUES ('dm', a, key)
      RETURNING id INTO v_room_id;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='chat_rooms' AND column_name='type'
    ) THEN
      INSERT INTO public.chat_rooms (type, created_by, dm_key)
      VALUES ('dm', a, key)
      RETURNING id INTO v_room_id;
    ELSE
      INSERT INTO public.chat_rooms (created_by, dm_key)
      VALUES (a, key)
      RETURNING id INTO v_room_id;
    END IF;
  EXCEPTION WHEN unique_violation THEN
    -- Another concurrent tx inserted the same dm_key; fetch and return
    SELECT id INTO v_room_id FROM public.chat_rooms WHERE dm_key = key LIMIT 1;
  END;

  -- Ensure members exist for both sides (idempotent upsert-like)
  INSERT INTO public.chat_members (room_id, user_id, role)
  VALUES (v_room_id, a, 'admin')
  ON CONFLICT (room_id, user_id) DO NOTHING;

  INSERT INTO public.chat_members (room_id, user_id, role)
  VALUES (v_room_id, b, 'member')
  ON CONFLICT (room_id, user_id) DO NOTHING;

  RETURN v_room_id;
END $$;

COMMIT;
