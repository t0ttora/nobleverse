-- Make get_room_messages resilient to RLS by using SECURITY DEFINER and explicit membership check
-- Also include sender_id (coalesce of user_id/sender_id) for UI name mapping

CREATE OR REPLACE FUNCTION public.get_room_messages(p_room uuid, p_page integer, p_size integer)
RETURNS TABLE (
  id uuid,
  sender_id uuid,
  content text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id,
         COALESCE(m.user_id, m.sender_id) AS sender_id,
         m.content,
         m.created_at
  FROM public.chat_messages m
  WHERE m.room_id = p_room
    AND EXISTS (
      SELECT 1 FROM public.chat_members cm
      WHERE cm.room_id = m.room_id AND cm.user_id = auth.uid()
    )
  ORDER BY m.created_at ASC
  LIMIT COALESCE(p_size, 100)
  OFFSET GREATEST(COALESCE(p_page, 0), 0) * COALESCE(p_size, 100);
$$;

GRANT EXECUTE ON FUNCTION public.get_room_messages(uuid, integer, integer) TO authenticated;
