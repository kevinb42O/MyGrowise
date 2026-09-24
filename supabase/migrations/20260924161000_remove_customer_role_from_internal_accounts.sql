-- Internal organisation accounts must not also be customer accounts.
-- Account creation installs the customer role by default, and legacy staff
-- promotions could leave that capability attached to an internal identity.
delete from public.user_roles as customer_role
using public.user_roles as internal_role
where customer_role.user_id = internal_role.user_id
  and customer_role.role = 'customer'
  and internal_role.role in (
    'super_admin', 'support', 'employee', 'admin',
    'content_editor', 'clinical_reviewer', 'analyst'
  );
