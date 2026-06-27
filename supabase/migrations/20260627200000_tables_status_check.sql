-- Add (or replace) a check constraint that documents all valid table statuses,
-- including the new 'maintenance' status introduced by the admin UI.
ALTER TABLE tables DROP CONSTRAINT IF EXISTS tables_status_check;
ALTER TABLE tables ADD CONSTRAINT tables_status_check CHECK (status IN ('free', 'occupied', 'inactive', 'maintenance'));
