"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Hash, Loader2, TriangleAlert } from "lucide-react";
import { api } from "@/lib/client";
import { normNumber } from "@/lib/quoteNumberRules";

/** The quotation number, editable. Empty on a new quotation = the next number in the series (shown greyed in the box).
    While typing it checks that no other quotation already has the number; saving checks again on the server. */
export default function QuoteNumberField({ value, onChange, current, series, date, kind, id, disabled }: {
  value: string; onChange: (v: string) => void;
  /** the number the quotation has now (empty for a new one) */
  current?: string;
  /** a new quotation: its series and date, to show the next number it would get */
  series?: "spare" | "equipment" | "project"; date?: string;
  kind: "quote" | "project"; id?: string; disabled?: boolean;
}) {
  const [state, setState] = useState<{ busy?: boolean; free?: boolean; error?: string }>({});
  const [next, setNext] = useState("");
  const n = normNumber(value);
  const unchanged = !n || n === normNumber(current);

  useEffect(() => {   // the next number of the series (nothing is reserved – it is given on Save)
    if (!series || current) return;
    let stale = false;
    api(`/api/quote-number?next=${series}&date=${date ?? ""}`).then((r) => { if (!stale) setNext(r.next ?? ""); }).catch(() => {});
    return () => { stale = true; };
  }, [series, date, current]);

  useEffect(() => {
    if (unchanged) { setState({}); return; }
    setState({ busy: true });
    let stale = false;
    const t = setTimeout(() => {
      api(`/api/quote-number?number=${encodeURIComponent(n)}&kind=${kind}${id ? `&id=${id}` : ""}`)
        .then((r) => { if (!stale) setState({ free: !!r.free, error: r.error }); })
        .catch(() => { if (!stale) setState({}); });
    }, 400);
    return () => { stale = true; clearTimeout(t); };
  }, [n, unchanged, kind, id]);

  return (
    <div>
      <label className="label" htmlFor="quote-number">Quotation number</label>
      <div className="relative">
        <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input id="quote-number" className={`input pl-9 font-mono ${state.error ? "!border-red-400 focus:!ring-red-100" : ""}`} maxLength={60} disabled={disabled}
          value={value} placeholder={next || current || ""} onChange={(e) => onChange(e.target.value)} aria-invalid={!!state.error} aria-describedby="quote-number-help" />
      </div>
      <p id="quote-number-help" className="mt-1.5 flex items-center gap-1 text-xs">
        {state.busy ? <span className="flex items-center gap-1 text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Checking…</span>
          : state.error ? <span className="flex items-center gap-1 text-red-600"><TriangleAlert className="h-3.5 w-3.5 shrink-0" />{state.error}</span>
          : state.free ? <span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Available – it is used when you save</span>
          : <span className="text-slate-500">{current ? "Change it if needed – no two quotations can have the same number" : `Leave empty for the next number${next ? ` (${next})` : ""}, or type your own`}</span>}
      </p>
    </div>
  );
}
