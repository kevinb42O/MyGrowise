insert into public.admin_work_items (title, category, priority, status, metadata)
select seed.title, seed.category, seed.priority, 'open', seed.metadata
from (values
  ('Koppel een gevalideerde betaalprovider en webhook', 'payment', 1, '{"integration":"payments"}'::jsonb),
  ('Configureer productie-SMTP vóór het uitnodigen van gebruikers', 'system', 1, '{"integration":"email"}'::jsonb),
  ('Koppel de consent-aware first-party eventlaag', 'system', 2, '{"integration":"analytics"}'::jsonb),
  ('Migreer superadmin-aanmelding van de lokale sessie naar Supabase Auth', 'system', 2, '{"area":"auth"}'::jsonb)
) as seed(title, category, priority, metadata)
where not exists (select 1 from public.admin_work_items item where item.title = seed.title);
