-- pgcrypto lives outside an empty security-definer search_path on Supabase.
-- PostgreSQL's built-in UUID generator works without exposing extension schema.
create or replace function public.create_guest_support_conversation(
  p_email text,p_name text,p_category text,p_body text,p_submission_key uuid
) returns table(conversation_id uuid, reference text)
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_reference text; v_message_id uuid;
begin
  if p_submission_key is null or p_email is null or char_length(p_email) not between 3 and 254
    or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or p_name is null or char_length(p_name) not between 1 and 100
    or p_category not in ('general','order','access','booking','privacy','other','collaboration')
    or p_body is null or char_length(p_body) not between 1 and 4000 then
    raise exception 'Invalid support input' using errcode = '22023';
  end if;
  select id,public_reference into v_id,v_reference from public.support_conversations where submission_key=p_submission_key;
  if found then return query select v_id,v_reference; return; end if;
  v_reference := upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  insert into public.support_conversations(guest_email,guest_name,subject,category,public_reference,submission_key)
  values(lower(trim(p_email)),trim(p_name),'Vraag ' || v_reference,p_category,v_reference,p_submission_key)
  returning id into v_id;
  insert into public.support_messages(conversation_id,sender_user_id,sender_type,body)
  values(v_id,null,'guest',p_body) returning id into v_message_id;
  insert into public.support_mail_jobs(conversation_id,message_id,kind) values(v_id,v_message_id,'receipt');
  return query select v_id,v_reference;
end; $$;
