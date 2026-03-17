import { createClient } from '@supabase/supabase-js';

// Placeholders allow the module to initialize at build time without Supabase
// configured. Actual auth/sync calls are guarded by `isConfigured` in useAuth.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
