/* =============================================================================
 * STATE — single source of truth, persisted to localStorage (works offline).
 *
 * AppState {
 *   version: 5
 *   settings: { currency, defaultBuyIn, chipsPerBuyIn, maxSeats, me: string[] }   // me = my names at the table
 *   players:  { [id]: { id, name, avatar, createdAt } }     // shared registry
 *   tables:   { [id]: Table }                                // "arenas" you play at again and again
 *   activeGame: Game | null
 *   history: SessionRecord[]                                 // for a future Stats screen
 * }
 * Game  { id, startedAt, phase: 'playing'|'cashout'|'settle', chipsPerUnit, seats: Seat[],
 *         groupId?: string, groupName?: string, name?: string }  // optional group + table name
 *        seats[] order === seating order around the table (drag & drop reorders it)
 * Seat  { id, playerId, name, avatar, pos,   // pos: 0..1 along the rail (null = spread evenly)
 *         transactions: [{ id, type: 'buyin'|'rebuy', amount, at }],
 *         stackChips: number|null, cashOutChips: number|null, leftEarly: boolean }
 * Table { id, name, felt: 'green'|'blue'|'red'|'black', cloudId?: string (Supabase group id),
 *         playerIds: string[], buyIn, chips, createdAt, lastPlayed }
 * SessionRecord { id, type: 'cash', startedAt, endedAt, chipsPerUnit, tableId?, name?, felt?, cloud?: bool,
 *         results: [{ playerId, name, buyIn, cashOutChips, cashOut, net }],
 *         settlements: [{ fromId, from, toId, to, amount }],
 *         groupId?: string, syncedAt?: string }   // cloud fields, only when the user joined a group
 * ========================================================================== */
import { useEffect, useReducer, useState } from 'react';

const STORAGE_KEY = 'home-poker-manager';
const SCHEMA_VERSION = 5;

export const initialState = {
  version: SCHEMA_VERSION,
  settings: { currency: '₪', defaultBuyIn: 100, chipsPerBuyIn: 1000, maxSeats: 10, me: [] },
  players: {},
  tables: {},
  activeGame: null,
  history: [],
};

/* ---------- helpers ---------- */
/** Globally unique ids (needed once games can sync between devices). */
export const uid = () => (globalThis.crypto?.randomUUID
  ? globalThis.crypto.randomUUID()
  : Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
export const toCents = (n) => Math.round(Number(n || 0) * 100);
export const fromCents = (c) => c / 100;
const now = () => new Date().toISOString();
export const numFmt = (n, d = 2) => Number(n || 0).toLocaleString('he-IL', { maximumFractionDigits: d });
export const CURRENCY_WORD = { '₪': 'שקלים', $: 'דולר', '€': 'אירו' };
export const chipsPerUnitOf = (s) =>
  Number(s.chipsPerBuyIn) > 0 && Number(s.defaultBuyIn) > 0 ? Number(s.chipsPerBuyIn) / Number(s.defaultBuyIn) : 1;
const hash = (str) => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/* ---------- persistence ---------- */
function migrate(saved) {
  // fields from very old versions are dropped on load
  const { activeCash: _oldCash, activeTournament: _oldTournament, ...rest } = saved || {};
  const old = saved?.settings || {};
  const settings = { ...initialState.settings, ...old };
  if (old.chipsPerBuyIn === undefined && old.ratioMoney && old.ratioChips) {
    settings.chipsPerBuyIn = Math.round(((settings.defaultBuyIn || 100) * old.ratioChips) / old.ratioMoney);
  }
  delete settings.ratioMoney; delete settings.ratioChips;
  const players = Object.fromEntries(
    Object.entries(rest.players || {}).map(([id, p]) => [id, { avatar: hash(p.name || id) % 24, ...p }])
  );
  let activeGame = null;
  if (saved?.version >= 2 && saved.activeGame) {
    activeGame = {
      ...saved.activeGame,
      seats: saved.activeGame.seats.map((s) => ({ avatar: players[s.playerId]?.avatar ?? 0, ...s })),
    };
  }
  // v5: every saved night belongs to a table. Older nights are grouped by their cloud group or name.
  const tables = { ...(rest.tables || {}) };
  const history = (rest.history || []).map((h) => {
    if (h.tableId) return h;
    const key = h.groupId ? `g-${h.groupId}` : h.name ? `n-${h.name.toLowerCase()}` : 'home';
    if (!tables[key]) {
      tables[key] = {
        id: key, name: h.name || h.groupName || 'השולחן שלי', felt: 'green', cloudId: h.groupId || null,
        playerIds: [], buyIn: null, chips: null, createdAt: h.startedAt || h.endedAt, lastPlayed: h.endedAt,
      };
    }
    const t = tables[key];
    t.playerIds = [...new Set([...t.playerIds, ...h.results.map((r) => r.playerId)])];
    if (!t.lastPlayed || h.endedAt > t.lastPlayed) t.lastPlayed = h.endedAt;
    return { ...h, tableId: key };
  });
  return { ...initialState, ...rest, players, settings, activeGame, tables, history, version: SCHEMA_VERSION };
}

function load() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? migrate(JSON.parse(raw)) : initialState;
  } catch { return initialState; }
}
function save(state) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch { return false; }
}

/* ---------- seating ---------- */
/** Each seat's spot along the rail (0..1, bottom-center, clockwise). Unplaced seats are spread evenly. */
export function seatTs(seats) {
  return seats.map((s, i) => (typeof s.pos === 'number' ? s.pos : i / Math.max(seats.length, 1)));
}
/** Middle of the biggest empty stretch of rail, for a newly seated player. */
function freeSpot(ts) {
  if (!ts.length) return 0;
  const sorted = [...ts].sort((a, b) => a - b);
  let best = 0, gap = -1;
  sorted.forEach((t, i) => {
    const next = i === sorted.length - 1 ? sorted[0] + 1 : sorted[i + 1];
    if (next - t > gap) { gap = next - t; best = (t + (next - t) / 2) % 1; }
  });
  return best;
}

/* ---------- reducer ---------- */
function updateSeat(state, seatId, fn) {
  return { ...state, activeGame: { ...state.activeGame, seats: state.activeGame.seats.map((s) => (s.id === seatId ? fn(s) : s)) } };
}

export function reducer(state, a) {
  switch (a.type) {
    case 'SETTINGS_UPDATE':
      return { ...state, settings: { ...state.settings, ...a.patch } };
    case 'GAME_START': {
      // Play at an existing table (again) or open a new one.
      let tables = state.tables || {};
      let table = a.tableId ? tables[a.tableId] : null;
      const name = (a.name ?? table?.name ?? '').trim().slice(0, 30);
      const felt = a.felt || table?.felt || 'green';
      if (!table) table = { id: uid(), name: name || 'השולחן שלי', felt, cloudId: a.cloudId || null, playerIds: [], createdAt: now() };
      table = { ...table, name: name || table.name, felt, buyIn: state.settings.defaultBuyIn, chips: state.settings.chipsPerBuyIn, lastPlayed: now() };
      tables = { ...tables, [table.id]: table };
      return {
        ...state, tables,
        activeGame: {
          id: uid(), startedAt: now(), phase: 'playing', chipsPerUnit: chipsPerUnitOf(state.settings),
          entry: Number(state.settings.defaultBuyIn) || 0, seats: [],
          tableId: table.id, felt, name: table.name,
          groupId: table.cloudId || a.groupId || null, groupName: a.groupName || '',
        },
      };
    }
    case 'TABLE_UPSERT': {
      // a.table: partial table; matched by id, or by cloudId for tables that came from the cloud.
      const tables = { ...(state.tables || {}) };
      const existing = a.table.id ? tables[a.table.id] : Object.values(tables).find((t) => a.table.cloudId && t.cloudId === a.table.cloudId);
      const t = { playerIds: [], createdAt: now(), felt: 'green', ...existing, ...a.table };
      if (!t.id) t.id = uid();
      tables[t.id] = t;
      return { ...state, tables };
    }
    case 'TABLE_REMOVE': {
      const tables = { ...(state.tables || {}) };
      const cloudId = tables[a.id]?.cloudId;
      delete tables[a.id];
      // a cloud table removed from the list must not come back on the next refresh
      const hidden = cloudId ? [...new Set([...(state.settings.hiddenTables || []), cloudId])] : state.settings.hiddenTables;
      return { ...state, tables, settings: { ...state.settings, hiddenTables: hidden } };
    }
    case 'SET_FELT':
      return state.activeGame ? { ...state, activeGame: { ...state.activeGame, felt: a.felt } } : state;
    case 'SET_GAME_NAME': {
      if (!state.activeGame) return state;
      const nm = (a.name || '').trim().slice(0, 30);
      const tid = state.activeGame.tableId;
      const tables = tid && state.tables?.[tid] && nm ? { ...state.tables, [tid]: { ...state.tables[tid], name: nm } } : state.tables;
      return { ...state, tables, activeGame: { ...state.activeGame, name: nm } };
    }
    case 'HISTORY_PATCH':
      // Cloud bookkeeping on a saved game (groupId / syncedAt). Never touches the numbers.
      return { ...state, history: state.history.map((h) => (h.id === a.id ? { ...h, ...a.patch } : h)) };
    case 'ADD_PLAYER': {
      const clean = a.name.trim();
      let player = Object.values(state.players).find((p) => p.name.toLowerCase() === clean.toLowerCase());
      let players = state.players;
      if (!player) player = { id: uid(), name: clean, avatar: a.avatar ?? 0, createdAt: now() };
      else if (a.avatar !== undefined) player = { ...player, avatar: a.avatar };
      if (a.phone) player = { ...player, phone: a.phone }; // E.164, kept on this device only
      players = { ...players, [player.id]: player };
      const cur = state.activeGame.seats;
      const placed = cur.some((s) => typeof s.pos === 'number');
      const prev = placed ? seatTs(cur) : null;
      // Each seat gets its own casino-chip colour, so even two identical characters look different.
      const takenChips = new Set(cur.map((s2, i) => s2.chip ?? i));
      let chip = 0; while (takenChips.has(chip) && chip < 50) chip++;
      const seat = {
        id: uid(), playerId: player.id, name: player.name, avatar: player.avatar, chip,
        pos: placed ? freeSpot(prev) : null,
        transactions: [{ id: uid(), type: 'buyin', amount: a.amount, at: now() }],
        stackChips: null, cashOutChips: null, leftEarly: false,
      };
      const seats = placed ? cur.map((s, i) => ({ ...s, pos: prev[i] })) : cur;
      return { ...state, players, activeGame: { ...state.activeGame, seats: [...seats, seat] } };
    }
    case 'SET_PLAYER_PHONE': { // remembered for next time; clearing it also forgets the linked account
      const pl = state.players[a.playerId]; if (!pl) return state;
      const players = { ...state.players, [pl.id]: { ...pl, phone: a.phone || null, ...(a.phone ? {} : { userId: null }) } };
      const g = state.activeGame;
      const activeGame = g && !a.phone ? { ...g, seats: g.seats.map((x) => (x.playerId === pl.id ? { ...x, userId: null, phoneHash: null, linkState: null } : x)) } : g;
      return { ...state, players, activeGame };
    }
    case 'SET_SEAT_USER': { // a seat now belongs to a registered account (or the admin said "not them")
      const g = state.activeGame; if (!g) return state;
      const seat = g.seats.find((x) => x.id === a.seatId); if (!seat) return state;
      const players = a.userId && state.players[seat.playerId]
        ? { ...state.players, [seat.playerId]: { ...state.players[seat.playerId], userId: a.userId, ...(a.avatar !== undefined ? { avatar: a.avatar } : {}) } }
        : state.players;
      return { ...state, players, activeGame: { ...g, seats: g.seats.map((x) => (x.id === a.seatId ? {
        ...x, linkState: a.linkState ?? (a.userId ? 'linked' : 'none'), userId: a.userId || null, phoneHash: a.phoneHash ?? x.phoneHash ?? null,
        pending: a.pending ?? null,
        ...(a.userId && a.avatar !== undefined ? { avatar: a.avatar, glow: a.glow || '', lookFrom: 'user', userName: a.userName || '' } : {}),
        ...(a.invited ? { invited: true } : {}),
      } : x)) } };
    }
    case 'SET_AVATAR': {
      // Change a seated player's character (also remembered for next games).
      const seat = state.activeGame?.seats.find((s) => s.id === a.seatId);
      if (!seat) return state;
      const pl = state.players[seat.playerId];
      return {
        ...state,
        players: pl ? { ...state.players, [pl.id]: { ...pl, avatar: a.avatar } } : state.players,
        activeGame: { ...state.activeGame, seats: state.activeGame.seats.map((s) => (s.id === a.seatId ? { ...s, avatar: a.avatar } : s)) },
      };
    }
    case 'SET_SEAT_LOOK': {
      // A signed-in player's own character + glow colour (from their profile), applied to their seat.
      if (!state.activeGame) return state;
      return { ...state, activeGame: { ...state.activeGame, seats: state.activeGame.seats.map((s2) => (s2.id === a.seatId
        ? { ...s2, ...(a.avatar !== undefined ? { avatar: a.avatar } : {}), glow: a.glow || '', lookFrom: 'profile' } : s2)) } };
    }
    case 'SET_POSITIONS':
      // Drag & drop: { [seatId]: t } for every seat.
      return { ...state, activeGame: { ...state.activeGame, seats: state.activeGame.seats.map((s) => ({ ...s, pos: a.positions[s.id] ?? s.pos ?? null })) } };
    case 'DELETE_GAME':
      return { ...state, history: state.history.filter((h) => h.id !== a.id) };
    case 'DELETE_GAMES': {
      const ids = new Set(a.ids);
      return { ...state, history: state.history.filter((h) => !ids.has(h.id)) };
    }
    case 'ADD_BUYIN':
      return updateSeat(state, a.seatId, (s) => ({ ...s, transactions: [...s.transactions, { id: uid(), type: 'rebuy', amount: a.amount, at: now() }] }));
    case 'REMOVE_TXN':
      return updateSeat(state, a.seatId, (s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== a.txnId) }));
    case 'SET_STACK':
      return updateSeat(state, a.seatId, (s) => ({ ...s, stackChips: a.chips }));
    case 'LEAVE_EARLY':
      return updateSeat(state, a.seatId, (s) => ({ ...s, cashOutChips: a.chips, leftEarly: true, leftAt: s.leftAt || now() }));
    case 'UNDO_LEAVE':
      return updateSeat(state, a.seatId, (s) => ({ ...s, cashOutChips: null, leftEarly: false }));
    case 'SET_COUNT':
      return updateSeat(state, a.seatId, (s) => ({ ...s, cashOutChips: a.chips }));
    case 'LINK_SEATS': { // a.seatId joins a.withId's shared wallet (or both start a new one)
      const g = state.activeGame; if (!g) return state;
      const other = g.seats.find((x) => x.id === a.withId);
      const linkId = other?.link || uid();
      return { ...state, activeGame: { ...g, seats: g.seats.map((x) => (x.id === a.seatId || x.id === a.withId ? { ...x, link: linkId } : x)) } };
    }
    case 'UNLINK_SEAT': {
      const g = state.activeGame; if (!g) return state;
      const me = g.seats.find((x) => x.id === a.seatId);
      let seats = g.seats.map((x) => (x.id === a.seatId ? { ...x, link: null } : x));
      // a wallet of one isn't a wallet
      const left = seats.filter((x) => me?.link && x.link === me.link);
      if (left.length === 1) seats = seats.map((x) => (x.id === left[0].id ? { ...x, link: null } : x));
      return { ...state, activeGame: { ...g, seats } };
    }
    case 'ADD_EXPENSE': { // a.expense: { kind, label, amount, paidBy: seatId, split: seatId[] }
      const g = state.activeGame; if (!g) return state;
      const e = { id: uid(), at: now(), ...a.expense, amount: Math.round(Number(a.expense.amount) * 100) / 100 };
      return { ...state, activeGame: { ...g, expenses: [...(g.expenses || []), e] } };
    }
    case 'REMOVE_EXPENSE': {
      const g = state.activeGame; if (!g) return state;
      return { ...state, activeGame: { ...g, expenses: (g.expenses || []).filter((e) => e.id !== a.id) } };
    }
    case 'FILL_ZERO': // every chip is already accounted for: whoever wasn't counted left with nothing
      return state.activeGame ? { ...state, activeGame: { ...state.activeGame, seats: state.activeGame.seats.map((s) => (s.cashOutChips === null || s.cashOutChips === undefined || s.cashOutChips === '' ? { ...s, cashOutChips: 0 } : s)) } } : state;
    case 'REMOVE_PLAYER':
      return { ...state, activeGame: { ...state.activeGame, seats: state.activeGame.seats.filter((s) => s.id !== a.seatId) } };
    case 'SET_PHASE': {
      let seats = state.activeGame.seats;
      if (a.phase === 'cashout') seats = seats.map((s) => (s.cashOutChips === null && s.stackChips !== null ? { ...s, cashOutChips: s.stackChips } : s));
      return { ...state, activeGame: { ...state.activeGame, phase: a.phase, seats } };
    }
    case 'FINISH': {
      const rec = a.record;
      let tables = state.tables || {};
      const t = rec.tableId && tables[rec.tableId];
      if (t) {
        tables = { ...tables, [t.id]: {
          ...t, lastPlayed: rec.endedAt, felt: rec.felt || t.felt,
          playerIds: [...new Set([...rec.results.map((r) => r.playerId), ...t.playerIds])],
        } };
      }
      return { ...state, tables, activeGame: null, history: [rec, ...state.history] };
    }
    case 'RESTORE_GAME': {
      // a.game: a whole game (undo, or a backup restored from the cloud). Re-creates missing players/table.
      const g = a.game;
      if (!g) return { ...state, activeGame: null };
      const players = { ...state.players };
      (g.seats || []).forEach((st) => { if (st.playerId && !players[st.playerId]) players[st.playerId] = { id: st.playerId, name: st.name, avatar: st.avatar ?? 0, createdAt: now() }; });
      let tables = state.tables || {};
      if (g.tableId && !tables[g.tableId]) tables = { ...tables, [g.tableId]: { id: g.tableId, name: g.name || 'השולחן שלי', felt: g.felt || 'green', cloudId: g.groupId || null, playerIds: [], createdAt: now(), lastPlayed: now() } };
      return { ...state, players, tables, activeGame: g };
    }
    case 'SET_PAID': {
      if (!state.activeGame) return state;
      const paid = { ...(state.activeGame.paid || {}) };
      if (a.on) paid[a.key] = true; else delete paid[a.key];
      return { ...state, activeGame: { ...state.activeGame, paid } };
    }
    case 'DISCARD':
      return { ...state, activeGame: null };
    default:
      return state;
  }
}

export function useAppState() {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  const [storageOk, setStorageOk] = useState(true);
  useEffect(() => { setStorageOk(save(state)); }, [state]);
  return [state, dispatch, storageOk];
}

/* ---------- selectors + settlement (pure) ---------- */
/** Seat's chip colour (older saved games have none: fall back to its position). */
export const seatChip = (seat, i) => seat.chip ?? i;
export function seatInfo(seat, ratio) {
  const buyInC = seat.transactions.reduce((sum, t) => sum + toCents(t.amount), 0);
  const boughtChips = seat.transactions.reduce((sum, t) => sum + Number(t.amount) * ratio, 0);
  const counted = seat.cashOutChips !== null;
  const cashOutC = counted ? toCents(seat.cashOutChips / ratio) : 0;
  return {
    buyIn: fromCents(buyInC), buyInC, boughtChips, counted, cashOutC,
    cashOut: counted ? fromCents(cashOutC) : null,
    netC: counted ? cashOutC - buyInC : null,
    rebuys: seat.transactions.length - 1,
    stackChips: seat.stackChips,
    shownChips: counted ? seat.cashOutChips : seat.stackChips ?? boughtChips,
  };
}

/** Zero-sum: chips counted must equal chips bought (compared in chips — exact). */
export function validateZeroSum(game) {
  const r = game.chipsPerUnit;
  const rows = game.seats.map((seat, i) => ({ seat, i, ...seatInfo(seat, r) }));
  const boughtChips = rows.reduce((a, x) => a + x.boughtChips, 0);
  const countedChips = rows.reduce((a, x) => a + (x.counted ? Number(x.seat.cashOutChips) : 0), 0);
  const missing = rows.filter((x) => !x.counted).map((x) => x.seat.name);
  const diffChips = Math.round((countedChips - boughtChips) * 1000) / 1000;
  return {
    rows, boughtChips, countedChips, missing, diffChips,
    diffMoney: diffChips / r,
    totalBuyIn: fromCents(rows.reduce((a, x) => a + x.buyInC, 0)),
    balanced: rows.length > 0 && missing.length === 0 && Math.abs(diffChips) < 1e-6,
  };
}

/** Nets in cents; any rounding residue (odd ratios) goes to the largest |net|. */
export function computeNets(v) {
  const nets = v.rows.map((x, i) => ({ playerId: x.seat.playerId, name: x.seat.name, avatar: x.seat.avatar, chip: x.seat.chip ?? i, netC: x.netC ?? 0, link: x.seat.link || null }));
  const residue = nets.reduce((a, n) => a + n.netC, 0);
  if (residue !== 0 && nets.length) {
    const big = nets.reduce((m, n) => (Math.abs(n.netC) > Math.abs(m.netC) ? n : m), nets[0]);
    big.netC -= residue;
  }
  return nets;
}

/** Greedy: biggest loser pays biggest winner, repeat until everyone is at zero. */
/**
 * Shared expenses (pizza, drinks…): whoever paid is owed the amount; everyone it's split between owes
 * an equal share. Returns { [seatId]: cents } (positive = owed money). Rounding remainder stays with the payer.
 */
export function expenseBalances(game) {
  const bal = {};
  for (const e of game?.expenses || []) {
    const split = (e.split?.length ? e.split : game.seats.map((s) => s.id)).filter((id) => game.seats.some((s) => s.id === id));
    if (!split.length || !e.paidBy) continue;
    const total = toCents(e.amount);
    const share = Math.floor(total / split.length);
    bal[e.paidBy] = (bal[e.paidBy] || 0) + total;
    split.forEach((id) => { bal[id] = (bal[id] || 0) - share; });
    bal[e.paidBy] -= total - share * split.length; // remainder: the payer covers it
  }
  return bal;
}

/** Poker nets + shared expenses, for working out the transfers (stats keep using poker nets only). */
export function withExpenses(nets, game) {
  const bal = expenseBalances(game);
  if (!Object.keys(bal).length) return nets;
  return nets.map((n, i) => ({ ...n, netC: n.netC + (bal[game.seats[i]?.id] || 0), expC: bal[game.seats[i]?.id] || 0 }));
}

/**
 * Couples mode: players who share a wallet keep their own seat, buy-ins, cash-out and stats, but for
 * paying up they are ONE entity. Their nets are summed before settling, so the pair never pays one
 * another and the table needs the fewest transfers. The entity pays/receives under the first member's id.
 */
export function mergeLinked(nets) {
  const out = [];
  const byLink = new Map();
  for (const n of nets) {
    if (!n.link) { out.push({ ...n, members: [n.name] }); continue; }
    const e = byLink.get(n.link);
    if (!e) { const ent = { ...n, members: [n.name] }; byLink.set(n.link, ent); out.push(ent); }
    else { e.netC += n.netC; e.members.push(n.name); }
  }
  for (const e of byLink.values()) e.name = e.members.join(' & ');
  return out;
}

export function computeSettlements(rawNets) {
  const nets = mergeLinked(rawNets);
  const debtors = nets.filter((n) => n.netC < 0).map((n) => ({ ...n, bal: -n.netC }));
  const creditors = nets.filter((n) => n.netC > 0).map((n) => ({ ...n, bal: n.netC }));
  const out = [];
  while (debtors.length && creditors.length) {
    debtors.sort((a, b) => b.bal - a.bal);
    creditors.sort((a, b) => b.bal - a.bal);
    const d = debtors[0], c = creditors[0];
    const pay = Math.min(d.bal, c.bal);
    out.push({ fromId: d.playerId, from: d.name, fromAvatar: d.avatar, fromChip: d.chip, toId: c.playerId, to: c.name, toAvatar: c.avatar, toChip: c.chip, amount: fromCents(pay), ...(d.members.length > 1 ? { fromMembers: d.members } : {}), ...(c.members.length > 1 ? { toMembers: c.members } : {}) });
    d.bal -= pay; c.bal -= pay;
    if (d.bal === 0) debtors.shift();
    if (c.bal === 0) creditors.shift();
  }
  return out;
}

/** How many buy-ins a player has made, measured in the game's entry size (150₪ at 50₪ a seat = 3). */
export function entriesOf(buyIn, entry) {
  if (!(entry > 0)) return 0;
  return Math.round((Number(buyIn) / entry) * 10) / 10;
}
/** The game's entry size (games saved before it was stored fall back to the current setting). */
export const gameEntry = (game, settings) => Number(game?.entry) || Number(settings?.defaultBuyIn) || 0;

/** Most invested first (total buy-in, then number of entries). */
export const byInvested = (rows) => [...rows].sort((a, b) => b.buyInC - a.buyInC || b.rebuys - a.rebuys);

/** Lifetime numbers per player, from saved games. */
export function computePlayerStats(history) {
  const stats = {};
  for (const g of history) {
    for (const r of g.results) {
      const s = (stats[r.playerId] ||= { playerId: r.playerId, name: r.name, games: 0, netC: 0, bestC: 0, worstC: 0, wins: 0 });
      const n = toCents(r.net);
      s.games += 1; s.netC += n; s.bestC = Math.max(s.bestC, n); s.worstC = Math.min(s.worstC, n);
      if (n > 0) s.wins += 1;
      s.name = r.name;
    }
  }
  return Object.values(stats)
    .map((s) => ({ ...s, net: fromCents(s.netC), best: fromCents(s.bestC), worst: fromCents(s.worstC) }))
    .sort((a, b) => b.netC - a.netC);
}
