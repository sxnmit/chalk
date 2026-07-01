ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'CAD',
  ADD COLUMN IF NOT EXISTS peak_days integer[] NOT NULL DEFAULT '{5,6}',
  ADD COLUMN IF NOT EXISTS peak_start_hour integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS peak_end_hour integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS business_day_cutoff_hour integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS receipt_footer text NOT NULL DEFAULT '';

ALTER TABLE public.venues
  ADD CONSTRAINT venues_peak_start_hour_check CHECK (peak_start_hour >= 0 AND peak_start_hour <= 23),
  ADD CONSTRAINT venues_peak_end_hour_check CHECK (peak_end_hour >= 0 AND peak_end_hour <= 23),
  ADD CONSTRAINT venues_business_day_cutoff_hour_check CHECK (business_day_cutoff_hour >= 0 AND business_day_cutoff_hour <= 23);
