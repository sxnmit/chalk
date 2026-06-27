-- Keep order item changes and stock adjustments in one locked database operation.

create or replace function public.add_order_item_with_stock(
  p_venue_id uuid,
  p_session_id uuid,
  p_menu_item_id uuid,
  p_quantity integer
)
returns public.order_items
language plpgsql
security invoker
as $$
declare
  v_menu public.menu_items%rowtype;
  v_order public.order_items%rowtype;
begin
  if p_quantity < 1 then
    raise exception 'INVALID_QUANTITY';
  end if;

  select *
    into v_menu
    from public.menu_items
   where id = p_menu_item_id
     and venue_id = p_venue_id
     and available = true
   for update;

  if not found then
    raise exception 'MENU_ITEM_UNAVAILABLE';
  end if;

  if v_menu.stock_quantity is not null then
    if v_menu.stock_quantity < p_quantity then
      raise exception 'INSUFFICIENT_STOCK:%', v_menu.stock_quantity;
    end if;

    update public.menu_items
       set stock_quantity = stock_quantity - p_quantity
     where id = v_menu.id
       and venue_id = p_venue_id;
  end if;

  insert into public.order_items (
    venue_id,
    session_id,
    menu_item_id,
    quantity,
    price_at_time_cents
  )
  values (
    p_venue_id,
    p_session_id,
    p_menu_item_id,
    p_quantity,
    v_menu.price_cents
  )
  returning * into v_order;

  return v_order;
end;
$$;

create or replace function public.update_order_item_quantity_with_stock(
  p_venue_id uuid,
  p_session_id uuid,
  p_order_item_id uuid,
  p_quantity integer
)
returns public.order_items
language plpgsql
security invoker
as $$
declare
  v_order public.order_items%rowtype;
  v_menu public.menu_items%rowtype;
  v_delta integer;
begin
  if p_quantity < 1 then
    raise exception 'INVALID_QUANTITY';
  end if;

  select *
    into v_order
    from public.order_items
   where id = p_order_item_id
     and session_id = p_session_id
     and venue_id = p_venue_id
   for update;

  if not found then
    raise exception 'ORDER_ITEM_NOT_FOUND';
  end if;

  v_delta := p_quantity - v_order.quantity;

  if v_delta <> 0 then
    select *
      into v_menu
      from public.menu_items
     where id = v_order.menu_item_id
       and venue_id = p_venue_id
     for update;

    if v_menu.stock_quantity is not null then
      if v_delta > 0 and v_menu.stock_quantity < v_delta then
        raise exception 'INSUFFICIENT_STOCK:%', v_menu.stock_quantity;
      end if;

      update public.menu_items
         set stock_quantity = stock_quantity - v_delta
       where id = v_menu.id
         and venue_id = p_venue_id;
    end if;
  end if;

  update public.order_items
     set quantity = p_quantity
   where id = p_order_item_id
     and session_id = p_session_id
     and venue_id = p_venue_id
  returning * into v_order;

  return v_order;
end;
$$;

create or replace function public.delete_order_item_with_stock(
  p_venue_id uuid,
  p_session_id uuid,
  p_order_item_id uuid
)
returns void
language plpgsql
security invoker
as $$
declare
  v_order public.order_items%rowtype;
  v_menu public.menu_items%rowtype;
begin
  select *
    into v_order
    from public.order_items
   where id = p_order_item_id
     and session_id = p_session_id
     and venue_id = p_venue_id
   for update;

  if not found then
    raise exception 'ORDER_ITEM_NOT_FOUND';
  end if;

  select *
    into v_menu
    from public.menu_items
   where id = v_order.menu_item_id
     and venue_id = p_venue_id
   for update;

  delete from public.order_items
   where id = p_order_item_id
     and session_id = p_session_id
     and venue_id = p_venue_id;

  if v_menu.stock_quantity is not null then
    update public.menu_items
       set stock_quantity = stock_quantity + v_order.quantity
     where id = v_menu.id
       and venue_id = p_venue_id;
  end if;
end;
$$;
