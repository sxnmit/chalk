-- Schema additions required for the admin UI (tables + rates management).

-- Per-table default rate (used in admin form; set null when the rate is deleted).
alter table public.tables
  add column if not exists default_rate_id uuid references public.rates(id) on delete set null;

-- Soft-delete flag for rates. Existing rows default to active.
alter table public.rates
  add column if not exists active boolean not null default true;

-- Sort order for rates (admin can reorder; existing rows default to 0).
alter table public.rates
  add column if not exists sort_order integer not null default 0;
