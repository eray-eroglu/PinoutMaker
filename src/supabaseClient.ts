import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

/** Null when the Supabase env vars are missing; the product library is then disabled. */
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (!supabase) {
  console.warn(
    '[PinoutMaker] Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
    '(locally in .env.local, in production in the Netlify environment settings). The product library is disabled.',
  );
}
