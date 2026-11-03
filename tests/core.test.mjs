// Unit tests for the money maths and the hand evaluator. Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateZeroSum, computeNets, computeSettlements, withExpenses, expenseBalances, entriesOf } from '../src/state/store.js';
import { buildNights, computeDashboard } from '../src/state/stats.js';
import { cardId, handName, simulate } from '../src/lib/poker.js';
import { normalizePhone } from '../src/lib/phone.js';

const seat = (i, name, buyIn, chipsOut, extra = {}) => ({
  id: `s${i}`, playerId: `p${i}`, name, avatar: 0, chip: i,
  transactions: [{ id: `t${i}`, type: 'buyin', amount: buyIn }],
  stackChips: null, cashOutChips: chipsOut, leftEarly: false, ...extra,
});
const game = (seats, extra = {}) => ({ chipsPerUnit: 10, seats, ...extra }); // 100₪ = 1,000 chips
const transfers = (g) => computeSettlements(withExpenses(computeNets(validateZeroSum(g)), g)).map((t) => `${t.from}>${t.to}:${t.amount}`);
const totalOf = (list) => list.reduce((a, t) => a + t.amount, 0);

test('zero-sum check: chips counted must equal chips bought', () => {
  assert.equal(validateZeroSum(game([seat(0, 'A', 100, 1500), seat(1, 'B', 100, 500)])).balanced, true);
  const off = validateZeroSum(game([seat(0, 'A', 100, 1500), seat(1, 'B', 100, 400)]));
  assert.equal(off.balanced, false);
  assert.equal(off.diffChips, -100);
});

test('settlement: losers pay winners, everything sums to zero', () => {
  const g = game([seat(0, 'A', 100, 2600), seat(1, 'B', 300, 1400), seat(2, 'C', 100, 1000)]);
  assert.deepEqual(transfers(g), ['B>A:160']);
});

test('settlement: at most n-1 transfers', () => {
  const g = game([seat(0, 'A', 100, 3000), seat(1, 'B', 100, 0), seat(2, 'C', 100, 0), seat(3, 'D', 100, 1000), seat(4, 'E', 100, 1000)]);
  const t = computeSettlements(computeNets(validateZeroSum(g)));
  assert.ok(t.length <= 4);
  assert.equal(totalOf(t), 200);
});

test('couples mode: linked seats settle as one wallet and never pay each other', () => {
  const g = game([seat(0, 'Danny', 200, 0, { link: 'L' }), seat(1, 'Dana', 100, 2500, { link: 'L' }), seat(2, 'Yossi', 100, 500), seat(3, 'Ron', 100, 2000)]);
  const t = transfers(g);
  assert.ok(!t.some((x) => x.startsWith('Danny>Dana') || x.startsWith('Dana>Danny')));
  assert.deepEqual(t.sort(), ['Danny & Dana>Ron:50', 'Yossi>Ron:50']);
});

test('shared expenses: payer is owed, the rest split it (stats keep poker-only nets)', () => {
  const g = game([seat(0, 'A', 100, 1000), seat(1, 'B', 100, 1000), seat(2, 'C', 100, 1000)], {
    expenses: [{ id: 'e1', amount: 90, paidBy: 's0', split: [] }, { id: 'e2', amount: 30, paidBy: 's1', split: ['s1', 's2'] }],
  });
  assert.deepEqual(expenseBalances(g), { s0: 6000, s1: -1500, s2: -4500 });
  assert.deepEqual(transfers(g).sort(), ['B>A:15', 'C>A:45']);
  assert.ok(computeNets(validateZeroSum(g)).every((n) => n.netC === 0)); // poker result unchanged
});

test('entries: buy-ins measured in entry size', () => {
  assert.equal(entriesOf(150, 50), 3);
  assert.equal(entriesOf(100, 0), 0);
});

test('dashboard: totals, records and head-to-head', () => {
  const night = (id, at, results, settlements = []) => ({ id, type: 'cash', endedAt: at, tableId: 't', results, settlements });
  const history = [
    night('g2', '2026-10-02', [{ name: 'Or', net: -50, buyIn: 100 }, { name: 'Dan', net: 50, buyIn: 100 }], [{ from: 'Or', to: 'Dan', amount: 50 }]),
    night('g1', '2026-10-01', [{ name: 'Or', net: 150, buyIn: 100 }, { name: 'Dan', net: -150, buyIn: 200 }], [{ from: 'Dan', to: 'Or', amount: 150 }]),
  ];
  const d = computeDashboard(buildNights({ history, tables: { t: { id: 't', name: 'Home' } } }), ['Or']);
  assert.equal(d.totals.games, 2);
  assert.equal(d.totals.net, 100);
  assert.equal(d.records.best.net, 150);
  assert.equal(d.opponents[0].name, 'Dan');
  assert.equal(d.opponents[0].transfers, 100);
});

test('poker: hand names and a sane equity for AA vs KK', () => {
  const A = 12, K = 11; // rank index: 0 = 2 … 12 = A; suits 0..3
  assert.equal(handName([cardId(A, 0), cardId(A, 1), cardId(K, 0), cardId(K, 1), cardId(2, 2)]), 'שני זוגות');
  const acc = { win: [0, 0], tie: [0, 0], equity: [0, 0], heroCat: new Array(10).fill(0), done: 0 };
  simulate([[cardId(A, 0), cardId(A, 1)], [cardId(K, 2), cardId(K, 3)]], [null, null, null, null, null], 20000, acc);
  const eq = acc.equity[0] / acc.done;
  assert.ok(eq > 0.78 && eq < 0.85, `AA vs KK equity ${eq}`);
});

test('phone numbers normalise to E.164 (Israel by default)', () => {
  assert.equal(normalizePhone('050-123 4567'), '+972501234567');
  assert.equal(normalizePhone('+972 52-333-4444'), '+972523334444');
  assert.equal(normalizePhone('03-1234567'), '+97231234567');
  assert.equal(normalizePhone('12'), null);
});
