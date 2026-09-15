import { createClient } from '@supabase/supabase-js';

// Public (publishable) values only — safe to ship in the frontend.
// Override with VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env if you ever switch projects.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://azenzsggqexyonafxlsf.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable__Z7PaYKUMaj4zNIgK2bb4w_1TdSSQ-3';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
