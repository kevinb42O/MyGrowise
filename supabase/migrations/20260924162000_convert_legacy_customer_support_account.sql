-- The old local identity store identifies one legacy customer that was later
-- assigned the support role in Supabase. Convert only an unambiguous matching
-- support identity; leave every other internal role untouched.
do $$
declare
  target_user_id uuid;
begin
  select (array_agg(u.id))[1]
    into target_user_id
  from auth.users as u
  join public.profiles as p on p.id = u.id
  where lower(coalesce(u.raw_user_meta_data ->> 'full_name', p.full_name)) = 'kevin bourguignon'
    and exists (
      select 1 from public.user_roles as r
      where r.user_id = u.id and r.role = 'support'
    )
    and not exists (
      select 1 from public.user_roles as r
      where r.user_id = u.id
        and r.role in ('super_admin', 'employee', 'admin', 'content_editor', 'clinical_reviewer', 'analyst')
    )
  having count(*) = 1;

  if target_user_id is not null then
    delete from public.user_roles
    where user_id = target_user_id and role = 'support';

    insert into public.user_roles (user_id, role)
    values (target_user_id, 'customer')
    on conflict (user_id, role) do nothing;

    insert into public.security_audit_log (actor_user_id, action, object_type, object_id, metadata)
    values (
      null,
      'account.role_migrated',
      'user',
      target_user_id::text,
      jsonb_build_object('from', 'support', 'to', 'customer', 'reason', 'legacy_customer_identity')
    );
  end if;
end;
$$;
