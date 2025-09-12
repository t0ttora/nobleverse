-- Add human readable code to shipments and generator trigger
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='shipments' AND column_name='code'
  ) THEN
    ALTER TABLE public.shipments ADD COLUMN code text;
  END IF;
END $$;

-- Sequence for shipment codes (global incremental)
CREATE SEQUENCE IF NOT EXISTS public.shipment_code_seq;

CREATE OR REPLACE FUNCTION public.gen_shipment_code()
RETURNS text LANGUAGE sql AS $$
  SELECT 'RDF-' || to_char(now(),'YYMM') || '-' || lpad(nextval('public.shipment_code_seq')::text,4,'0');
$$;

-- Trigger to fill code if null
CREATE OR REPLACE FUNCTION public.set_shipment_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := public.gen_shipment_code();
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_set_shipment_code') THEN
    CREATE TRIGGER trg_set_shipment_code BEFORE INSERT ON public.shipments
      FOR EACH ROW EXECUTE FUNCTION public.set_shipment_code();
  END IF;
END $$;

-- Backfill existing rows without code
UPDATE public.shipments SET code = public.gen_shipment_code() WHERE code IS NULL;

-- Unique index
CREATE UNIQUE INDEX IF NOT EXISTS shipments_code_unique ON public.shipments(code);