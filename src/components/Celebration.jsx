/* End-of-night moment: the winner, the podium and any record that fell. Shareable in one tap. */
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Crown, Share2, X } from 'lucide-react';
import { ChipAvatar } from './Avatar';
import { M } from './ui';
import { numFmt } from '../state/store';
import { APP_URL, track } from '../lib/analytics';

const potOf = (h) => h.results.reduce((a, r) => a + (Number(r.buyIn) || 0), 0);
const CONFETTI = ['#34d399', '#fbbf24', '#f472b6', '#60a5fa', '#fb7185', '#a78bfa'];

export function Celebration({ record, history, players, cur, onClose }) {
  const ranked = [...record.results].sort((a, b) => b.net - a.net);
  const winner = ranked[0];
  const pot = potOf(record);
  const looks = (r) => ({ avatar: players?.[r.playerId]?.avatar ?? r.avatar ?? 0 });

  const badges = useMemo(() => {
    const out = [];
    const past = (history || []).filter((h) => h.type === 'cash');
    if (!winner || winner.net <= 0) return out;
    const bestEver = Math.max(0, ...past.flatMap((h) => h.results.map((r) => Number(r.net) || 0)));
    if (past.length && winner.net > bestEver) out.push({ e: '🏆', t: 'הניצחון הכי גדול אי פעם' });
    const bigPot = Math.max(0, ...past.map(potOf));
    if (past.length && pot > bigPot) out.push({ e: '💰', t: 'הקופה הכי גדולה אי פעם' });
    const sameTable = past.filter((h) => h.tableId && h.tableId === record.tableId);
    let streak = 1;
    for (const h of sameTable) { // newest first
      const top = [...h.results].sort((a, b) => b.net - a.net)[0];
      if (top && top.net > 0 && top.name.trim().toLowerCase() === winner.name.trim().toLowerCase()) streak += 1; else break;
    }
    if (streak >= 2) out.push({ e: '🔥', t: `${streak} ניצחונות ברצף בשולחן הזה` });
    const comeback = record.results.find((r) => r.buyIn >= 3 * Math.min(...record.results.map((x) => x.buyIn || Infinity)) && r.net > 0);
    if (comeback) out.push({ e: '🧟', t: `קאמבק של ${comeback.name}: נכנס כמה פעמים ויצא ברווח` });
    return out.slice(0, 3);
  }, [record, history, winner, pot]);

  // phone numbers of whoever receives money, so everyone knows where to send it
  const phoneOf = (id) => players?.[id]?.phone || record.results.find((r) => r.playerId === id)?.phone;
  const local = (ph) => (ph.startsWith('+972') ? `0${ph.slice(4)}` : ph);

  const share = async () => {
    const medal = ['🥇', '🥈', '🥉'];
    const transfers = record.settlements || [];
    const seen = new Set();
    const phones = transfers.filter((p) => !seen.has(p.toId) && seen.add(p.toId))
      .map((p) => { const ph = phoneOf(p.toId); return ph ? `${p.toMembers ? p.toMembers[0] : p.to} ${local(ph)}` : null; })
      .filter(Boolean);
    const text = [
      `🃏 ${record.name || 'ערב פוקר'} נסגר! · ${new Date(record.endedAt || Date.now()).toLocaleDateString('he-IL')}`,
      ...ranked.slice(0, 3).map((r, i) => `${medal[i]} ${r.name} ${r.net > 0 ? '+' : ''}${numFmt(r.net)}${cur}`),
      `💰 קופה: ${numFmt(pot)}${cur}`,
      ...badges.map((b) => `${b.e} ${b.t}`),
      ...(transfers.length ? ['', '💸 העברות:', ...transfers.map((p) => `• ${p.from} ← ${p.fromMembers ? 'מעבירים' : 'מעביר'} ל${p.to} ${numFmt(p.amount)}${cur}`)] : []),
      ...(phones.length ? ['', '📱 מספרי טלפון להעברות:', ...phones] : []),
      '', `מנהלים את הערבים ב-Home Poker: ${APP_URL}`,
    ].join('\n');
    track('night_shared', { badges: badges.length, transfers: transfers.length, phones: phones.length });
    if (navigator.share) { try { await navigator.share({ text }); return; } catch { /* cancelled */ } }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  return (
    <div className="fixed inset-0 z-[80] flex flex-col overflow-hidden bg-night-950" role="dialog" aria-label="סיכום הערב">
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(600px 420px at 50% 20%, rgba(251,191,36,.25), transparent 70%)' }} />
      {/* confetti chips */}
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 26 }, (_, i) => (
          <span key={i} className="confetti absolute top-[-20px] block rounded-full border-2 border-dashed border-white/70"
            style={{ left: `${(i * 37) % 100}%`, width: 10 + (i % 3) * 4, height: 10 + (i % 3) * 4, background: CONFETTI[i % CONFETTI.length], animationDelay: `${(i % 9) * 0.25}s`, animationDuration: `${2.6 + (i % 5) * 0.5}s` }} />
        ))}
      </div>

      <div className="pt-safe relative flex justify-end px-4 py-3">
        <button onClick={onClose} aria-label="סגור" className="rounded-full p-2 text-slate-300 hover:bg-white/10"><X size={24} /></button>
      </div>

      <div className="no-scrollbar relative mx-auto flex w-full max-w-md flex-1 flex-col items-center overflow-y-auto px-6 pb-6 text-center">
        <div className="text-sm font-bold uppercase tracking-widest text-amber-200/80">{record.name || 'הערב'} נסגר</div>
        {winner && winner.net > 0 ? (<>
          <motion.div initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', damping: 11 }} className="relative mt-6">
            <Crown size={44} className="absolute -top-9 left-1/2 -translate-x-1/2 text-amber-300 drop-shadow-[0_0_14px_rgba(251,191,36,.8)]" fill="#fbbf24" />
            <ChipAvatar {...looks(winner)} chip={0} color="#fbbf24" size={124} />
          </motion.div>
          <div className="mt-4 text-4xl font-black text-white">{winner.name}</div>
          <div className="text-sm text-slate-400">המלך של הערב</div>
          <M v={winner.net} signed cur={cur} className="mt-2 text-5xl font-black text-emerald-300 drop-shadow-[0_0_20px_rgba(52,211,153,.5)]" />
        </>) : (
          <div className="mt-10 text-3xl font-black text-white">כולם יצאו באפס 🤝</div>
        )}

        {badges.length > 0 && (
          <div className="mt-5 w-full space-y-2">
            {badges.map((b) => (
              <motion.div key={b.t} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                className="rounded-2xl border border-amber-300/40 bg-amber-400/10 px-4 py-2 text-sm font-bold text-amber-100">{b.e} {b.t}</motion.div>
            ))}
          </div>
        )}

        <div className="mt-6 w-full space-y-2">
          {ranked.slice(1, 3).map((r, i) => (
            <div key={r.playerId} className="glass flex items-center gap-3 p-3 text-right">
              <span className="text-xl">{i === 0 ? '🥈' : '🥉'}</span>
              <ChipAvatar {...looks(r)} chip={i + 1} size={36} />
              <span className="flex-1 truncate font-bold text-white">{r.name}</span>
              <M v={r.net} signed cur={cur} className={`font-black ${r.net > 0 ? 'text-emerald-300' : r.net < 0 ? 'text-rose-300' : 'text-slate-400'}`} />
            </div>
          ))}
          <div className="pt-1 text-sm text-slate-400">קופה של <M v={pot} cur={cur} className="font-bold text-amber-200" /> · {record.results.length} שחקנים</div>
        </div>
      </div>

      <div className="pb-safe relative mx-auto flex w-full max-w-md gap-2 px-6 pb-6">
        <button onClick={onClose} className="btn-ghost flex-1">סגור</button>
        <button onClick={share} className="btn-primary flex-[2] text-lg"><Share2 size={20} /> שתפו בקבוצה</button>
      </div>
    </div>
  );
}
