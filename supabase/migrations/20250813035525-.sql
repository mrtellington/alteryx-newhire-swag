-- Seed a default inventory item if table is empty
insert into public.inventory (sku, name, quantity_available)
select 'ALTX-GIFT-001', 'Alteryx New Hire Gift', 100
where not exists (select 1 from public.inventory);
