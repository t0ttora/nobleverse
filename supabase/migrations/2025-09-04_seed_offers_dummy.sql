-- Seed ~120 dummy offers for existing requests using existing forwarder profiles
-- This will insert up to 120 unique (request_id, forwarder_id) pairs with random details.
-- Safe to re-run: ON CONFLICT DO NOTHING prevents duplicates.

insert into public.offers (request_id, forwarder_id, status, details)
select r.id as request_id,
       f.id as forwarder_id,
       'sent'::text as status,
       jsonb_build_object(
         'total_price', round((random() * 4000 + 500)::numeric, 2),
         'total_price_currency', 'USD',
         'transit_time', (5 + floor(random() * 20))::int,
         'service_scope', to_jsonb(
           (array['pickup','export_customs','freight','import_customs','delivery'])[1: (1 + floor(random()*5))::int]
         )
       ) as details
from (
  select id from public.requests
) r
cross join (
  select id from public.profiles where role = 'forwarder'
) f
order by random()
limit 120
on conflict (request_id, forwarder_id) do nothing;

-- Optionally, top up if fewer than 120 inserted due to low combinations: try additional randomized attempts
insert into public.offers (request_id, forwarder_id, status, details)
select r.id, f.id, 'sent', jsonb_build_object(
         'total_price', round((random() * 4000 + 500)::numeric, 2),
         'total_price_currency', 'USD',
         'transit_time', (5 + floor(random() * 20))::int,
         'service_scope', to_jsonb(
           (array['pickup','export_customs','freight','import_customs','delivery'])[1: (1 + floor(random()*5))::int]
         )
       )
from generate_series(1, 240) g
cross join lateral (select id from public.requests order by random() limit 1) r
cross join lateral (select id from public.profiles where role = 'forwarder' order by random() limit 1) f
on conflict (request_id, forwarder_id) do nothing;
