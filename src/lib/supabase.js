import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// Service role key for data queries (bypasses RLS — access control at app layer)
const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || (!serviceKey && !anonKey)) {
  console.warn(
    'Supabase env vars missing (VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_KEY). Falling back to mock mode.'
  );
}

// Data client — uses service key for RLS bypass
export const supabase = supabaseUrl && (serviceKey || anonKey)
  ? createClient(supabaseUrl, serviceKey || anonKey)
  : null;

// Auth client — must use anon key for OAuth flows
export const supabaseAuth = supabaseUrl && anonKey
  ? createClient(supabaseUrl, anonKey)
  : null;
