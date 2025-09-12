-- Add missing INSERT policy for shipments so creation via offer acceptance works
-- Without WITH CHECK policy, INSERT was blocked by RLS causing 500 SHIP_CREATE_FAILED.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname='shipments_insert' AND tablename='shipments'
  ) THEN
    CREATE POLICY shipments_insert ON public.shipments
      FOR INSERT
      WITH CHECK ( auth.uid() = owner_id ); -- only request owner may create shipment
  END IF;
END $$;
