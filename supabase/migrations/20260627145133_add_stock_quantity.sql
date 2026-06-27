-- Add stock tracking to menu_items.
-- NULL = unlimited stock. 0 = sold out. Positive integer = units remaining.
alter table public.menu_items
  add column stock_quantity integer check (stock_quantity is null or stock_quantity >= 0);
