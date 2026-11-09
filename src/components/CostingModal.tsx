"use client";
import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import PartPicker from "./PartPicker";
import { type CostItem, type Costing, costLanded, costUnit, costSell, costingSummary, consistsOf, newCosting } from "@/lib/quoteCosting";
import { inr, inr0 } from "@/lib/format";

/** Internal BOM costing for a package – mirrors the BOM sheet. Never printed on the quotation. */
export default function CostingModal({ initial, listId, hasSubItems, onClose, onApply }: {
  initial?: Costing; listId?: string; hasSubItems: boolean; onClose: () => void;
  onApply: (r: { costing: Costing; price: number; landed: number; subItems?: string[] }) => void;
}) {
  const [c, setC] = useState<Costing>(() => structuredClone(initial ?? newCosting()));
  const [useList, setUseList] = useState(!hasSubItems);
  const sm = costingSummary(c);
  const set = (i: number, p: Partial<CostItem>) => setC({ ...c, items: c.items.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const num = (v: string) => (v === "" ? 0 : Number(v));
  const cell = "w-full rounded border border-slate-200 px-1.5 py-1 text-right text-xs outline-none focus:border-brand-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="card flex max-h-[92vh] w-full max-w-5xl flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div><h2 className="text-lg font-semibold">Costing sheet</h2><p className="text-xs text-red-600">Internal – never shown on the customer’s quotation</p></div>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-500" /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
            <PartPicker listId={listId} placeholder="Add a Graco part to the package…" onPick={(p) => setC({ ...c, items: [...c.items, { make: p.pn, description: p.desc, qty: 1, listPrice: p.price ?? 0, discountPct: p.costDiscountPct ?? 0, manualCost: 0 }] })} />
            <button className="btn-ghost" onClick={() => setC({ ...c, items: [...c.items, { make: "", description: "", qty: 1, listPrice: 0, discountPct: 0, manualCost: 0 }] })}><Plus className="h-4 w-4" />Manual item</button>
            <label className="flex items-center gap-2 text-xs text-slate-500">Margin 1 %<input type="number" className="input !w-20 !py-1" value={c.margin1Pct} onChange={(e) => setC({ ...c, margin1Pct: num(e.target.value) })} /></label>
            <label className="flex items-center gap-2 text-xs text-slate-500">Margin 2 %<input type="number" className="input !w-20 !py-1" value={c.margin2Pct} onChange={(e) => setC({ ...c, margin2Pct: num(e.target.value) })} /></label>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[860px]">
              <thead><tr>{["#", "Make / code", "Description", "Qty", "List ₹", "Disc %", "Manual cost ₹", "Landed ₹", "After M1 ₹", "Selling ₹", "Line total ₹", ""].map((h) => <th key={h} className="th !px-2 !py-2 !text-[10px]">{h}</th>)}</tr></thead>
              <tbody>
                {c.items.length === 0 && <tr><td colSpan={12} className="td py-8 text-center text-slate-400">Add the parts and bought-out items that make up this package.</td></tr>}
                {c.items.map((it, i) => (
                  <tr key={i}>
                    <td className="td !px-2 text-xs text-slate-400">{i + 1}</td>
                    <td className="td !px-1"><input className={cell + " !text-left"} value={it.make} onChange={(e) => set(i, { make: e.target.value })} /></td>
                    <td className="td !px-1"><input className={cell + " !text-left min-w-48"} value={it.description} onChange={(e) => set(i, { description: e.target.value })} /></td>
                    <td className="td !px-1 w-14"><input type="number" className={cell} value={it.qty} onChange={(e) => set(i, { qty: num(e.target.value) })} /></td>
                    <td className="td !px-1 w-24"><input type="number" className={cell} value={it.listPrice || ""} onChange={(e) => set(i, { listPrice: num(e.target.value) })} /></td>
                    <td className="td !px-1 w-16"><input type="number" className={cell} disabled={!it.listPrice} value={it.listPrice ? it.discountPct : ""} onChange={(e) => set(i, { discountPct: num(e.target.value) })} /></td>
                    <td className="td !px-1 w-24"><input type="number" className={cell} disabled={!!it.listPrice} value={it.listPrice ? "" : it.manualCost || ""} onChange={(e) => set(i, { manualCost: num(e.target.value) })} /></td>
                    <td className="td !px-2 text-right text-xs tabular-nums">{inr(costLanded(it))}</td>
                    <td className="td !px-2 text-right text-xs tabular-nums">{inr0(costUnit(it, c))}</td>
                    <td className="td !px-2 text-right text-xs tabular-nums">{inr(costSell(it, c))}</td>
                    <td className="td !px-2 text-right text-xs font-medium tabular-nums">{inr(costSell(it, c) * it.qty)}</td>
                    <td className="td !px-1"><button onClick={() => setC({ ...c, items: c.items.filter((_, j) => j !== i) })}><Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-600" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {[["Total landed cost", `₹${inr(sm.landed)}`], ["After margin 1", `₹${inr(sm.afterM1)}`], ["Selling (before rounding)", `₹${inr(sm.sell)}`]].map(([k, v]) => <div key={k} className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">{k}</div><div className="text-lg font-bold tabular-nums">{v}</div></div>)}
            <div className="rounded-lg bg-amber-50 p-3"><div className="flex items-center justify-between text-xs text-slate-500">Package price<span className="flex items-center gap-1">round up to ₹<input type="number" className="w-14 rounded border border-amber-200 bg-white px-1 text-right" value={c.roundTo} onChange={(e) => setC({ ...c, roundTo: num(e.target.value) })} /></span></div>
              <div className="text-lg font-bold tabular-nums">₹{inr0(sm.suggested)}</div><div className="text-xs text-slate-500">margin {sm.marginPct.toFixed(1)}% on selling price</div></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={useList} onChange={(e) => setUseList(e.target.checked)} />Write the “Consists of” list from these items {hasSubItems && <span className="text-xs text-amber-600">(replaces the current list)</span>}</label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!c.items.length} onClick={() => onApply({ costing: c, price: sm.suggested, landed: sm.landed, subItems: useList ? consistsOf(c) : undefined })}>Apply ₹{inr0(sm.suggested)} to quotation</button>
        </div>
      </div>
    </div>
  );
}
