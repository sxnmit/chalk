-- Grant execute on stock-management RPC functions to API roles.
-- Required because auto_expose_new_tables is disabled (Supabase default),
-- so functions created by migrations are not automatically callable
-- through the PostgREST API.

grant execute on function public.add_order_item_with_stock(uuid, uuid, uuid, integer)
  to authenticated, service_role;

grant execute on function public.update_order_item_quantity_with_stock(uuid, uuid, uuid, integer)
  to authenticated, service_role;

grant execute on function public.delete_order_item_with_stock(uuid, uuid, uuid)
  to authenticated, service_role;
