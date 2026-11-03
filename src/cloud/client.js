import { SUPABASE_ANON_KEY, SUPABASE_URL, cloudConfigured } from './config';

/* The Supabase SDK is loaded lazily, only the first time a cloud feature is used,
 * so people who never open "Groups" never download it. */
let clientPromise = null;

export function getClient() {
  if (!cloudConfigured) return Promise.reject(new Error('cloud not configured'));
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true, // Google sign-in returns to the app with a code in the URL
          flowType: 'pkce',
          storageKey: 'hpm-auth',
        },
      })
    ).catch((e) => { clientPromise = null; throw e; });
  }
  return clientPromise;
}

/** Network / offline errors are retried later; anything else is a real failure. */
export function isTransient(err) {
  if (!err) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg = String(err.message || err).toLowerCase();
  return msg.includes('fetch') || msg.includes('network') || msg.includes('timeout') || err.status === 0 || err.status >= 500;
}

/** Hebrew text for errors the user may see. */
export function cloudErrorText(err) {
  const msg = String(err?.message || err || '');
  if (/invalid code/i.test(msg)) return 'קוד ההזמנה לא נמצא. בדקו שהקלדתם נכון.';
  if (/not a member/i.test(msg)) return 'אינך חבר בקבוצה הזו.';
  if (/already claimed/i.test(msg)) return 'מישהו אחר כבר סימן את השחקן הזה כשלו.';
  if (/token|otp|expired/i.test(msg)) return 'הקוד שגוי או שפג תוקפו. בקשו קוד חדש.';
  if (/rate limit|too many/i.test(msg)) return 'יותר מדי ניסיונות. נסו שוב בעוד דקה.';
  if (isTransient(err)) return 'אין חיבור לאינטרנט כרגע. ננסה שוב כשתהיה רשת.';
  return 'משהו השתבש. נסו שוב.';
}
