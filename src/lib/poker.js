/* Texas Hold'em hand evaluator + Monte Carlo equity.
 * card = 0..51, rank = c >> 2 (0 = '2' … 12 = 'A'), suit = c & 3  (♠ ♥ ♦ ♣) */
export const RANK_CH = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const SUIT_CH = ['♠', '♥', '♦', '♣'];
export const RED = [false, true, true, false];
export const HAND_NAMES = ['קלף גבוה', 'זוג', 'שני זוגות', 'שלישייה', 'רצף', 'צבע', 'פול האוס', 'רביעייה', 'רצף צבע'];
const P5 = [28561, 2197, 169, 13, 1]; // 13^4..13^0

const _rc = new Int8Array(13);
const _sc = new Int8Array(4);
const _sm = new Int32Array(4);

function straightHigh(m) {
  for (let hi = 12; hi >= 4; hi--) if (((m >> (hi - 4)) & 31) === 31) return hi;
  if ((m & 0x100f) === 0x100f) return 3; // A-2-3-4-5
  return -1;
}
function score(cat, arr) {
  let s = cat * 371293; // 13^5
  for (let i = 0; i < arr.length; i++) s += arr[i] * P5[i];
  return s;
}
export function evaluate(cards, n) {
  _rc.fill(0); _sc.fill(0); _sm.fill(0);
  let mask = 0;
  for (let i = 0; i < n; i++) {
    const c = cards[i], r = c >> 2, s = c & 3;
    _rc[r]++; _sc[s]++; _sm[s] |= 1 << r; mask |= 1 << r;
  }
  let fs = -1;
  for (let s = 0; s < 4; s++) if (_sc[s] >= 5) fs = s;
  if (fs >= 0) { const sf = straightHigh(_sm[fs]); if (sf >= 0) return score(8, [sf]); }
  let quad = -1; const trips = [], pairs = [];
  for (let r = 12; r >= 0; r--) {
    if (_rc[r] === 4) quad = r; else if (_rc[r] === 3) trips.push(r); else if (_rc[r] === 2) pairs.push(r);
  }
  const kick = (excl, k) => { const o = []; for (let r = 12; r >= 0 && o.length < k; r--) if (_rc[r] && !excl.includes(r)) o.push(r); return o; };
  if (quad >= 0) return score(7, [quad, ...kick([quad], 1)]);
  if (trips.length && (trips.length > 1 || pairs.length)) return score(6, [trips[0], Math.max(trips[1] ?? -1, pairs[0] ?? -1)]);
  if (fs >= 0) { const o = []; for (let r = 12; r >= 0 && o.length < 5; r--) if (_sm[fs] & (1 << r)) o.push(r); return score(5, o); }
  const st = straightHigh(mask);
  if (st >= 0) return score(4, [st]);
  if (trips.length) return score(3, [trips[0], ...kick([trips[0]], 2)]);
  if (pairs.length >= 2) return score(2, [pairs[0], pairs[1], ...kick([pairs[0], pairs[1]], 1)]);
  if (pairs.length) return score(1, [pairs[0], ...kick([pairs[0]], 3)]);
  return score(0, kick([], 5));
}
export const categoryOf = (s) => Math.floor(s / 371293);

export function handName(cards) {
  const s = evaluate(cards, cards.length);
  const cat = categoryOf(s);
  if (cat === 8 && Math.floor((s % 371293) / P5[0]) === 12) return 'רויאל פלאש';
  return HAND_NAMES[cat];
}

/** Runs `iters` random deals, accumulating into acc. */
export function simulate(hands, board, iters, acc) {
  const used = new Set([...hands.flat(), ...board].filter((c) => c !== null));
  const deck = []; for (let c = 0; c < 52; c++) if (!used.has(c)) deck.push(c);
  const unknown = hands.flat().filter((c) => c === null).length + board.filter((c) => c === null).length;
  const n = hands.length;
  const b = new Array(5), h = new Array(7), scores = new Array(n);
  for (let it = 0; it < iters; it++) {
    for (let k = 0; k < unknown; k++) {
      const j = k + Math.floor(Math.random() * (deck.length - k));
      const t = deck[k]; deck[k] = deck[j]; deck[j] = t;
    }
    let d = 0;
    for (let i = 0; i < 5; i++) b[i] = board[i] === null ? deck[d++] : board[i];
    let best = -1, nBest = 0;
    for (let p = 0; p < n; p++) {
      h[0] = hands[p][0] === null ? deck[d++] : hands[p][0];
      h[1] = hands[p][1] === null ? deck[d++] : hands[p][1];
      for (let i = 0; i < 5; i++) h[i + 2] = b[i];
      const s = evaluate(h, 7);
      scores[p] = s;
      if (s > best) { best = s; nBest = 1; } else if (s === best) nBest++;
    }
    for (let p = 0; p < n; p++) {
      if (scores[p] === best) {
        if (nBest === 1) acc.win[p]++; else acc.tie[p]++;
        acc.equity[p] += 1 / nBest;
      }
    }
    acc.heroCat[categoryOf(scores[0])]++;
    acc.done++;
  }
  return unknown;
}


export const SUIT_NAMES = ['ספייד', 'לב', 'יהלום', 'תלתן'];
export const cardId = (rank, suit) => rank * 4 + suit;
