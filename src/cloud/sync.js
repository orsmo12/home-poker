/* History → cloud sync.
 *
 * There is no separate queue: the local history IS the outbox. A saved night is pending when
 *  - it was saved while signed in (`cloud: true`) and belongs to a table, or
 *  - it is an older night explicitly attached to a cloud group (`groupId`),
 * and it has no `syncedAt` yet. Nights are immutable once saved and the server RPC is idempotent
 * (keyed by the game id), so retrying is always safe.
 *
 * A table that exists only on this device gets its cloud twin created on first sync.
 */
import { isTransient } from './client';
import { hashPhone } from '../lib/phone';

export const pendingGames = (history) => history.filter((h) =>
  h.type === 'cash' && !h.syncedAt && !h.syncError && (h.groupId || (h.cloud && h.tableId)));

export function toGamePayload(record, groupId, currency) {
  return {
    id: record.id,
    group_id: groupId,
    started_at: record.startedAt,
    ended_at: record.endedAt,
    chips_per_unit: record.chipsPerUnit,
    currency,
    results: record.results.map((r) => ({
      key: r.playerId, name: r.name, avatar: r.avatar ?? 0,
      buy_in: r.buyIn, cash_out: r.cashOut, net: r.net,
    })),
    settlements: (record.settlements || []).map((s) => ({ from_key: s.fromId, to_key: s.toId, amount: s.amount })),
  };
}

/**
 * Push every pending night. Stops quietly at the first network problem (we retry on the next
 * 'online' / app open). Permanent errors are reported per night.
 * @param ensureTable async (tableId) => cloudGroupId   creates the table in the cloud if needed
 */
export async function pushPending(client, history, tables, currency, { onSynced, onFailed, ensureTable } = {}) {
  const out = { synced: [], failed: [], stopped: false, groups: new Set() };
  const made = {};
  for (const rec of pendingGames(history)) {
    try {
      let gid = rec.groupId || tables?.[rec.tableId]?.cloudId || made[rec.tableId];
      if (!gid && ensureTable) { gid = await ensureTable(rec.tableId); made[rec.tableId] = gid; }
      if (!gid) throw new Error('no table');
      const { error } = await client.rpc('record_game', { p: toGamePayload(rec, gid, currency) });
      if (error) throw error;
      out.synced.push(rec.id); out.groups.add(gid);
      // players saved with a phone: link registered ones to their account, remember the rest for later
      for (const r of rec.results) {
        const hash = r.phoneHash || (r.phone ? await hashPhone(r.phone) : null);
        if (hash) await client.rpc('link_player', { p_group: gid, p_name: r.name, p_hash: hash, p_user: r.userId || null }).then(() => {}, () => {});
      }
      onSynced?.(rec.id, gid);
    } catch (error) {
      if (isTransient(error)) { out.stopped = true; break; }
      out.failed.push({ id: rec.id, error });
      onFailed?.(rec.id, error);
    }
  }
  return out;
}
