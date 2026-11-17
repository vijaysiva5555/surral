"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { qtyText } from "@/lib/stockCalc";

export type StockPart = { pn: string; desc: string; location: string; balance: number | null; inLedger: boolean };

/** Part-number box with type-ahead: parts on the stock ledger first (with their balance), then the Parts master.
    Any text may be typed – picking a suggestion also hands back the description. The list is drawn with fixed
    positioning so it is not cut off inside a scrolling table. */
export default function StockPartInput({ value, onChange, onPick, disabled, className = "xl-inp font-mono", placeholder = "Part no." }: {
  value: string; onChange: (pn: string) => void; onPick: (p: StockPart) => void; disabled?: boolean; className?: string; placeholder?: string;
}) {
  const [res, setRes] = useState<StockPart[]>([]);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [box, setBox] = useState<{ left: number; top: number; width: number } | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const typed = useRef(false);   // search only after the user typed, not when the form loads a saved value

  useEffect(() => {
    const q = value.trim();
    if (!typed.current || q.length < 2) { setRes([]); setOpen(false); return; }
    let stale = false;
    const t = setTimeout(() => api(`/api/stock/parts?q=${encodeURIComponent(q)}`).then((r) => {
      if (stale) return;
      setRes(r.items); setHi(0);
      const el = ref.current;
      if (el && document.activeElement === el) { const b = el.getBoundingClientRect(); setBox({ left: b.left, top: b.bottom + 2, width: Math.max(b.width, 420) }); setOpen(true); }
    }).catch(() => {}), 200);
    return () => { stale = true; clearTimeout(t); };
  }, [value]);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true); window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);

  const pick = (p: StockPart) => { typed.current = false; setOpen(false); onPick(p); };
  /** a part number typed in full without choosing from the list still gets its description and balance */
  const settle = () => {
    setTimeout(() => setOpen(false), 150);
    const pn = value.trim().toUpperCase();
    if (!typed.current || !pn) return;
    typed.current = false;
    const hit = res.find((p) => p.pn === pn);
    if (hit) onPick(hit);
    else api(`/api/stock/parts?q=${encodeURIComponent(pn)}`).then((r) => { const exact = (r.items as StockPart[]).find((p) => p.pn === pn); onPick(exact ?? { pn, desc: "", location: "", balance: null, inLedger: false }); }).catch(() => {});
  };

  return (
    <>
      <input ref={ref} className={className} placeholder={placeholder} value={value} disabled={disabled} autoComplete="off" spellCheck={false}
        onChange={(e) => { typed.current = true; onChange(e.target.value); }}
        onBlur={settle}
        onKeyDown={(e) => {
          if (!open || res.length === 0) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, res.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); pick(res[hi]); }
          else if (e.key === "Escape") setOpen(false);
        }} />
      {open && box && res.length > 0 && (
        <div className="fixed z-50 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg" style={{ left: Math.min(box.left, window.innerWidth - Math.min(box.width, window.innerWidth - 16) - 8), top: box.top, width: Math.min(box.width, window.innerWidth - 16) }}>
          {res.map((p, i) => (
            <button key={p.pn} type="button" onMouseDown={(e) => { e.preventDefault(); pick(p); }} onMouseEnter={() => setHi(i)}
              className={`flex w-full items-start justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-0 ${i === hi ? "bg-brand-50" : ""}`}>
              <span className="min-w-0"><span className="block font-mono text-xs font-semibold text-slate-900">{p.pn}</span><span className="block truncate text-sm text-slate-600">{p.desc || "—"}</span></span>
              <span className="shrink-0 text-right text-xs">
                {p.inLedger
                  ? <><span className={`block font-semibold tabular-nums ${(p.balance ?? 0) <= 0 ? "text-red-600" : (p.balance ?? 0) <= 3 ? "text-amber-600" : "text-emerald-700"}`}>{qtyText(p.balance)} in stock</span>{p.location && <span className="text-slate-400">{p.location}</span>}</>
                  : <span className="text-slate-400">not a stock item</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
