"use client";
import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { api } from "@/lib/client";
import { displayNumber } from "@/lib/quoteCalc";
import StatusBadge from "@/components/StatusBadge";
import { QUOTE_STATUS_PATCH, quoteStatusLabel } from "@/lib/quoteStatus";

export default function QuoteStatusModal({
  quote,
  onClose,
  onSaved,
}: {
  quote: { _id: string; number: string; revision: number; status: string };
  onClose: () => void;
  onSaved: (status: string) => void;
}) {
  const [next, setNext] = useState(quote.status);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (next === quote.status) {
      onClose();
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await api(`/api/quotes/${quote._id}`, { method: "PATCH", json: { status: next } });
      onSaved(next);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold">Change status</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <p className="text-sm text-slate-600">
            {displayNumber(quote)} · current status{" "}
            <StatusBadge status={quote.status} />
          </p>
          <div>
            <label className="label">New status</label>
            <select className="input w-full" value={next} onChange={(e) => setNext(e.target.value)}>
              {QUOTE_STATUS_PATCH.map((s) => (
                <option key={s} value={s}>
                  {quoteStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={busy} onClick={save}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
