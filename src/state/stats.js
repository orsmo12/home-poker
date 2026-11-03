/* Personal stats engine (pure functions, works offline).
 *
 * Input: every night we know about — this device's history plus, when signed in, every night at
 * every cloud table I belong to — normalised to one shape. "Me" = the names I play under.
 * Everything is recomputed from scratch on each filter change; it's a few hundred nights at most.
 */

const lc = (s) => String(s || '').trim().toLowerCase();

/** Unified night: { id, tableKey, tableName, felt, endedAt, results:[{name, net, buyIn}], settlements:[{from,to,amount}], pot } */
export function buildNights({ history, tables, cloudGames, cloudPlayers, cloudGroups }) {
  const byId = new Map();
  const tableOfCloud = new Map(Object.values(tables || {}).filter((t) => t.cloudId).map((t) => [t.cloudId, t]));

  for (const h of history || []) {
    if (h.type !== 'cash') continue;
    const t = tables?.[h.tableId];
    byId.set(h.id, {
      id: h.id, tableKey: h.tableId || 'home', tableName: t?.name || h.name || 'השולחן שלי', felt: t?.felt || h.felt || 'green',
      endedAt: h.endedAt,
      results: h.results.map((r) => ({ name: r.name, net: Number(r.net) || 0, buyIn: Number(r.buyIn) || 0 })),
      settlements: (h.settlements || []).map((s) => ({ from: s.from, to: s.to, amount: Number(s.amount) || 0, fromMembers: s.fromMembers, toMembers: s.toMembers })),
    });
  }

  if (cloudGames?.length) {
    const pname = new Map((cloudPlayers || []).map((p) => [p.id, p.name]));
    const gname = new Map((cloudGroups || []).map((g) => [g.id, g]));
    for (const g of cloudGames) {
      if (byId.has(g.id)) continue; // this device's own copy wins
      const local = tableOfCloud.get(g.group_id);
      byId.set(g.id, {
        id: g.id, tableKey: local?.id || `cloud:${g.group_id}`, tableName: local?.name || gname.get(g.group_id)?.name || 'שולחן',
        felt: local?.felt || gname.get(g.group_id)?.felt || 'green', endedAt: g.ended_at,
        results: (g.game_results || []).map((r) => ({ name: pname.get(r.player_id) || '?', net: Number(r.net) || 0, buyIn: Number(r.buy_in) || 0 })),
        settlements: (g.settlements || []).map((s) => ({ from: pname.get(s.from_player) || '?', to: pname.get(s.to_player) || '?', amount: Number(s.amount) || 0 })),
      });
    }
  }

  return [...byId.values()]
    .map((n) => ({ ...n, pot: n.results.reduce((a, r) => a + r.buyIn, 0) }))
    .sort((a, b) => String(a.endedAt).localeCompare(String(b.endedAt)));
}

/** Names that look like "me": the most frequent player on this device is usually the owner. */
export function suggestMe(nights, extra = []) {
  const count = new Map();
  nights.forEach((n) => n.results.forEach((r) => count.set(r.name, (count.get(r.name) || 0) + 1)));
  const first = extra.map((x) => lc(x).split(' ')[0]).filter(Boolean);
  return [...count.entries()]
    .sort((a, b) => (first.includes(lc(b[0])) - first.includes(lc(a[0]))) || b[1] - a[1])
    .map(([name, games]) => ({ name, games }));
}

const overlapLevel = (n) => (n >= 12 ? 5 : n >= 7 ? 4 : n >= 4 ? 3 : n >= 2 ? 2 : n >= 1 ? 1 : 0);

/**
 * @param nights   from buildNights
 * @param meNames  array of my names
 * @param filters  { offTables: Set<tableKey>, withPlayers: Set<lcName> }  (withPlayers empty = all)
 */
export function computeDashboard(nights, meNames, filters = {}) {
  const me = new Set((meNames || []).map(lc));
  const offTables = filters.offTables || new Set();
  const withPlayers = filters.withPlayers || new Set();

  // every table / opponent that exists in my nights (for the filter pills), before filtering
  const mine = nights.filter((n) => n.results.some((r) => me.has(lc(r.name))));
  const tableMap = new Map();
  const oppCount = new Map();
  mine.forEach((n) => {
    const t = tableMap.get(n.tableKey) || { key: n.tableKey, name: n.tableName, felt: n.felt, games: 0 };
    t.games += 1; tableMap.set(n.tableKey, t);
    n.results.forEach((r) => { if (!me.has(lc(r.name))) oppCount.set(r.name, (oppCount.get(r.name) || 0) + 1); });
  });

  const used = mine.filter((n) => !offTables.has(n.tableKey)
    && (withPlayers.size === 0 || n.results.some((r) => withPlayers.has(lc(r.name)))));

  // timeline
  let cum = 0, best = null, worst = null, biggestPot = null, maxBuyIn = null;
  let streak = 0, bestStreak = 0, worstStreak = 0, wins = 0, totalIn = 0;
  const series = used.map((n) => {
    const my = n.results.find((r) => me.has(lc(r.name)));
    cum += my.net; totalIn += my.buyIn;
    if (my.net > 0) wins += 1;
    if (!best || my.net > best.net) best = { net: my.net, night: n };
    if (!worst || my.net < worst.net) worst = { net: my.net, night: n };
    if (!biggestPot || n.pot > biggestPot.pot) biggestPot = { pot: n.pot, night: n, net: my.net };
    if (!maxBuyIn || my.buyIn > maxBuyIn.buyIn) maxBuyIn = { buyIn: my.buyIn, night: n };
    streak = my.net > 0 ? Math.max(1, streak + 1) : my.net < 0 ? Math.min(-1, streak - 1) : 0;
    bestStreak = Math.max(bestStreak, streak); worstStreak = Math.min(worstStreak, streak);
    return { id: n.id, at: n.endedAt, net: my.net, cum, table: n.tableName };
  });

  // head-to-head
  const h2h = new Map();
  used.forEach((n) => {
    const my = n.results.find((r) => me.has(lc(r.name)));
    n.results.forEach((r) => {
      if (me.has(lc(r.name))) return;
      const o = h2h.get(lc(r.name)) || { name: r.name, shared: 0, transfers: 0, myNetWith: 0, theirNet: 0, beatMe: 0 };
      o.shared += 1; o.myNetWith += my.net; o.theirNet += r.net; if (r.net > my.net) o.beatMe += 1;
      h2h.set(lc(r.name), o);
    });
    n.settlements.forEach((s) => {
      // a shared wallet ("Danny & Dana") pays as one; split the money evenly between its members
      const F = (s.fromMembers || [s.from]).map(lc), T = (s.toMembers || [s.to]).map(lc);
      const share = s.amount / (F.length * T.length);
      F.forEach((f) => T.forEach((t) => {
        if (me.has(t) && h2h.has(f)) h2h.get(f).transfers += share;   // they paid me
        if (me.has(f) && h2h.has(t)) h2h.get(t).transfers -= share;   // I paid them
      }));
    });
  });
  const opponents = [...h2h.values()].map((o) => ({ ...o, overlap: overlapLevel(o.shared), tags: [] }))
    .sort((a, b) => b.shared - a.shared || Math.abs(b.transfers) - Math.abs(a.transfers));

  // smart tags
  const tag = (o, t) => o && o.tags.length < 2 && !o.tags.some((x) => x.id === t.id) && o.tags.push(t);
  const atm = [...opponents].filter((o) => o.transfers > 0).sort((a, b) => b.transfers - a.transfers)[0];
  const krypto = [...opponents].filter((o) => o.transfers < 0).sort((a, b) => a.transfers - b.transfers)[0];
  const rival = opponents.filter((o) => o.shared >= 3)[0];
  const shark = [...opponents].filter((o) => o.shared >= 2 && o.theirNet > 0).sort((a, b) => b.theirNet - a.theirNet)[0];
  const charm = [...opponents].filter((o) => o.shared >= 3 && o.myNetWith > 0 && o !== atm && o !== krypto).sort((a, b) => b.myNetWith / b.shared - a.myNetWith / a.shared)[0];
  tag(atm, { id: 'atm', label: 'הכספומט שלך', emoji: '🏧', tone: 'emerald' });
  tag(krypto, { id: 'krypto', label: 'קריפטונייט', emoji: '🧪', tone: 'rose' });
  tag(shark, { id: 'shark', label: 'הכריש', emoji: '🦈', tone: 'cyan' });
  tag(rival, { id: 'rival', label: 'היריב הקבוע', emoji: '⚔️', tone: 'amber' });
  tag(charm, { id: 'charm', label: 'קמע מזל', emoji: '🍀', tone: 'emerald' });

  const games = series.length;
  return {
    tables: [...tableMap.values()].sort((a, b) => b.games - a.games),
    players: [...oppCount.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, games: n })),
    series,
    totals: {
      games, net: cum, wins, winRate: games ? wins / games : 0, avg: games ? cum / games : 0,
      roi: totalIn > 0 ? cum / totalIn : 0, totalIn, streakNow: streak,
    },
    records: { best, worst, biggestPot, maxBuyIn, bestStreak, worstStreak: -worstStreak },
    opponents,
  };
}
