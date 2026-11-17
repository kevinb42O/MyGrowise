-- A valid 180-character support subject must never make the message insert fail.
-- A staff member with several roles receives exactly one notification per message.
create or replace function public.notify_support_staff()
returns trigger language plpgsql set search_path = '' as $$
declare v_subject text; v_assignee uuid;
begin
  if new.is_internal_note or new.sender_type = 'staff' then return new; end if;
  select subject,assigned_to into v_subject,v_assignee from public.support_conversations where id=new.conversation_id;
  insert into public.internal_notifications(recipient_user_id,notification_type,support_conversation_id,title)
  select distinct role.user_id,'support_message'::public.internal_notification_type,new.conversation_id,left('Klantvraag · ' || v_subject,180)
  from public.user_roles role
  where role.role in ('super_admin','support')
    and (new.sender_user_id is null or role.user_id <> new.sender_user_id)
    and (v_assignee is null or role.user_id = v_assignee);
  return new;
end; $$;
