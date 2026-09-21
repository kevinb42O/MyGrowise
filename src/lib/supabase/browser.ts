import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

/**
 * Browser-safe Supabase client. This intentionally accepts only the public
 * publishable key; a service-role key must never be imported by client code.
 */
export const createBrowserSupabaseClient = () => {
  if (!url || !publishableKey) {
    throw new Error('Supabase browser configuration is missing. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  }

  return createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
};
