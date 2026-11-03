/* Cloud context: optional sign-in, groups, leaderboards and background sync.
 *
 * Nothing here is required by the core app. The Supabase SDK is only loaded when
 *  - the user opens "Groups", or
 *  - a previous sign-in is remembered on this device, or
 *  - the URL carries an invite (?join=) or a Google sign-in callback (?code=).
 * Everything the user saw last time is cached locally, so groups and leaderboards
 * still show (read-only) when offline.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { appBaseUrl, cloudConfigured } from './config';
import { cloudErrorText, getClient } from './client';
import { pendingGames, pushPending } from './sync';
import { makeSnapshot, getLiveSession, pushLive, clearLiveSession } from './live';
import { track } from '../lib/analytics';
import { hashPhone, normalizePhone } from '../lib/phone';
import { pushSupported, subscribePush } from './push';

const CACHE_KEY = 'hpm-cloud-cache';
const Ctx = createContext({
  configured: false, online: true, signedIn: false, user: null, groups: [], boards: {}, games: {},
  pendingCount: 0, failedCount: 0, boot: async () => null,
});
export const useCloud = () => useContext(Ctx);

const readCache = () => { try { return JSON.parse(window.localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; } };
const writeCache = (c) => { try { window.localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch { /* full/blocked */ } };
const readLocalColor = () => { try { return window.localStorage.getItem('hpm-my-color') || ''; } catch { return ''; } };
const hasStoredSession = () => { try { return !!window.localStorage.getItem('hpm-auth'); } catch { return false; } };
const urlWantsCloud = () => /[?&](join|code|cloud)=/.test(window.location.search);

function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

export function CloudProvider({ state, dispatch, children }) {
  const stateRef = useRef(state); stateRef.current = state;
  const online = useOnline();
  const [client, setClient] = useState(null);
  const [session, setSession] = useState(null);
  const [booting, setBooting] = useState(false);
  const [cache, setCacheState] = useState(readCache); // { profile, groups, boards: {gid: rows}, games: {gid: rows}, at }
  const [syncing, setSyncing] = useState(false);
  const [wake, setWake] = useState(0); // bumps when it's a good moment to sync
  const setCache = useCallback((fn) => setCacheState((c) => { const n = typeof fn === 'function' ? fn(c) : fn; writeCache(n); return n; }), []);
  const user = session?.user || null;

  /* ---------- boot (lazy) ---------- */
  const boot = useCallback(async () => {
    if (!cloudConfigured || client || booting) return client;
    setBooting(true);
    try {
      const c = await getClient();
      const { data } = await c.auth.getSession();
      setSession(data.session || null);
      c.auth.onAuthStateChange((_e, s) => setSession(s || null));
      setClient(c);
      return c;
    } catch {
      return null; // offline on first use: stays local, try again later
    } finally { setBooting(false); }
  }, [client, booting]);

  useEffect(() => { if (cloudConfigured && (hasStoredSession() || urlWantsCloud())) boot(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (online && cloudConfigured && !client && hasStoredSession()) boot(); }, [online]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- profile + tables (cloud "groups") ---------- */
  const linked = useRef(new Map()); // cloudId -> local table id, for tables just pushed to the cloud
  const refresh = useCallback(async () => {
    if (!client || !user) return;
    const groupCols = 'id, name, invite_code, created_by, created_at';
    let g = await client.from('groups').select(`${groupCols}, felt`).order('created_at');
    if (g.error) g = await client.from('groups').select(groupCols).order('created_at'); // before migration 002
    const [{ data: profile }, tp] = await Promise.all([
      client.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      client.from('table_profiles').select('*'),
    ]);
    if (g.error) return;
    const groups = g.data || [];
    // Every cloud table also lives in the local table list, so "play again" works there too.
    groups.forEach((gr) => {
      const local = Object.values(stateRef.current.tables || {}).find((t) => t.cloudId === gr.id)
        || (linked.current.has(gr.id) ? stateRef.current.tables?.[linked.current.get(gr.id)] : null);
      if (!local && (stateRef.current.settings.hiddenTables || []).includes(gr.id)) return; // removed from my list
      if (!local) dispatch({ type: 'TABLE_UPSERT', table: { cloudId: gr.id, name: gr.name, felt: gr.felt || 'green', lastPlayed: gr.created_at } });
      else if ((gr.felt && gr.felt !== local.felt) || gr.name !== local.name) dispatch({ type: 'TABLE_UPSERT', table: { id: local.id, name: gr.name, felt: gr.felt || local.felt } });
    });
    setCache((c) => ({
      ...c, userId: user.id, profile: profile ? { ...profile, color: profile.color || c.profile?.color || readLocalColor() } : c.profile,
      groups, tableProfiles: tp.error ? c.tableProfiles || [] : tp.data || [], at: Date.now(),
    }));
  }, [client, user, setCache, dispatch]);

  useEffect(() => {
    if (!user) return;
    // Cached data belongs to one account only.
    if (cache.userId && cache.userId !== user.id) setCache({});
    if (online) refresh();
  }, [user?.id, online]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- background sync of saved games ---------- */
  const pending = useMemo(() => pendingGames(state.history), [state.history]);
  const failed = useMemo(() => state.history.filter((h) => h.syncError), [state.history]);
  const pendingKey = pending.map((p) => p.id).join(',');

  useEffect(() => {
    const kick = () => document.visibilityState === 'visible' && setWake((w) => w + 1);
    window.addEventListener('online', kick); document.addEventListener('visibilitychange', kick);
    return () => { window.removeEventListener('online', kick); document.removeEventListener('visibilitychange', kick); };
  }, []);

  // A saved game that belongs to a group but we never booted: boot so it can sync.
  useEffect(() => { if (pending.length && cloudConfigured && !client && hasStoredSession() && online) boot(); }, [pendingKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const syncRef = useRef(false);
  useEffect(() => {
    if (!client || !user || !online || !pending.length || syncRef.current) return;
    syncRef.current = true; setSyncing(true);
    const ensureTable = async (tableId) => {
      const t = stateRef.current.tables?.[tableId];
      const { data, error } = await client.rpc('create_group', { p_name: (t?.name || 'השולחן שלי').slice(0, 60) });
      if (error) throw error;
      linked.current.set(data.id, tableId);
      if (t?.felt) await client.from('groups').update({ felt: t.felt }).eq('id', data.id); // ignored before migration 002
      dispatch({ type: 'TABLE_UPSERT', table: { id: tableId, cloudId: data.id } });
      return data.id;
    };
    pushPending(client, state.history, state.tables, state.settings.currency, {
      ensureTable,
      onSynced: (id, gid) => dispatch({ type: 'HISTORY_PATCH', id, patch: { syncedAt: new Date().toISOString(), groupId: gid } }),
      onFailed: (id, err) => dispatch({ type: 'HISTORY_PATCH', id, patch: { syncError: cloudErrorText(err) } }),
    }).then(async (r) => {
      if (r.synced.length) track('games_synced', { count: r.synced.length });
      // "This is me" at each table, automatically, from the names I play under.
      const me = new Set((stateRef.current.settings.me || []).map((n) => n.trim().toLowerCase()));
      for (const gid of r.groups) {
        if (!me.size) break;
        const { data: players } = await client.from('group_players').select('id, name, claimed_by').eq('group_id', gid);
        if (!players || players.some((p) => p.claimed_by === user.id)) continue;
        const mine = players.find((p) => !p.claimed_by && me.has(p.name.trim().toLowerCase()));
        if (mine) await client.rpc('claim_player', { p_player: mine.id });
      }
      if (r.synced.length) { refresh(); actions.loadAllGames().catch(() => {}); }
    }).finally(() => { syncRef.current = false; setSyncing(false); });
  }, [client, user?.id, online, pendingKey, wake]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- live view-only link: push the game after every change ---------- */
  const lastSnap = useRef(null);
  useEffect(() => {
    const live = getLiveSession();
    if (!live) return undefined;
    const game = state.activeGame;
    if (!game) {
      // The game was saved or discarded: tell viewers it ended, then forget the link.
      if (lastSnap.current) pushLive(live, { ...lastSnap.current, end: 1, u: Date.now() }).catch(() => {});
      clearLiveSession(); lastSnap.current = null;
      return undefined;
    }
    if (live.gameId !== game.id) { clearLiveSession(); return undefined; }
    const snap = makeSnapshot(game, state.settings);
    lastSnap.current = snap;
    const t = setTimeout(() => { pushLive(live, snap).catch(() => {}); }, 1200); // debounce typing
    return () => clearTimeout(t);
  }, [state.activeGame, state.settings]);

  /* ---------- backup of the game in progress (signed-in hosts) ---------- */
  const backedUp = useRef(null); // game id currently stored in the cloud
  const backupOff = useRef(false); // table missing (migration 002 not run yet)
  const [backup, setBackup] = useState(null); // a cloud game we could restore on this device
  useEffect(() => {
    if (!client || !user || !online || backupOff.current) return undefined;
    const game = state.activeGame;
    if (!game) {
      if (backedUp.current) {
        backedUp.current = null;
        client.from('active_games').delete().eq('user_id', user.id).then(() => {}, () => {});
      }
      return undefined;
    }
    const t = setTimeout(async () => {
      const { error } = await client.from('active_games').upsert({ user_id: user.id, game_id: game.id, game, updated_at: new Date().toISOString() });
      if (error) { if (/active_games|PGRST205|42P01/.test(`${error.code} ${error.message}`)) backupOff.current = true; return; }
      backedUp.current = game.id;
    }, 2500);
    return () => clearTimeout(t);
  }, [client, user?.id, online, state.activeGame]); // eslint-disable-line react-hooks/exhaustive-deps

  // On sign-in / app open with no game here: is there an unfinished night in the cloud?
  useEffect(() => {
    if (!client || !user || !online || state.activeGame) return;
    let stop = false;
    client.from('active_games').select('game_id, game, updated_at').eq('user_id', user.id).maybeSingle().then(({ data, error }) => {
      if (stop || error || !data) return;
      const saved = stateRef.current.history.some((h) => h.id === data.game_id);
      const fresh = Date.now() - Date.parse(data.updated_at) < 36 * 3600e3;
      if (saved || !fresh) { client.from('active_games').delete().eq('user_id', user.id).then(() => {}, () => {}); return; }
      setBackup(data);
    }, () => {});
    return () => { stop = true; };
  }, [client, user?.id, online]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- "you were added to a game" invites (in-app fallback for push) ---------- */
  const [invites, setInvites] = useState([]);
  const loadInvites = useCallback(async () => {
    if (!client || !user || !online) return;
    const since = new Date(Date.now() - 12 * 3600e3).toISOString();
    const { data, error } = await client.from('game_invites').select('id, view_token, table_name, host_name, created_at').gte('created_at', since).order('created_at', { ascending: false });
    if (error || !data?.length) { setInvites([]); return; }
    // only games that are still on
    const live = [];
    for (const inv of data.slice(0, 5)) {
      const { data: g } = await client.rpc('get_live_game', { p_token: inv.view_token });
      if (g && !g.snapshot?.end) live.push(inv);
    }
    setInvites(live);
  }, [client, user, online]);
  useEffect(() => {
    loadInvites();
    const onVis = () => document.visibilityState === 'visible' && loadInvites();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [loadInvites]);

  // Already allowed notifications on this device? Keep its push subscription registered to this account.
  useEffect(() => {
    if (!client || !user || !pushSupported() || Notification.permission !== 'granted') return;
    subscribePush(client).catch(() => {});
  }, [client, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- actions (each boots the SDK on demand) ---------- */
  const need = async () => { const c = client || (await boot()); if (!c) throw new Error('network'); return c; };
  const actions = {
    boot,
    async sendCode(email) {
      const c = await need();
      const { error } = await c.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
      if (error) throw error;
    },
    async verifyCode(email, token) {
      const c = await need();
      const { error } = await c.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' });
      if (error) throw error;
      track('cloud_signed_in', { method: 'email' });
    },
    async signInWithGoogle(returnParams = '') {
      const c = await need();
      const { error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: appBaseUrl() + returnParams } });
      if (error) throw error;
    },
    async signOut() {
      const c = await need();
      await c.auth.signOut();
      setCache({});
    },
    async updateName(name) {
      const c = await need();
      const { error } = await c.from('profiles').update({ display_name: name.trim() }).eq('id', user.id);
      if (error) throw error;
      setCache((x) => ({ ...x, profile: { ...(x.profile || {}), display_name: name.trim() } }));
    },
    async createGroup(name) {
      const c = await need();
      const { data, error } = await c.rpc('create_group', { p_name: name.trim() });
      if (error) throw error;
      track('group_created');
      await refresh();
      return data;
    },
    /** Put a device-only table in the cloud (so friends can join it); its nights start syncing. */
    async shareTable(tableId) {
      const c = await need();
      const t = stateRef.current.tables?.[tableId];
      if (!t) throw new Error('no table');
      if (t.cloudId) return t.cloudId;
      const { data, error } = await c.rpc('create_group', { p_name: (t.name || 'השולחן שלי').slice(0, 60) });
      if (error) throw error;
      linked.current.set(data.id, tableId);
      if (t.felt) await c.from('groups').update({ felt: t.felt }).eq('id', data.id);
      dispatch({ type: 'TABLE_UPSERT', table: { id: tableId, cloudId: data.id } });
      stateRef.current.history.forEach((h) => {
        if (h.tableId === tableId && !h.syncedAt) dispatch({ type: 'HISTORY_PATCH', id: h.id, patch: { cloud: true, syncError: null } });
      });
      track('table_shared');
      await refresh();
      return data.id;
    },
    async joinGroup(code) {
      const c = await need();
      const { data, error } = await c.rpc('join_group', { p_code: code.trim() });
      if (error) throw error;
      const hidden = stateRef.current.settings.hiddenTables || [];
      if (data?.id && hidden.includes(data.id)) dispatch({ type: 'SETTINGS_UPDATE', patch: { hiddenTables: hidden.filter((x) => x !== data.id) } });
      track('group_joined');
      await refresh();
      return data;
    },
    async leaveGroup(gid) {
      const c = await need();
      const { error } = await c.from('group_members').delete().eq('group_id', gid).eq('user_id', user.id);
      if (error) throw error;
      setCache((x) => ({ ...x, groups: (x.groups || []).filter((g) => g.id !== gid) }));
    },
    async loadGroup(gid) {
      const c = await need();
      const [board, games] = await Promise.all([
        c.from('group_leaderboard').select('*').eq('group_id', gid).order('net', { ascending: false }),
        c.from('games').select('id, ended_at, recorded_by, currency, game_results(net, buy_in, player_id)')
          .eq('group_id', gid).is('deleted_at', null).order('ended_at', { ascending: false }).limit(30),
      ]);
      if (board.error) throw board.error;
      if (games.error) throw games.error;
      setCache((x) => ({ ...x, boards: { ...(x.boards || {}), [gid]: board.data }, games: { ...(x.games || {}), [gid]: games.data }, at: Date.now() }));
    },
    /** Every night at every table I belong to (with everyone's results), for the dashboard. */
    async loadAllGames() {
      const c = await need();
      const [games, players] = await Promise.all([
        c.from('games').select('id, group_id, ended_at, currency, game_results(player_id, net, buy_in, cash_out), settlements(from_player, to_player, amount)')
          .is('deleted_at', null).order('ended_at', { ascending: true }).limit(1000),
        c.from('group_players').select('id, group_id, name, avatar, claimed_by'),
      ]);
      if (games.error) throw games.error;
      if (players.error) throw players.error;
      setCache((x) => ({ ...x, allGames: games.data, allPlayers: players.data, allAt: Date.now() }));
    },
    async updateProfile({ name, avatar, color }) {
      const c = await need();
      const patch = {};
      if (name !== undefined) patch.display_name = name.trim();
      if (avatar !== undefined) patch.avatar = avatar;
      if (color !== undefined) { patch.color = color; try { window.localStorage.setItem('hpm-my-color', color); } catch { /* blocked */ } }
      let { error } = await c.from('profiles').update(patch).eq('id', user.id);
      if (error && patch.color !== undefined) { // column added in migration 002; keep the colour on this device meanwhile
        delete patch.color;
        ({ error } = Object.keys(patch).length ? await c.from('profiles').update(patch).eq('id', user.id) : { error: null });
      }
      if (error) throw error;
      setCache((x) => ({ ...x, profile: { ...(x.profile || {}), ...(name !== undefined ? { display_name: name.trim() } : {}), ...(avatar !== undefined ? { avatar } : {}), ...(color !== undefined ? { color } : {}) } }));
    },
    async setTableFelt(cloudId, felt) {
      const c = await need();
      await c.from('groups').update({ felt }).eq('id', cloudId);
    },
    async loadMyStats() {
      const c = await need();
      const [stats, results] = await Promise.all([
        c.from('my_stats').select('*').order('games', { ascending: false }),
        c.from('my_results').select('*').order('ended_at', { ascending: false }).limit(60),
      ]);
      if (stats.error) throw stats.error;
      if (results.error) throw results.error;
      setCache((x) => ({ ...x, my: { stats: stats.data, results: results.data } }));
    },
    async claimPlayer(playerId, gid) {
      const c = await need();
      const { error } = await c.rpc('claim_player', { p_player: playerId });
      if (error) throw error;
      track('player_claimed');
      await refresh();
      actions.loadAllGames().catch(() => {});
      actions.loadGroup(gid).catch(() => {});
    },
    /** Players at this table nobody has claimed yet (empty once I've claimed mine). */
    async claimOptions(gid) {
      const c = await need();
      const { data, error } = await c.rpc('table_claim_options', { p_group: gid });
      if (error) throw error;
      return data || [];
    },
    async deleteGame(id, gid) {
      const c = await need();
      const { error } = await c.rpc('delete_game', { p_id: id });
      if (error) throw error;
      await actions.loadGroup(gid);
    },
    /** Remove saved nights from the cloud too (only nights you uploaded can be removed). */
    async deleteGames(ids) {
      const c = await need();
      for (const id of ids) await c.rpc('delete_game', { p_id: id }).then(() => {}, () => {});
      actions.loadAllGames().catch(() => {});
    },
    async renameTable(cloudId, name) {
      const c = await need();
      const { error } = await c.from('groups').update({ name: name.trim().slice(0, 60) }).eq('id', cloudId);
      if (error) throw error;
      setCache((x) => ({ ...x, groups: (x.groups || []).map((g) => (g.id === cloudId ? { ...g, name: name.trim() } : g)) }));
    },
    /* ---- phone: me ---- */
    async loadMyPhone() {
      const c = await need();
      const { data } = await c.rpc('my_phone');
      setCache((x) => ({ ...x, myPhone: data || null }));
      return data;
    },
    async setMyPhone(raw, discoverable = true) {
      const c = await need();
      const e164 = raw ? normalizePhone(raw) : null;
      if (raw && !e164) throw new Error('מספר טלפון לא תקין');
      const { error } = await c.rpc('set_my_phone', { p_hash: e164 ? await hashPhone(e164) : '', p_last4: e164 ? e164.slice(-4) : '', p_discoverable: discoverable });
      if (error) throw error;
      track('phone_saved', { removed: !e164 });
      return actions.loadMyPhone();
    },
    /** Optional SMS verification (needs an SMS provider enabled in Supabase Auth). Then old tables follow you. */
    async sendPhoneCode(raw) {
      const c = await need();
      const e164 = normalizePhone(raw); if (!e164) throw new Error('מספר טלפון לא תקין');
      const { error } = await c.auth.updateUser({ phone: e164 });
      if (error) throw error;
      return e164;
    },
    async verifyPhoneCode(e164, token) {
      const c = await need();
      const { error } = await c.auth.verifyOtp({ phone: e164, token: token.trim(), type: 'phone_change' });
      if (error) throw error;
      const { data: n, error: e2 } = await c.rpc('claim_by_phone');
      if (e2) throw e2;
      track('phone_verified', { claimed: n || 0 });
      await refresh(); actions.loadAllGames().catch(() => {}); actions.loadMyPhone().catch(() => {});
      return n || 0;
    },
    /* ---- phone: players at my table ---- */
    async findUserByPhone(e164) {
      const c = await need();
      const hash = await hashPhone(e164);
      const { data, error } = await c.rpc('find_user_by_phone', { p_hash: hash });
      if (error) throw error;
      return { hash, match: data || null };
    },
    async linkPlayer(groupId, name, hash, userId) {
      const c = await need();
      const { error } = await c.rpc('link_player', { p_group: groupId, p_name: name, p_hash: hash, p_user: userId || null });
      if (error) throw error;
    },
    /** Pop-up + push for a registered player who was just seated in a live game. */
    async inviteToGame(userId, token, tableName) {
      const c = await need();
      const { data: id, error } = await c.rpc('invite_to_game', { p_user: userId, p_token: token, p_table: tableName || '' });
      if (error) throw error;
      if (id) c.functions.invoke('notify-game', { body: { invite_ids: [id], app_url: appBaseUrl() } }).catch(() => {});
      track('player_invited');
      return id;
    },
    async enablePush() {
      const c = await need();
      const perm = await Notification.requestPermission();
      track('push_permission', { result: perm });
      if (perm !== 'granted') return perm;
      await subscribePush(c);
      return perm;
    },
    async dismissInvite(id) {
      setInvites((l) => l.filter((x) => x.id !== id));
      const c = await need();
      await c.from('game_invites').delete().eq('id', id);
    },
    restoreBackup() {
      if (!backup) return;
      dispatch({ type: 'RESTORE_GAME', game: backup.game });
      track('game_restored');
      setBackup(null);
    },
    dismissBackup() {
      setBackup(null);
      client?.from('active_games').delete().eq('user_id', user?.id).then(() => {}, () => {});
    },
    retryFailed() {
      failed.forEach((h) => dispatch({ type: 'HISTORY_PATCH', id: h.id, patch: { syncError: null } }));
      setWake((w) => w + 1);
    },
  };

  // Offline with a remembered sign-in: keep showing the cached groups (read-only).
  const knownUser = user || (!client && cache.userId && hasStoredSession() ? { id: cache.userId, cached: true } : null);
  const value = {
    configured: cloudConfigured, online, ready: !!client, booting, syncing,
    user: knownUser, signedIn: !!knownUser, profile: cache.profile, groups: knownUser ? cache.groups || [] : [],
    boards: cache.boards || {}, games: cache.games || {}, my: cache.my || null, cachedAt: cache.at,
    allGames: cache.allGames || null, allPlayers: cache.allPlayers || [], tableProfiles: cache.tableProfiles || [],
    backup: state.activeGame ? null : backup,
    invites, myPhone: cache.myPhone || null,
    pendingCount: pending.length, failedCount: failed.length,
    ...actions,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
