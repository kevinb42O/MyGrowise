-- Keep customer and practitioner as technical capabilities, while exposing a
-- deliberately small organisation-role model in the application.
alter type public.app_role add value if not exists 'employee';
