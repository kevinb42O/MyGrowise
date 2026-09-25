import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | undefined;

// A stalled upstream request must not keep a Vercel function open until its
// 300-second runtime limit. Apply this to Auth and PostgREST alike.
export const supabaseFetch: typeof fetch = (input, init) => {
  const timeout = AbortSignal.timeout(12_000);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetch(input, { ...init, signal });
};

/**
 * Server-only client for trusted Astro routes, webhook handlers, and jobs.
 * Do not import this module from an Astro component with client-side code.
 */
export const getSupabaseAdmin = () => {
  if (adminClient) return adminClient;

  const url = import.meta.env.PUBLIC_SUPABASE_URL?.trim();
  const secretKey = import.meta.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secretKey) {
    throw new Error('Supabase server configuration is missing. Set PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.');
  }

  adminClient = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: supabaseFetch },
  });
  return adminClient;
};
