-- One latest visible message per conversation keeps the inbox bounded and
-- prevents internal notes from becoming customer previews.
create view public.support_conversation_summaries with (security_invoker = true) as
select
  conversation.id,conversation.customer_user_id,conversation.guest_email,
  conversation.guest_name,conversation.guest_verified_at,conversation.public_reference,
  conversation.subject,conversation.category,conversation.status,conversation.priority,
  conversation.assigned_to,conversation.last_message_at,
  conversation.customer_last_read_at,conversation.staff_last_read_at,
  latest.body as preview_body,
  latest.sender_type as preview_sender_type,
  latest.created_at as preview_created_at,
  staff_message.created_at as last_staff_message_at,
  customer_message.created_at as last_customer_message_at
from public.support_conversations conversation
left join lateral (
  select message.body,message.sender_type,message.created_at
  from public.support_messages message
  where message.conversation_id=conversation.id and not message.is_internal_note
  order by message.created_at desc limit 1
) latest on true
left join lateral (
  select message.created_at from public.support_messages message
  where message.conversation_id=conversation.id and message.sender_type='staff' and not message.is_internal_note
  order by message.created_at desc limit 1
) staff_message on true
left join lateral (
  select message.created_at from public.support_messages message
  where message.conversation_id=conversation.id and message.sender_type in ('guest','customer') and not message.is_internal_note
  order by message.created_at desc limit 1
) customer_message on true;
revoke all on public.support_conversation_summaries from public,anon,authenticated;
grant select on public.support_conversation_summaries to service_role;
create index support_messages_visible_latest_idx on public.support_messages(conversation_id,created_at desc) where not is_internal_note;
create index support_messages_staff_latest_idx on public.support_messages(conversation_id,created_at desc) where sender_type='staff' and not is_internal_note;
