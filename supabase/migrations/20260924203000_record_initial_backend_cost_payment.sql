do $$
declare
  v_cost public.admin_recurring_costs%rowtype;
  v_paid_at timestamptz := timestamptz '2026-09-21 12:00:00+02';
  v_next_due_on date := date '2027-09-21';
  v_inserted_count integer := 0;
  v_changed boolean := false;
begin
  select * into v_cost
  from public.admin_recurring_costs
  where label = 'Hosting en gegevensbanken (backend)' and active
  order by created_at
  limit 1
  for update;

  if not found then
    raise exception 'Active backend recurring cost not found';
  end if;

  insert into public.admin_recurring_cost_payments (
    recurring_cost_id, amount_cents, currency, paid_at, next_due_on, note, recorded_by
  )
  select v_cost.id, v_cost.amount_cents, v_cost.currency, v_paid_at, v_next_due_on, '', null
  where not exists (
    select 1
    from public.admin_recurring_cost_payments
    where recurring_cost_id = v_cost.id and paid_at = v_paid_at
  );
  get diagnostics v_inserted_count = row_count;

  v_changed := v_cost.last_paid_at is distinct from v_paid_at
    or v_cost.next_due_on is distinct from v_next_due_on
    or v_inserted_count > 0;

  if v_cost.last_paid_at is distinct from v_paid_at or v_cost.next_due_on is distinct from v_next_due_on then
    update public.admin_recurring_costs
    set last_paid_at = v_paid_at, next_due_on = v_next_due_on
    where id = v_cost.id;
  end if;

  if v_changed then
    insert into public.security_audit_log (
      actor_user_id, action, object_type, object_id, before_snapshot, after_snapshot, metadata
    ) values (
      null,
      'admin_recurring_cost.payment_imported',
      'admin_recurring_cost',
      v_cost.id::text,
      jsonb_build_object(
        'amount_cents', v_cost.amount_cents,
        'currency', v_cost.currency,
        'next_due_on', v_cost.next_due_on,
        'last_paid_at', v_cost.last_paid_at
      ),
      jsonb_build_object(
        'amount_cents', v_cost.amount_cents,
        'currency', v_cost.currency,
        'next_due_on', v_next_due_on,
        'last_paid_at', v_paid_at
      ),
      jsonb_build_object('source', 'manual_initial_payment_record', 'note', '')
    );
  end if;
end;
$$;
