"use client";
import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, X, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { api } from "@/lib/client";
import { dmy, pct } from "@/lib/format";

type PL = { _id: string; year: number; name: string; effectiveFrom: string; itemCount: number; sourceFile?: string; importedBy?: string; updatedAt: string };

export default function ListsTab({ admin }: { admin: boolean }) {
  const [items, setItems] = useState<PL[]>([]);
  const [wizard, setWizard] = useState(false);
  const [err, setErr] = useState("");
  const load = () => api("/api/pricing/lists").then((r) => setItems(r.items));
  useEffect(() => { load(); }, []);

  async function del(l: PL) {
    if (!confirm(`Delete price list “${l.name}” and all its prices?`)) return;
    try { await api(`/api/pricing/lists/${l._id}`, { method: "DELETE" }); load(); } catch (e) { setErr((e as Error).message); }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">A quotation automatically uses the list whose effective date is the latest one on or before the quotation date.</p>
        {admin && <button className="btn-primary" onClick={() => setWizard(true)}><Upload className="h-4 w-4" />Import price list</button>}
      </div>
      {err && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">Year</th><th className="th">Name</th><th className="th">Effective from</th><th className="th text-right">Parts</th><th className="th">Source file</th><th className="th">Imported by</th><th className="th w-12" /></tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={7} className="td py-10 text-center text-slate-400">No price lists yet. {admin ? "Import Graco’s 2026 / 2027 file to begin." : ""}</td></tr>}
            {items.map((l) => (
              <tr key={l._id} className="hover:bg-slate-50">
                <td className="td"><span className="badge bg-brand-50 text-brand-700">{l.year}</span></td>
                <td className="td font-medium text-slate-900">{l.name}</td>
                <td className="td">{dmy(l.effectiveFrom)}</td>
                <td className="td text-right tabular-nums">{l.itemCount.toLocaleString("en-IN")}</td>
                <td className="td max-w-xs truncate text-xs text-slate-500">{l.sourceFile}</td>
                <td className="td text-xs text-slate-500">{l.importedBy}</td>
                <td className="td">{admin && <button title="Delete" onClick={() => del(l)} className="text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {wizard && <ImportWizard onClose={() => setWizard(false)} onDone={() => { load(); }} />}
    </>
  );
}

type Report = { detected: { year: number | null; effectiveFrom: string | null }; year: number | ""; effectiveFrom: string; name: string; rows: number; replacesExisting: string | null; needsInput?: boolean;
  stats: { rawRows: number; duplicateKeys: number; duplicateSamples: string[]; zeroPrice: number; badPrice: number; byStatus: Record<string, number>; byDivision: Record<string, number> };
  comparison: null | { against: string; added: number; removed: number; changed: number; unchanged: number; avgPct: number; medianPct: number } };

function ImportWizard({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [form, setForm] = useState({ year: "", effectiveFrom: "", name: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<number | null>(null);

  const send = async (mode: "preview" | "commit") => {
    const fd = new FormData();
    fd.append("file", file!); fd.append("mode", mode);
    if (form.year) fd.append("year", form.year);
    if (form.effectiveFrom) fd.append("effectiveFrom", form.effectiveFrom);
    if (form.name) fd.append("name", form.name);
    return api("/api/pricing/import", { method: "POST", body: fd });
  };

  async function analyse(f: File) {
    setFile(f); setBusy(true); setErr(""); setReport(null);
    const fd = new FormData(); fd.append("file", f); fd.append("mode", "preview");
    try {
      const r = (await api("/api/pricing/import", { method: "POST", body: fd })).report as Report;
      setReport(r); setForm({ year: String(r.year), effectiveFrom: r.effectiveFrom, name: r.name });
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  async function reanalyse() { setBusy(true); setErr(""); try { setReport((await send("preview")).report); } catch (e) { setErr((e as Error).message); } setBusy(false); }
  async function commit() { setBusy(true); setErr(""); try { const r = await send("commit"); setDone(r.imported); onDone(); } catch (e) { setErr((e as Error).message); } setBusy(false); }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="card flex max-h-[90vh] w-full max-w-2xl flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><h2 className="text-lg font-semibold">Import price list</h2><button onClick={onClose}><X className="h-5 w-5 text-slate-500" /></button></div>
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {done !== null ? (
            <div className="py-8 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" /><p className="mt-3 text-lg font-semibold">{done.toLocaleString("en-IN")} parts imported</p><p className="text-sm text-slate-500">The price list is ready to use in quotations.</p></div>
          ) : (
            <>
              <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={(e) => e.target.files?.[0] && analyse(e.target.files[0])} />
              <button className="flex w-full flex-col items-center rounded-xl border-2 border-dashed border-slate-300 p-8 text-slate-500 hover:border-brand-500 hover:text-brand-600" onClick={() => fileRef.current?.click()}>
                <Upload className="mb-2 h-7 w-7" /><span className="font-medium">{file ? file.name : "Choose Graco price list (.xlsx)"}</span><span className="text-xs">Sheet “India_INR” is read automatically</span>
              </button>
              {busy && <div className="flex items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Working… large files take a few seconds</div>}
              {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
              {report && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className="label">Year</label><input className="input" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} onBlur={reanalyse} /></div>
                    <div><label className="label">Effective from</label><input className="input" type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} onBlur={reanalyse} /></div>
                    <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  </div>
                  {report.needsInput && <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />The year / effective date couldn’t be read from this file. Enter them above (click out of the field to re-check).</p>}
                  <div className="grid grid-cols-4 gap-3 text-center">
                    {[["Parts", report.rows.toLocaleString("en-IN")], ["Zero price", report.stats.zeroPrice], ["Duplicates merged", report.stats.duplicateKeys], ["Bad rows skipped", report.stats.badPrice]].map(([k, v]) => (
                      <div key={k as string} className="rounded-lg bg-slate-50 p-3"><div className="text-xl font-bold text-slate-900">{v}</div><div className="text-xs text-slate-500">{k}</div></div>
                    ))}
                  </div>
                  {report.comparison ? (
                    <div className="rounded-lg border border-slate-200 p-4 text-sm">
                      <div className="mb-2 font-semibold">Changes vs “{report.comparison.against}”</div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div><b className="text-lg text-emerald-600">{report.comparison.added.toLocaleString("en-IN")}</b><div className="text-xs text-slate-500">new parts</div></div>
                        <div><b className="text-lg text-red-600">{report.comparison.removed.toLocaleString("en-IN")}</b><div className="text-xs text-slate-500">dropped</div></div>
                        <div><b className="text-lg text-amber-600">{report.comparison.changed.toLocaleString("en-IN")}</b><div className="text-xs text-slate-500">price changed</div></div>
                        <div><b className="text-lg">{pct(report.comparison.medianPct)}</b><div className="text-xs text-slate-500">median change</div></div>
                      </div>
                    </div>
                  ) : <p className="text-sm text-slate-500">No earlier price list to compare with.</p>}
                  {report.replacesExisting && <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />A list for {report.year} already exists (“{report.replacesExisting}”). Importing will replace its prices.</p>}
                  {report.stats.duplicateKeys > 0 && <p className="text-xs text-slate-500">Duplicate part+PGA rows (e.g. {report.stats.duplicateSamples.join(", ")}) – the last occurrence is kept.</p>}
                </>
              )}
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button className="btn-ghost" onClick={onClose}>{done !== null ? "Close" : "Cancel"}</button>
          {done === null && <button className="btn-primary" disabled={!report || busy || !form.year || !form.effectiveFrom} onClick={commit}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Import {report ? report.rows.toLocaleString("en-IN") : ""} parts</button>}
        </div>
      </div>
    </div>
  );
}
