# Supabase operations

MyGrowise uses Supabase as its source of truth for accounts, practitioner availability,
booking requests, products, orders, entitlements, and private audit data. The schema is
versioned in `supabase/migrations`; never make production-only schema changes in the
Dashboard SQL editor.

## Local configuration

Copy `.env.example` to `.env`. Keep it local (it is ignored by Git) and lock it down:

```sh
chmod 600 .env
```

`PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` may be used in browser
code. `SUPABASE_SECRET_KEY` and `SUPABASE_DB_URL` are server/terminal secrets;
never prefix either with `PUBLIC_` or place either in an Astro client bundle.
`SUPABASE_ACCESS_TOKEN` is a local-only personal token used to generate database types;
it is not a deployment secret and should not be set in Vercel.

All account, practice, and admin routes use Supabase Auth. Legacy local identities can be
imported with `npm run supabase:migrate-identities`; it creates no outbound mail and assigns
an inaccessible random credential, so each existing person must use the normal password-reset
flow before their first sign-in.

## Database workflow

```sh
npm run supabase:push      # apply committed migrations to the linked database
npm run supabase:types     # regenerate src/lib/supabase/database.types.ts after schema changes
npm run build
```

Use a new timestamped migration for every schema change. `supabase db pull` is only for
recovering an emergency Dashboard change; commit the resulting migration immediately.
Type generation uses the Management API and therefore needs `SUPABASE_ACCESS_TOKEN` in
your local `.env`; it is intentionally not required for migrations, which use the database
connection string directly.

## Production checklist

1. In **Authentication → URL Configuration**, set the production site URL and every
   exact callback URL. Keep localhost callbacks only for development.
2. In **Authentication → Providers**, enable only providers that are implemented. For
   email/password, require email confirmation and keep secure password changes enabled.
3. Configure a production SMTP provider before inviting real users or enabling password resets;
   the default email delivery is not appropriate for production.
4. Add `/account/wachtwoord-herstellen` on the production domain to Supabase Auth's exact
   redirect allow-list before activating password reset.
5. Store payment/email provider credentials as Supabase Edge Function secrets or Vercel
   server environment variables—never in the database, a migration, or a `PUBLIC_` value.
6. Keep the database network restriction on Supabase’s managed default until there is a
   stable production egress IP. Enforce SSL for every external database client.
7. Enable daily backups/PITR according to the selected Supabase plan and test restoration
   before relying on it for customer records.

## Security model

Row-level security is enabled on every application table. Anonymous users can only read
active practitioner profiles and published products. PII, bookings, orders, entitlements,
availability exceptions, and audit logs are never publicly readable. Browser clients have
no direct table write permissions; booking creation uses a narrowly scoped RPC. All
privileged writes use the server-only service-role client, which bypasses RLS and therefore
must remain inside trusted Astro routes/webhooks.
