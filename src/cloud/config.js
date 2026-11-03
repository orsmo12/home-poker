/* Optional cloud module (Supabase).
 *
 * The app never needs it: without these two env vars nothing cloud-related is
 * shown, imported or downloaded. To turn it on, create a Supabase project, run
 * supabase/schema.sql, and set in `.env`:
 *   VITE_SUPABASE_URL=https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY=eyJ...
 */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const cloudConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
/** Email-code sign-in needs a custom SMTP sender in Supabase (the built-in one only mails
 *  the project's own team). Off until VITE_AUTH_EMAIL=1; Google sign-in is the default. */
export const emailAuthEnabled = import.meta.env.VITE_AUTH_EMAIL === '1';

/** Public base URL of the app (for invite / view links). */
export function appBaseUrl() {
  const env = import.meta.env.VITE_APP_URL;
  if (env) return env.replace(/\/?$/, '/');
  return window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
}
