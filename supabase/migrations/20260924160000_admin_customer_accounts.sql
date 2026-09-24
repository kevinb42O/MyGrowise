-- Keep the superadmin customer directory limited to customer accounts.
-- Some older staff profiles still have the technical customer capability,
-- so internal organisation roles must take precedence.
create or replace view public.admin_customer_profiles as
select profile.id, profile.full_name, profile.created_at
from public.profiles as profile
where exists (
  select 1
  from public.user_roles as customer_role
  where customer_role.user_id = profile.id
    and customer_role.role = 'customer'
)
and not exists (
  select 1
  from public.user_roles as internal_role
  where internal_role.user_id = profile.id
    and internal_role.role in (
      'super_admin', 'support', 'employee', 'admin',
      'content_editor', 'clinical_reviewer', 'analyst'
    )
);

revoke all on public.admin_customer_profiles from public, anon, authenticated;
grant select on public.admin_customer_profiles to service_role;
