"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/* Browser-side drafts for the editors: the form is copied to localStorage a moment after every change, so a
   half-entered quotation / BOM survives a sidebar click, the back button, a reload or a closed tab.
   Storage may be full, blocked or hold junk – nothing in here is allowed to throw into the editor. */

const PREFIX = "surral-draft:";
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const DEBOUNCE_MS = 800;

export type Draft<T> = {
  savedAt: string;
  /** updatedAt of the saved record the changes were made on (absent for a record that was never saved) */
  baseUpdatedAt?: string;
  /** the embedded photo did not fit in storage and was left out */
  imagesOmitted?: boolean;
  data: T;
};

/** surral-draft:<kind>:<userId>:<id>  or, for a record that is not saved yet,  surral-draft:<kind>:<userId>:new[-<variant>] */
export const draftKey = (kind: string, userId: string, id?: string, variant = "") => `${PREFIX}${kind}:${userId}:${id ?? (variant ? `new-${variant}` : "new")}`;

/** "17.11.2026 14:05" in the user's own time zone */
export const draftWhen = (iso: string) => {
  const d = new Date(iso), p = (v: number) => String(v).padStart(2, "0");
  return Number.isNaN(+d) ? "earlier" : `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

function readDraft<T>(key: string): Draft<T> | null {
  try {
    const d = JSON.parse(localStorage.getItem(key) ?? "null");
    return d && typeof d.savedAt === "string" && d.data && typeof d.data === "object" ? (d as Draft<T>) : null;
  } catch { return null; }
}
function removeDraft(key: string) { try { localStorage.removeItem(key); } catch { /* storage unavailable */ } }
function writeDraft<T>(key: string, data: T, baseUpdatedAt?: string, stripImages?: (d: T) => T) {
  const rec: Draft<T> = { savedAt: new Date().toISOString(), baseUpdatedAt, data };
  try { localStorage.setItem(key, JSON.stringify(rec)); return; } catch { /* usually the quota – try again without the photo */ }
  if (!stripImages) return;
  try { localStorage.setItem(key, JSON.stringify({ ...rec, imagesOmitted: true, data: stripImages(data) })); } catch { /* still too large: the previous draft, if any, stays */ }
}
/** drops this app's drafts that are older than 14 days or unreadable */
function pruneDrafts() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith(PREFIX)) keys.push(k); }
    for (const k of keys) { const d = readDraft(k); if (!d || !(Date.now() - +new Date(d.savedAt) < MAX_AGE_MS)) localStorage.removeItem(k); }
  } catch { /* storage unavailable */ }
}
/** removes every user's draft of one record on this browser – for the list pages, after a record is deleted */
export function forgetDrafts(kind: string, id: string) {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith(`${PREFIX}${kind}:`) && k.endsWith(`:${id}`)) keys.push(k); }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch { /* storage unavailable */ }
}

/**
 * key         – storage key (see draftKey); null switches drafts off (still loading, read-only user)
 * data        – everything needed to rebuild the form; memoise it, a new object means "the form changed"
 * active      – there is something worth keeping: meaningful input on a new record, unsaved changes on a saved one
 * stripImages – returns `data` without embedded base64 images, used when the full draft does not fit
 *
 * A draft found when the editor opens is only offered (`pending`); nothing is written or removed until the user
 * picks: resolve(true) after putting `pending.data` back into the form, resolve(false) to throw it away.
 */
export function useDraft<T>({ key, data, active, baseUpdatedAt, stripImages }: {
  key: string | null; data: T; active: boolean; baseUpdatedAt?: string; stripImages?: (d: T) => T;
}) {
  const [found, setFound] = useState<{ key: string; draft: Draft<T> | null } | null>(null);
  const ready = !!key && found?.key === key;        // storage has been looked at for this key
  const pending = ready ? found!.draft : null;

  const latest = useRef({ key, data, active, baseUpdatedAt, stripImages });
  useEffect(() => { latest.current = { key, data, active, baseUpdatedAt, stripImages }; });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mine = useRef(false);      // the stored draft was written (or taken over) by this editor, so it may remove it
  const stopped = useRef(false);   // the record was just created: write nothing more before the page changes

  const write = useCallback(() => {
    const l = latest.current;
    if (!l.key || !l.active || stopped.current) return;
    writeDraft(l.key, l.data, l.baseUpdatedAt, l.stripImages); mine.current = true;
  }, []);
  /** writes a change that is still waiting for the debounce – when leaving the page or closing the tab */
  const flush = useCallback(() => { if (!timer.current) return; clearTimeout(timer.current); timer.current = null; write(); }, [write]);

  useEffect(() => {
    if (!key) return;
    pruneDrafts();
    mine.current = false;
    setFound({ key, draft: readDraft<T>(key) });
  }, [key]);

  useEffect(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (!key || !ready || pending || stopped.current) return;
    if (!active) { if (mine.current) { removeDraft(key); mine.current = false; } return; }   // back to the saved / empty state
    timer.current = setTimeout(() => { timer.current = null; write(); }, DEBOUNCE_MS);
  }, [key, ready, pending, active, data, baseUpdatedAt, write]);

  useEffect(() => () => flush(), [flush]);   // in-app navigation: keep the last keystrokes too

  const warn = !!key && active;
  useEffect(() => {
    if (!warn) return;
    const onUnload = (e: BeforeUnloadEvent) => { flush(); if (!stopped.current) { e.preventDefault(); e.returnValue = true; } };
    window.addEventListener("beforeunload", onUnload); window.addEventListener("pagehide", flush);
    return () => { window.removeEventListener("beforeunload", onUnload); window.removeEventListener("pagehide", flush); };
  }, [warn, flush]);

  /** closes the offer: keep = the form now holds the draft (it stays stored and is updated from here on); otherwise it is deleted */
  const resolve = useCallback((keep: boolean) => {
    if (!key) return;
    if (keep) mine.current = true; else { removeDraft(key); mine.current = false; }
    setFound({ key, draft: null });
  }, [key]);
  /** after a successful save: forget the draft. stop = the editor is about to navigate away, do not write again. */
  const clear = useCallback((stop = false) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (stop) stopped.current = true;
    if (!key) return;
    removeDraft(key); mine.current = false;
    setFound({ key, draft: null });
  }, [key]);

  return { pending, resolve, clear };
}
