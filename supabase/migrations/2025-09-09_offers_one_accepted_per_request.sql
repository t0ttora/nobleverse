-- Ensure only one offer can be accepted per request
create unique index if not exists offers_one_accepted_per_request
  on public.offers(request_id)
  where status = 'accepted';
