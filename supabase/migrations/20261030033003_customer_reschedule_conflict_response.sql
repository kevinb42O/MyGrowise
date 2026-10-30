-- A stale browser form is a validation conflict, not a transient serialization
-- failure. SQLSTATE 40001 invites API retries that cannot resolve stale input.
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('public.reschedule_customer_appointment(uuid,uuid,timestamptz,timestamptz,uuid)'::regprocedure);
 execute replace(definition, $body$raise exception 'booking_changed' using errcode='40001'$body$, $body$raise exception 'booking_changed' using errcode='22023'$body$);
end;
$$;
