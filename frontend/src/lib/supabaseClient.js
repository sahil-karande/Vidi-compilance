/**
 * Vidi — frontend/src/lib/supabaseClient.js
 * Day 19 Task: Supabase Client Initialization
 *
 * Single Supabase client instance used across the entire frontend.
 * Reads URL + anon key from Vite environment variables.
 *
 * REQUIRED: Create frontend/.env with:
 *   VITE_SUPABASE_URL=https://your-project-id.supabase.co
 *   VITE_SUPABASE_ANON_KEY=your_anon_key_here
 *
 * Get these from: Supabase Dashboard → Settings → API
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[Vidi] Missing Supabase environment variables.\n' +
    'Create frontend/.env with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.\n' +
    'Get these from: Supabase Dashboard → Settings → API'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,   // auto-refresh JWT before it expires
    persistSession: true,     // keep user logged in across page reloads
    detectSessionInUrl: true, // needed for OAuth redirect handling
  },
});

/**
 * Helper: Get the current session's JWT access token.
 * Used by lib/api.js to attach Authorization header on every request.
 */
export async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/**
 * Helper: Get the current authenticated user (or null).
 */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}