/* View-only sharing of the game in progress.
 *
 *  - With the cloud module: a LIVE link (?view=TOKEN). The host's app pushes a small
 *    snapshot after every change; viewers poll it. Works without the host signing in.
 *  - Without it (or offline): a SNAPSHOT link (#snap=...) that carries the state
 *    inside the URL itself. No server at all, but it does not update by itself.
 */
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { getClient } from './client';

const LIVE_KEY = 'hpm-live';

/** Compact, name-only snapshot: no ids, no history, nothing else from the device. */
export function makeSnapshot(game, settings, extra = {}) {
  return {
    v: 1,
    cur: settings.currency,
    r: game.chipsPerUnit,
    e: Number(game.entry) || Number(settings.defaultBuyIn) || 0,
    st: game.startedAt,
    ph: game.phase,
    nm: game.name || '',
    f: game.felt || 'green',
    gn: game.groupName || '',
    u: Date.now(),
    pd: Object.keys(game.paid || {}),
    x: (game.expenses || []).map((e) => ({ k: e.kind, l: e.label || '', a: e.amount, p: game.seats.findIndex((st) => st.id === e.paidBy), s: (e.split || []).map((id) => game.seats.findIndex((st) => st.id === id)).filter((i) => i >= 0) })),
    s: game.seats.map((s) => ({
      n: s.name, a: s.avatar, p: typeof s.pos === 'number' ? Math.round(s.pos * 1000) / 1000 : null,
      b: s.transactions.map((t) => t.amount), k: s.stackChips, c: s.cashOutChips, l: s.leftEarly ? 1 : 0, h: s.chip ?? null, g: s.glow || '', w: s.link || '',
    })),
    ...extra,
  };
}

/** Rebuild a Game-shaped object (enough for the read-only table and the settlement maths). */
export function snapshotToGame(snap) {
  return {
    id: 'view', startedAt: snap.st, phase: snap.ph, chipsPerUnit: snap.r || 1, entry: Number(snap.e) || 0,
    name: String(snap.nm || '').slice(0, 30), groupName: String(snap.gn || '').slice(0, 60), felt: ['green', 'blue', 'red', 'black'].includes(snap.f) ? snap.f : 'green',
    expenses: (snap.x || []).filter((e) => e.p >= 0).map((e, j) => ({ id: `e${j}`, kind: String(e.k || 'other'), label: String(e.l || '').slice(0, 30), amount: Number(e.a) || 0, paidBy: `s${e.p}`, split: (e.s || []).map((i) => `s${i}`) })),
    seats: (snap.s || []).map((s, i) => ({
      id: `s${i}`, playerId: `p${i}`, name: String(s.n || '').slice(0, 40), avatar: Number(s.a) || 0, chip: typeof s.h === 'number' ? s.h : i, glow: /^#[0-9a-f]{6}$/i.test(s.g || '') ? s.g : '',
      pos: typeof s.p === 'number' ? s.p : null,
      transactions: (s.b || []).map((amount, j) => ({ id: `t${i}-${j}`, type: j ? 'rebuy' : 'buyin', amount: Number(amount) || 0 })),
      stackChips: s.k ?? null, cashOutChips: s.c ?? null, leftEarly: !!s.l, link: s.w ? String(s.w).slice(0, 40) : null,
    })),
  };
}

export const encodeSnap = (snap) => compressToEncodedURIComponent(JSON.stringify(snap));
export function decodeSnap(str) {
  try { const s = JSON.parse(decompressFromEncodedURIComponent(str) || 'null'); return s && s.v === 1 ? s : null; }
  catch { return null; }
}

/* ---- the host's live session (one at a time, tied to the active game id) ---- */
export function getLiveSession() {
  try { return JSON.parse(window.localStorage.getItem(LIVE_KEY) || 'null'); } catch { return null; }
}
function setLiveSession(v) {
  try { v ? window.localStorage.setItem(LIVE_KEY, JSON.stringify(v)) : window.localStorage.removeItem(LIVE_KEY); } catch { /* blocked */ }
}
export const clearLiveSession = () => setLiveSession(null);

export async function startLive(gameId, snapshot, groupId) {
  const client = await getClient();
  const { data, error } = await client.rpc('create_live_game', { p_snapshot: snapshot, p_group: groupId || null });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  const session = { gameId, id: row.id, key: row.write_key, token: row.view_token };
  setLiveSession(session);
  return session;
}

export async function pushLive(session, snapshot) {
  const client = await getClient();
  const { error } = await client.rpc('update_live_game', { p_id: session.id, p_key: session.key, p_snapshot: snapshot });
  if (error) throw error;
}

export async function fetchLive(token) {
  const client = await getClient();
  const { data, error } = await client.rpc('get_live_game', { p_token: token });
  if (error) throw error;
  return data; // { snapshot, updated_at, group: { name, invite_code } | null } | null
}
