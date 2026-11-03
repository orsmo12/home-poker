// Supabase Edge Function: push a "you were added to a game" notification.
// The app calls it right after invite_to_game(). It only sends for invites the CALLER created,
// so nobody can use it to spam arbitrary users.
//
// Secrets to set (Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@example.com)
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const pub = Deno.env.get('VAPID_PUBLIC_KEY'), priv = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!pub || !priv) return json({ error: 'push not configured' }, 503);
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com', pub, priv);

  // who is calling?
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ error: 'not signed in' }, 401);

  const { invite_ids: ids, app_url: appUrl } = await req.json().catch(() => ({}));
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 20) return json({ error: 'bad request' }, 400);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: invites } = await admin.from('game_invites').select('id, user_id, view_token, table_name, host_name').in('id', ids).eq('invited_by', user.id);
  if (!invites?.length) return json({ sent: 0 });

  const base = typeof appUrl === 'string' && /^https:\/\//.test(appUrl) ? appUrl : '';
  let sent = 0;
  for (const inv of invites) {
    const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', inv.user_id);
    const payload = JSON.stringify({
      title: '🃏 המשחק התחיל!',
      body: `${inv.host_name || 'חבר'} צירף אותך${inv.table_name ? ` לשולחן "${inv.table_name}"` : ' למשחק'}. לחצו לצפייה בשידור החי`,
      url: `${base}?view=${encodeURIComponent(inv.view_token)}`,
      tag: `game-${inv.view_token}`,
    });
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id); // device unsubscribed
      }
    }
  }
  return json({ sent });
});
