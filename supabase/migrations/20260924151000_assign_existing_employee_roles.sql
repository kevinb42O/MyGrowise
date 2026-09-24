-- The enum value is committed by the preceding migration before it is used.
-- Practitioner/customer remain technical capabilities for a profile's own
-- practice workspace and bookings; employee is the visible organisation role.
insert into public.user_roles (user_id, role)
select p.user_id, 'employee'::public.app_role
from public.practitioners p
where p.slug in ('margot', 'amy')
on conflict (user_id, role) do nothing;
