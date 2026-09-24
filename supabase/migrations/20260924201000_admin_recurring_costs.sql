create table public.admin_recurring_costs (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  amount_cents integer not null,
  currency char(3) not null default 'EUR',
  interval_months smallint not null default 12,
  next_due_on date not null,
  last_paid_at timestamptz,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_recurring_costs_label_length check (char_length(label) between 3 and 120),
  constraint admin_recurring_costs_amount check (amount_cents between 1 and 100000000),
  constraint admin_recurring_costs_currency check (currency ~ '^[A-Z]{3}$'),
  constraint admin_recurring_costs_interval check (interval_months between 1 and 120)
);
create index admin_recurring_costs_due_idx on public.admin_recurring_costs (next_due_on) where active;
create trigger admin_recurring_costs_set_updated_at before update on public.admin_recurring_costs for each row execute function public.set_updated_at();

create table public.admin_recurring_cost_payments (
  id uuid primary key default gen_random_uuid(),
  recurring_cost_id uuid not null references public.admin_recurring_costs(id) on delete restrict,
  amount_cents integer not null,
  currency char(3) not null,
  paid_at timestamptz not null default now(),
  next_due_on date not null,
  note text not null default '',
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint admin_recurring_cost_payments_amount check (amount_cents between 1 and 100000000),
  constraint admin_recurring_cost_payments_currency check (currency ~ '^[A-Z]{3}$'),
  constraint admin_recurring_cost_payments_note_length check (char_length(note) <= 500)
);
create index admin_recurring_cost_payments_history_idx on public.admin_recurring_cost_payments (recurring_cost_id, paid_at desc);

alter table public.admin_recurring_costs enable row level security;
alter table public.admin_recurring_cost_payments enable row level security;
create policy "recurring costs: admin read" on public.admin_recurring_costs for select to authenticated using (public.is_admin());
create policy "recurring cost payments: admin read" on public.admin_recurring_cost_payments for select to authenticated using (public.is_admin());
grant select on public.admin_recurring_costs, public.admin_recurring_cost_payments to authenticated;

insert into public.admin_recurring_costs (label, amount_cents, currency, interval_months, next_due_on)
select 'Hosting en gegevensbanken (backend)', 24000, 'EUR', 12, date '2027-09-21'
where not exists (
  select 1 from public.admin_recurring_costs where label = 'Hosting en gegevensbanken (backend)'
);

create or replace function public.update_admin_recurring_cost(
  p_cost_id uuid,
  p_actor_user_id uuid,
  p_label text,
  p_amount_cents integer,
  p_interval_months smallint,
  p_next_due_on date,
  p_request_id uuid default null,
  p_request_path text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cost public.admin_recurring_costs%rowtype;
begin
  if not exists (
    select 1 from public.user_roles where user_id = p_actor_user_id and role = 'super_admin'
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_label, ''))) not between 3 and 120
    or p_amount_cents is null or p_amount_cents not between 1 and 100000000
    or p_interval_months is null or p_interval_months not between 1 and 120
    or p_next_due_on is null then
    raise exception 'Invalid recurring cost' using errcode = '22023';
  end if;

  select * into v_cost
  from public.admin_recurring_costs
  where admin_recurring_costs.id = p_cost_id and active
  for update;
  if not found then
    raise exception 'Recurring cost not found' using errcode = 'P0002';
  end if;

  update public.admin_recurring_costs
  set label = trim(p_label), amount_cents = p_amount_cents, interval_months = p_interval_months,
      next_due_on = p_next_due_on, updated_by = p_actor_user_id
  where admin_recurring_costs.id = p_cost_id;

  insert into public.security_audit_log (
    actor_user_id, action, object_type, object_id, request_id, request_path, before_snapshot, after_snapshot, metadata
  ) values (
    p_actor_user_id, 'admin_recurring_cost.updated', 'admin_recurring_cost', p_cost_id::text, p_request_id, p_request_path,
    jsonb_build_object('label', v_cost.label, 'amount_cents', v_cost.amount_cents, 'currency', v_cost.currency, 'interval_months', v_cost.interval_months, 'next_due_on', v_cost.next_due_on),
    jsonb_build_object('label', trim(p_label), 'amount_cents', p_amount_cents, 'currency', v_cost.currency, 'interval_months', p_interval_months, 'next_due_on', p_next_due_on),
    '{}'::jsonb
  );
end;
$$;

revoke all on function public.update_admin_recurring_cost(uuid, uuid, text, integer, smallint, date, uuid, text) from public;
grant execute on function public.update_admin_recurring_cost(uuid, uuid, text, integer, smallint, date, uuid, text) to service_role;

create or replace function public.mark_admin_recurring_cost_paid(
  p_cost_id uuid,
  p_actor_user_id uuid,
  p_request_id uuid default null,
  p_request_path text default null,
  p_note text default ''
)
returns table (id uuid, label text, amount_cents integer, currency char(3), interval_months smallint, next_due_on date, last_paid_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cost public.admin_recurring_costs%rowtype;
  v_next_due_on date;
  v_updated public.admin_recurring_costs%rowtype;
  v_note text := coalesce(p_note, '');
begin
  if not exists (
    select 1 from public.user_roles where user_id = p_actor_user_id and role = 'super_admin'
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if char_length(v_note) > 500 then
    raise exception 'Invalid note' using errcode = '22023';
  end if;

  select * into v_cost
  from public.admin_recurring_costs
  where admin_recurring_costs.id = p_cost_id and active
  for update;
  if not found then
    raise exception 'Recurring cost not found' using errcode = 'P0002';
  end if;

  v_next_due_on := (v_cost.next_due_on + make_interval(months => v_cost.interval_months))::date;
  while v_next_due_on <= (now() at time zone 'Europe/Brussels')::date loop
    v_next_due_on := (v_next_due_on + make_interval(months => v_cost.interval_months))::date;
  end loop;

  update public.admin_recurring_costs
  set next_due_on = v_next_due_on, last_paid_at = now(), updated_by = p_actor_user_id
  where admin_recurring_costs.id = p_cost_id
  returning * into v_updated;

  insert into public.admin_recurring_cost_payments (
    recurring_cost_id, amount_cents, currency, paid_at, next_due_on, note, recorded_by
  ) values (
    v_cost.id, v_cost.amount_cents, v_cost.currency, now(), v_next_due_on, v_note, p_actor_user_id
  );

  insert into public.security_audit_log (
    actor_user_id, action, object_type, object_id, request_id, request_path, before_snapshot, after_snapshot, metadata
  ) values (
    p_actor_user_id, 'admin_recurring_cost.paid', 'admin_recurring_cost', p_cost_id::text, p_request_id, p_request_path,
    jsonb_build_object('amount_cents', v_cost.amount_cents, 'currency', v_cost.currency, 'next_due_on', v_cost.next_due_on),
    jsonb_build_object('amount_cents', v_updated.amount_cents, 'currency', v_updated.currency, 'next_due_on', v_updated.next_due_on, 'last_paid_at', v_updated.last_paid_at),
    jsonb_build_object('note', v_note)
  );

  return query select v_updated.id, v_updated.label, v_updated.amount_cents, v_updated.currency, v_updated.interval_months, v_updated.next_due_on, v_updated.last_paid_at;
end;
$$;

revoke all on function public.mark_admin_recurring_cost_paid(uuid, uuid, uuid, text, text) from public;
grant execute on function public.mark_admin_recurring_cost_paid(uuid, uuid, uuid, text, text) to service_role;
