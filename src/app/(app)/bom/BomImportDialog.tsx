"use client";
import { useMemo, useState } from "react";
import { FileSpreadsheet, X } from "lucide-react";
import { bomSummary, type BomItem } from "@/lib/bomCalc";
import { inr } from "@/lib/format";

export type ImportedItem = BomItem & { notes: string; margin2Pct: number };
export type ImportedSheet = { name: string; blocks: { title: string; items: ImportedItem[] }[] };
export type ImportChoice = { blocks: { title: string; items: ImportedItem[] }[]; mode: "add" | "replace" };

/** After an Excel BOM workbook is read: pick the sheet and the blocks to bring in, and whether they replace the current sheets */
export default function BomImportDialog({ fileName, sheets, hasItems, onApply, onClose }: {
  fileName: string; sheets: ImportedSheet[]; hasItems: boolean;
  onApply: (c: ImportChoice) => void; onClose: () => void;
}) {
  const [si, setSi] = useState(0);
  const sheet = sheets[si];
  const [picked, setPicked] = useState<Set<number>>(() => new Set(sheet.blocks.map((_, i) => i)));
  const [mode, setMode] = useState<"add" | "replace">(hasItems ? "add" : "replace");
  const sums = useMemo(() => sheet.blocks.map((b) => bomSummary({ items: b.items })), [sheet]);
  const chosen = sheet.blocks.filter((_, i) => picked.has(i));
  const total = chosen.reduce((t, b) => t + b.items.length, 0);
  const toggle = (i: number) => setPicked((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="card flex max-h-[88vh] w-full max-w-2xl flex-col" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="bom-import-title">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex min-w-0 items-center gap-2"><FileSpreadsheet className="h-5 w-5 shrink-0 text-emerald-600" /><h2 id="bom-import-title" className="truncate text-lg font-semibold">Import from {fileName}</h2></div>
          <button type="button" onClick={onClose} aria-label="Close"><X className="h-5 w-5 text-slate-500" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {sheets.length > 1 && (
            <div>
              <label className="label" htmlFor="bom-import-sheet">Excel sheet</label>
              <select id="bom-import-sheet" className="input" value={si} onChange={(e) => { const n = Number(e.target.value); setSi(n); setPicked(new Set(sheets[n].blocks.map((_, i) => i))); }}>
                {sheets.map((s, i) => <option key={i} value={i}>{s.name} – {s.blocks.length} block{s.blocks.length === 1 ? "" : "s"}</option>)}
              </select>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Blocks found – each becomes a section of this BOM</span>
              <button type="button" className="text-xs font-medium text-brand-600" onClick={() => setPicked(picked.size === sheet.blocks.length ? new Set() : new Set(sheet.blocks.map((_, i) => i)))}>
                {picked.size === sheet.blocks.length ? "Select none" : "Select all"}
              </button>
            </div>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {sheet.blocks.map((b, i) => (
                <li key={i}>
                  <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-slate-50">
                    <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={picked.has(i)} onChange={() => toggle(i)} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-slate-900">{b.title}</span>
                      <span className="block text-xs text-slate-500">{b.items.length} item{b.items.length === 1 ? "" : "s"} · landed ₹ {inr(sums[i].landed)} · total price ₹ {inr(sums[i].price)}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          {hasItems && (
            <fieldset className="space-y-1.5">
              <legend className="mb-1 text-sm font-medium text-slate-700">This BOM already has items</legend>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="bom-import-mode" checked={mode === "add"} onChange={() => setMode("add")} />Add the blocks as new sections after the current ones</label>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="bom-import-mode" checked={mode === "replace"} onChange={() => setMode("replace")} />Replace the current sections with the blocks</label>
            </fieldset>
          )}

          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Read: Part No → MAKE, Description, Qty, List Price, Dis, Net Price → Landed Price, both Margins and Notes. Totals and unit prices are worked out again by the BOM
            (unit price = landed × (1 + margin), rounded up). An item with only a selling price keeps that price. Nothing is saved until you press <b>Save BOM</b>.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
          <span className="text-sm text-slate-600">{chosen.length} section{chosen.length === 1 ? "" : "s"} · {total} item{total === 1 ? "" : "s"}</span>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-primary" disabled={!chosen.length} onClick={() => onApply({ blocks: chosen, mode })}>Import into the BOM</button>
          </div>
        </div>
      </div>
    </div>
  );
}
