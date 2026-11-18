-- Shared matching for the header and full directory; preserve the existing RPC for older clients.
create function public.search_patient_choices_v2(p_actor uuid,p_search text,p_recent boolean default false,p_status text default 'active',p_limit integer default 9)
returns table(id uuid,name text,email text,status text) language sql stable security invoker set search_path='' as $$
 with search as (
   select public.patient_search_text(trim(coalesce(p_search,''))) as term
 ), candidates as (
   select p.*,r.visited_at,public.patient_search_text(p.full_name) as normalized_name,
     public.patient_search_text(p.email) as normalized_email,s.term
   from public.patients p cross join search s
   left join public.patient_recent_visits r on r.patient_id=p.id and r.user_id=p_actor
   where public.patient_actor_can_access(p_actor,p.id)
     and (p_status='all' or p.status::text=p_status)
     and (not p_recent or r.patient_id is not null)
 )
 select c.id,c.full_name,c.email,c.status::text from candidates c
 where c.term='' or not exists (
   select 1 from regexp_split_to_table(c.term,'\s+') token
   where strpos(c.normalized_name,token)=0 and strpos(c.normalized_email,token)=0
 )
 order by case when p_recent then c.visited_at end desc nulls last,
   case when c.normalized_name=c.term or c.normalized_email=c.term then 0
     when not exists (select 1 from regexp_split_to_table(c.term,'\s+') token
       where not exists (select 1 from regexp_split_to_table(c.normalized_name,'\s+') word where starts_with(word,token))
         and not starts_with(c.normalized_email,token)) then 1 else 2 end,
   c.normalized_name,c.id
 limit least(501,greatest(1,p_limit));
$$;
revoke all on function public.search_patient_choices_v2(uuid,text,boolean,text,integer) from public,anon,authenticated;
grant execute on function public.search_patient_choices_v2(uuid,text,boolean,text,integer) to service_role;
