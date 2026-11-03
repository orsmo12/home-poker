import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { numFmt } from '../state/store';

/** Money that renders correctly inside RTL text. */
export function M({ v, signed, cur = '₪', className = '' }) {
  const n = Number(v) || 0;
  const sign = signed ? (n > 0 ? '+' : n < 0 ? '−' : '') : n < 0 ? '−' : '';
  return <span dir="ltr" className={`inline-block whitespace-nowrap tabular ${className}`}>{sign}{numFmt(Math.abs(n))}{cur}</span>;
}

export const Chips = ({ v, className = '' }) => (
  <span dir="ltr" className={`inline-block whitespace-nowrap tabular ${className}`}>{numFmt(v, 0)}</span>
);

export const netTone = (c) => (c > 0 ? 'text-emerald-300' : c < 0 ? 'text-rose-300' : 'text-slate-400');

/** Animated bottom sheet. Drag the handle down to dismiss (the body stays scrollable for wheels). */
export function BottomSheet({ open, onClose, title, children }) {
  const controls = useDragControls();
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center" initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
          <motion.div
            className="absolute inset-0 bg-black/75"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog" aria-label={title}
            className="glass-strong relative w-full max-w-lg rounded-b-none border-b-0 pb-safe"
            style={{ maxHeight: '92dvh' }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340 }}
            drag="y" dragControls={controls} dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => { if (info.offset.y > 90 || info.velocity.y > 600) onClose(); }}
          >
            <div className="cursor-grab touch-none px-5 pt-3" onPointerDown={(e) => controls.start(e)}>
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/25" />
              <div className="flex items-center justify-between pb-3">
                <h3 className="text-lg font-bold text-white">{title}</h3>
                <button onClick={onClose} aria-label="סגור" className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"><X size={20} /></button>
              </div>
            </div>
            <div className="no-scrollbar overflow-y-auto px-5 pb-5" style={{ maxHeight: 'calc(92dvh - 70px)' }}>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Glowing alert used for the zero-sum check. */
export function GlowAlert({ tone, title, children }) {
  const styles = {
    ok: 'border-emerald-300/40 bg-emerald-400/10 text-emerald-50 shadow-glow-emerald',
    warn: 'border-amber-300/40 bg-amber-400/10 text-amber-50 shadow-glow-amber',
    error: 'border-rose-400/60 bg-rose-500/15 text-rose-50 shadow-glow-rose',
  }[tone];
  const Icon = tone === 'ok' ? CheckCircle2 : AlertTriangle;
  return (
    <motion.div
      initial={false}
      className={`rounded-3xl border px-4 py-3 text-sm backdrop-blur-xl ${styles}`}
    >
      <div className="flex items-center gap-2 text-base font-bold">
        <motion.span animate={tone === 'error' ? { scale: [1, 1.18, 1] } : {}} transition={{ repeat: Infinity, duration: 1.6 }}>
          <Icon size={19} className="shrink-0" />
        </motion.span>
        {title}
      </div>
      {children && <div className="mt-1 opacity-90">{children}</div>}
    </motion.div>
  );
}

export function StatTile({ label, children, tone }) {
  const color = tone === 'win' ? 'text-emerald-300' : tone === 'loss' ? 'text-rose-300' : 'text-white';
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className={`font-bold ${color}`}>{children}</div>
    </div>
  );
}

/** Segmented control with a sliding glass indicator. */
export function Segmented({ options, value, onChange }) {
  return (
    <div className="grid gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <button key={o.id} disabled={o.disabled} onClick={() => onChange(o.id)}
          className={`relative flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition disabled:opacity-30 ${value === o.id ? 'text-white' : 'text-slate-400'}`}>
          {value === o.id && <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 rounded-xl border border-white/15 bg-white/10 shadow-glass" />}
          <span className="relative flex items-center gap-1.5">{o.icon && <o.icon size={15} />}{o.label}</span>
        </button>
      ))}
    </div>
  );
}
