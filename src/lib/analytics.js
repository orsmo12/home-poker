/* Anonymous product analytics (PostHog).
 *
 * Off until you add a key: create a free PostHog project (eu.posthog.com), then put
 *   VITE_POSTHOG_KEY=phc_xxx
 *   VITE_POSTHOG_HOST=https://eu.i.posthog.com
 * in a `.env` file and rebuild.  Without a key nothing is loaded or sent.
 *
 * Privacy: we never send names, amounts or chip counts — only counts and events
 * (e.g. "a game with 6 players was settled"). Users can opt out in Settings.
 */
const KEY = import.meta.env.VITE_POSTHOG_KEY;
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com';
const OPT_OUT_KEY = 'hpm-analytics-off';

let ph = null;      // the PostHog client once loaded
let queue = [];     // events fired before it finished loading

export const analyticsConfigured = Boolean(KEY);

export function isOptedOut() {
  try { return window.localStorage.getItem(OPT_OUT_KEY) === '1'; } catch { return false; }
}

export function setOptOut(off) {
  try { window.localStorage.setItem(OPT_OUT_KEY, off ? '1' : '0'); } catch { /* storage blocked */ }
  if (ph) (off ? ph.opt_out_capturing() : ph.opt_in_capturing());
}

export async function initAnalytics() {
  if (!KEY || ph || isOptedOut()) return;
  try {
    const { default: posthog } = await import('posthog-js');
    posthog.init(KEY, {
      api_host: HOST,
      person_profiles: 'identified_only', // anonymous visitors, no personal profiles
      autocapture: false,                 // only the events we send on purpose
      capture_pageview: true,
      disable_session_recording: true,
      persistence: 'localStorage',
    });
    posthog.register({
      standalone: window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true,
      app_version: __APP_VERSION__,
    });
    ph = posthog;
    queue.forEach(([e, p]) => ph.capture(e, p));
    queue = [];
  } catch {
    ph = null; // network blocked or library failed: the app keeps working
  }
}

/** Fire-and-forget event. Props must never contain names or money. */
export function track(event, props = {}) {
  if (!KEY || isOptedOut()) return;
  if (ph) ph.capture(event, props);
  else if (queue.length < 50) queue.push([event, props]);
}

/** Public link to the app, added to shared settlement messages. */
const topLevel = (() => { try { return window.self === window.top; } catch { return false; } })();
export const APP_URL = import.meta.env.VITE_APP_URL
  || (typeof window !== 'undefined' && topLevel && window.location.protocol === 'https:' ? window.location.origin + window.location.pathname : '');

/** Version number shown in the app (from package.json). */
export const APP_VERSION = __APP_VERSION__;
