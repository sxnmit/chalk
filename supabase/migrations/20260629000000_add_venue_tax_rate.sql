ALTER TABLE public.venues
  ADD COLUMN tax_rate numeric(5,3) NOT NULL DEFAULT 0;
