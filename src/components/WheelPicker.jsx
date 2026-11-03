import { useLayoutEffect, useRef, useState } from 'react';
import { Keyboard, Disc3 } from 'lucide-react';
import { numFmt } from '../state/store';

const ITEM_H = 44;

/**
 * iOS-style scroll wheel. Native scrolling + scroll-snap (smooth on touch, works with mouse wheel),
 * with a 3D cylinder effect computed from the scroll position.
 * items: [{ value, label, disabled? }]
 */
export function WheelPicker({ items, value, onChange, visible = 5, className = '', ariaLabel, itemClass = 'text-xl' }) {
  const ref = useRef(null);
  const [top, setTop] = useState(0);
  const committed = useRef(value);
  const lastIdx = useRef(0);
  const timer = useRef();
  const pad = (ITEM_H * (visible - 1)) / 2;
  const indexOf = (v) => Math.max(0, items.findIndex((i) => i.value === v));

  // Keep the wheel in sync when the value changes from outside.
  useLayoutEffect(() => {
    const el = ref.current;
    const i = indexOf(value);
    committed.current = value;
    lastIdx.current = i;
    if (Math.round(el.scrollTop / ITEM_H) !== i) {
      el.scrollTop = i * ITEM_H;
      setTop(i * ITEM_H);
    }
  }, [value, items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    const el = ref.current;
    setTop(el.scrollTop);
    const i = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)));
    if (i !== lastIdx.current) {
      lastIdx.current = i;
      try { navigator.vibrate?.(3); } catch { /* not supported */ }
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const it = items[i];
      if (it && it.value !== committed.current) { committed.current = it.value; onChange(it.value); }
    }, 90);
  };

  const scrollTo = (i) => ref.current.scrollTo({ top: i * ITEM_H, behavior: 'smooth' });
  const onKey = (e) => {
    const i = indexOf(committed.current);
    if (e.key === 'ArrowDown') { e.preventDefault(); scrollTo(Math.min(items.length - 1, i + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); scrollTo(Math.max(0, i - 1)); }
  };

  return (
    <div className={`relative ${className}`} style={{ height: ITEM_H * visible, perspective: 600 }}>
      {/* center selection band */}
      <div className="pointer-events-none absolute inset-x-0 rounded-xl border border-white/15 bg-white/[0.08] shadow-[0_0_18px_rgba(52,211,153,.18)]"
        style={{ top: pad, height: ITEM_H }} />
      <div
        ref={ref} onScroll={onScroll} onKeyDown={onKey} tabIndex={0} role="listbox" aria-label={ariaLabel}
        className="wheel-mask no-scrollbar absolute inset-0 snap-y snap-mandatory overflow-y-auto overscroll-contain outline-none"
      >
        <div style={{ height: pad }} />
        {items.map((it, i) => {
          const d = (i * ITEM_H - top) / ITEM_H;
          const a = Math.min(Math.abs(d), 3);
          return (
            <div key={String(it.value)} role="option" aria-selected={it.value === value} onClick={() => scrollTo(i)}
              className={`flex snap-center items-center justify-center font-semibold tabular ${itemClass} ${it.disabled ? 'text-slate-600 line-through' : a < 0.5 ? 'text-white' : 'text-slate-300'}`}
              style={{ height: ITEM_H, opacity: 1 - a * 0.27, transform: `rotateX(${-d * 18}deg) scale(${1 - a * 0.06})` }}>
              {it.label}
            </div>
          );
        })}
        <div style={{ height: pad }} />
      </div>
    </div>
  );
}



/** Chip count: typing only (fast with the numeric keypad), plus optional quick buttons. */
export function ChipsInput({ value, onChange, quick = [], autoFocus = true }) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <input autoFocus={autoFocus} type="number" inputMode="numeric" min="0" dir="ltr" placeholder="0"
          value={value ?? ''} onFocus={(e) => e.target.select()}
          onChange={(e) => onChange(e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value))))}
          className="text-input pl-20 text-center text-3xl font-black text-amber-200 tabular" />
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-amber-200/60">צ'יפים</span>
      </div>
      {quick.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {quick.map((q) => (
            <button key={q.label} onClick={() => onChange(q.value)} className="glass-pill px-3 py-1 text-xs text-slate-300 hover:text-white">{q.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A scroll wheel with a small "type it" button next to its label.
 * Typing allows any exact value (callers include the current value in `items`).
 */
export function WheelOrType({ label, items, value, onChange, suffix, visible = 5, ariaLabel }) {
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const open = () => { setDraft(String(value ?? '')); setTyping(true); };
  const commit = () => {
    const n = Math.round(Number(draft) * 100) / 100;
    if (n > 0) onChange(n);
    setTyping(false);
  };
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-medium tracking-wide text-slate-400">{label}</span>
        <button onClick={typing ? commit : open} className="glass-pill flex shrink-0 items-center gap-1 whitespace-nowrap px-2.5 py-1 text-[11px] font-semibold text-emerald-200 hover:shadow-glow-emerald">
          {typing ? <><Disc3 size={13} /> גלגלת</> : <><Keyboard size={13} /> הקלדה</>}
        </button>
      </div>
      {typing ? (
        <div className="flex flex-col justify-center" style={{ height: 44 * visible }}>
          <div className="relative">
            <input autoFocus type="number" inputMode="decimal" min="0" dir="ltr" value={draft} placeholder="0"
              onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commit()}
              className="text-input text-center text-2xl font-black tabular" />
            {suffix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{suffix}</span>}
          </div>
          <button onClick={commit} disabled={!(Number(draft) > 0)} className="btn-primary mt-2 py-2.5 text-sm">אישור</button>
        </div>
      ) : (
        <WheelPicker items={items} value={value} onChange={onChange} visible={visible} ariaLabel={ariaLabel || label} />
      )}
    </div>
  );
}

/** Money amounts for buy-ins/rebuys: steps of 50. */
export function amountItems(cur, extra = []) {
  const set = new Set(extra.filter((x) => x > 0));
  for (let v = 50; v <= 5000; v += 50) set.add(v);
  return [...set].sort((a, b) => a - b).map((v) => ({ value: v, label: `${numFmt(v)}${cur}` }));
}

export function chipItems(extra = []) {
  const base = [100, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 15000, 20000, 25000, 50000];
  return [...new Set([...base, ...extra.filter((x) => x > 0)])].sort((a, b) => a - b).map((v) => ({ value: v, label: numFmt(v, 0) }));
}
