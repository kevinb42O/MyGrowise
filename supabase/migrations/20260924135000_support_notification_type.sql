-- Kept separate from the support tables migration: PostgreSQL requires a new
-- enum value to commit before it can be used by an insert-producing function.
alter type public.internal_notification_type add value if not exists 'support_message';
