import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

/** False when the Supabase env vars are missing; the product library is then disabled. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let clientPromise: Promise<SupabaseClient | null> | null = null;

/**
 * The Supabase client, created on first use. supabase-js is loaded with a dynamic import so it
 * stays out of the start-up bundle (only the product library needs it). Resolves to null when
 * Supabase is not configured. A failed chunk load is not cached, so a retry can succeed.
 */
export const getSupabase = (): Promise<SupabaseClient | null> => {
  if (!isSupabaseConfigured) {
    if (!clientPromise) {
      console.warn(
        '[PinoutMaker] Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
        '(locally in .env.local, in production in the Netlify environment settings). The product library is disabled.',
      );
      clientPromise = Promise.resolve(null);
    }
    return clientPromise;
  }
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js')
      .then(({ createClient }) => createClient(supabaseUrl, supabaseAnonKey))
      .catch((err: unknown) => {
        clientPromise = null;
        throw err;
      });
  }
  return clientPromise;
};
