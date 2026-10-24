import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from './config.js';

if (!supabaseConfigured) throw new Error('Supabase is not configured.');

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function createAccount(email, password, displayName = '') {
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName.trim().slice(0, 40) } }
  });
}

export async function sendMagicLink(email) {
  return supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: new URL('index.html', location.href).href } });
}

export async function sendPasswordReset(email) {
  return supabase.auth.resetPasswordForEmail(email, { redirectTo: new URL('login.html?flow=recovery', location.href).href });
}

export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: new URL('index.html', location.href).href } });
}
