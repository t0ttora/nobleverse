-- Recursive stats SQL function for performance
CREATE OR REPLACE FUNCTION public.files_stats_recursive(root uuid)
RETURNS TABLE(count bigint, size bigint)
LANGUAGE sql STABLE AS $$
WITH RECURSIVE tree AS (
  SELECT id, type, size_bytes
  FROM public.files
  WHERE parent_id = root AND is_deleted = false
  UNION ALL
  SELECT f.id, f.type, f.size_bytes
  FROM public.files f
  INNER JOIN tree t ON f.parent_id = t.id
  WHERE f.is_deleted = false
)
SELECT COUNT(*)::bigint AS count,
       COALESCE(SUM(CASE WHEN type <> 'folder' THEN size_bytes ELSE 0 END),0)::bigint AS size
FROM tree;
$$;
