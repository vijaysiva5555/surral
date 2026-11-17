"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { normPn, qtyText } from "@/lib/stockCalc";

export type StockPart = { pn: string; desc: string; location: string; balance: number | null; inLedger: boolean };
const UNKNOWN = (pn: string): StockPart => ({ pn, desc: "", location: "", balance: null, inLedger: false });

/** Part-number box with type-ahead: parts on the stock ledger first (with their balance), then the Parts master.
    Any text may be typed. A part is handed back in two ways:
    - onPick  – chosen from the list (click / Enter); the form may move on to the next box;
    - onMatch – the number was typed in full. It fires as soon as the search answers, without waiting for the box to
      be left, and again when it is left; the form fills in the description and must leave the cursor where it is.
    The list is drawn with fixed positioning so it is not cut off inside a scrolling table. */
export default function StockPartInput({ value, onChange, onPick, onMatch = onPick, disabled, className = "xl-inp font-mono", placeholder = "Part no." }: {
  value: string; onChange: (pn: string) => void; onPick: (p: StockPart) => void; onMatch?: (p: StockPart) => void; disabled?: boolean; className?: string; placeholder?: string;
}) {
  const [res, setRes] = useState<StockPart[]>([]);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [box, setBox] = useState<{ left: number; top: number; width: number } | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const typed = useRef(false);     // search only after the user typed, not when the form loads a saved value
  const told = useRef("");         // the part number last handed to onMatch, so the same answer is not sent twice
  const match = useRef(onMatch);
  useEffect(() => { match.current = onMatch; });

  const place = () => { const el = ref.current; if (!el) return false; const b = el.getBoundingClientRect(); setBox({ left: b.left, top: b.bottom + 2, width: Math.max(b.width, 420) }); return b.bottom > 0 && b.top < window.innerHeight; };
  const tell = (p: StockPart) => { if (told.current === p.pn) return; told.current = p.pn; match.current(p); };

  useEffect(() => {
    const q = value.trim();
    if (!typed.current || q.length < 2) { setRes([]); setOpen(false); return; }
    let stale = false;
    const t = setTimeout(() => api(`/api/stock/parts?q=${encodeURIComponent(q)}`).then((r) => {
      if (stale) return;
      const items = r.items as StockPart[];
      setRes(items); setHi(0);
      const exact = items.find((p) => p.pn === normPn(q));
      if (exact && typed.current) tell(exact);   // typed in full: the description appears straight away
      if (document.activeElement === ref.current && place()) setOpen(true);
    }).catch(() => {}), 200);
    return () => { stale = true; clearTimeout(t); };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    // the page moving (a phone scrolls the box into view when the keyboard opens) keeps the list under the box; scrolling the list itself is left alone
    const follow = (e: Event) => { if (e.target instanceof Node && list.current?.contains(e.target)) return; if (!place()) setOpen(false); };
    window.addEventListener("scroll", follow, true); window.addEventListener("resize", follow);
    return () => { window.removeEventListener("scroll", follow, true); window.removeEventListener("resize", follow); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (p: StockPart) => { typed.current = false; told.current = p.pn; setOpen(false); onPick(p); };
  /** leaving the box: a part number typed in full without choosing from the list still gets its description and balance */
  const settle = () => {
    setTimeout(() => setOpen(false), 150);
    const pn = normPn(value);
    if (!typed.current || !pn) return;
    typed.current = false;
    const hit = res.find((p) => p.pn === pn);
    if (hit) tell(hit);
    else if (told.current !== pn) api(`/api/stock/parts?q=${encodeURIComponent(pn)}`).then((r) => tell((r.items as StockPart[]).find((p) => p.pn === pn) ?? UNKNOWN(pn))).catch(() => {});
  };

  return (
    <>
      <input ref={ref} className={className} placeholder={placeholder} value={value} disabled={disabled} autoComplete="off" autoCapitalize="characters" spellCheck={false}
        onChange={(e) => { typed.current = true; told.current = ""; onChange(e.target.value); }}
        onBlur={settle}
        onKeyDown={(e) => {
          if (!open || res.length === 0) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, res.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); pick(res[hi]); }
          else if (e.key === "Escape") setOpen(false);
        }} />
      {open && box && res.length > 0 && (
        <div ref={list} className="fixed z-50 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg" style={{ left: Math.min(box.left, window.innerWidth - Math.min(box.width, window.innerWidth - 16) - 8), top: box.top, width: Math.min(box.width, window.innerWidth - 16) }}>
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
