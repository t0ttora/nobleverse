-- Index to speed up lookups by human-readable shipment code
create index if not exists shipments_code_idx on public.shipments(code);
