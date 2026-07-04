/**
 * Vidi — frontend/src/lib/supabaseClient.js
 * Day 19 Task: Supabase Client Initialization
 *
 * Single Supabase client instance used across the entire frontend workspace.
 * Reads configuration vectors from Vite environment variables.
 *
 * REQUIRED Configuration (frontend/.env):
 * VITE_SUPABASE_URL=https://your-project-id.supabase.co
 * VITE_SUPABASE_ANON_KEY=your_anon_key_here
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.error(
    '[Vidi] Missing Supabase environment variables.\n' +
    'Please verify your frontend/.env setup contains: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.\n' +
    'Extraction path: Supabase Dashboard → Settings → API'
  );
}

// Single initialized instantiation config block
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,   // Automatic token background lease extensions
    persistSession: true,     // State retention across continuous hot reloads
    detectSessionInUrl: true, // Necessary parsing logic for Google OAuth redirect callbacks
  },
});

/**
 * Helper: Get the current session's JWT access token string block.
 * Utilized across api.js headers interceptors for seamless telemetry attachment.
 */
export async function getAccessToken() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch (err) {
    console.error('[Vidi] Access token resolution exception caught:', err);
    return null;
  }
}

/**
 * Helper: Safely query the active authentication tracking metadata block
 */
export async function getCurrentUser() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (err) {
    console.error('[Vidi] User metadata resolution exception caught:', err);
    return null;
  }
}