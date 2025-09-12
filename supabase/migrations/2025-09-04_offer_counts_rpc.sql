-- RPC: get_offer_counts_by_request
-- Returns counts per request for requests owned by the current user (or their own offers)
-- Security definer to bypass RLS inside with explicit auth.uid() guard
create or replace function public.get_offer_counts_by_request(request_ids bigint[])
returns table(request_id bigint, offer_count integer)
language sql
security definer
set search_path = public
as $$
  -- Return counts for all given request ids; exposes only aggregate numbers
  select o.request_id, count(*)::int as offer_count
  from public.offers o
  where o.request_id = any(request_ids)
  group by o.request_id
$$;

revoke all on function public.get_offer_counts_by_request(bigint[]) from public;
grant execute on function public.get_offer_counts_by_request(bigint[]) to authenticated;
