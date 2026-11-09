/**
 * Fetches the per-part distributor discount from the Graco Partner Portal ("Quote & Order" page) for every
 * part number found in the India INR price-list Excel files, and saves it on the matching Part in MongoDB.
 *
 *   npm run fetch-discounts                                  all parts in both price lists in the project root
 *   npm run fetch-discounts -- --only 2000697,17H203 --no-db   quick test, prints the result, touches nothing
 *   npm run fetch-discounts -- --limit 100                   first 100 not-yet-fetched parts
 *   npm run fetch-discounts -- --sync-only                   push data/graco-discounts.json to MongoDB, no fetching
 *
 * PowerShell swallows the "--" and npm then eats the options. In PowerShell call tsx directly:
 *   npx tsx --env-file=.env.local scripts/fetchDiscounts.ts --only 2000697 --no-db
 *
 * Options
 *   --file <xlsx>        price-list file (repeatable). Default: every *India_INR*.xlsx in the project root
 *   --only <pn,pn,...>   fetch just these part numbers (ignores the Excel files)
 *   --limit <n>          stop after n requests
 *   --concurrency <n>    parallel requests (default 2)
 *   --delay <ms>         pause between requests per worker (default 250)
 *   --retry-missing      also re-fetch parts previously recorded as not-found / no-discount
 *   --refresh            re-fetch everything, ignoring the cache
 *   --no-db              only write the JSON cache, do not touch MongoDB
 *   --sync-only          do not call the portal, just copy cached discounts to MongoDB
 *   --max-misses <n>     abort after n consecutive "no product" answers (default 100, 0 = never) – protects against an expired session
 *   --verbose            log every part
 *
 * Needs GRACO_COOKIE and GRACO_CSRF_TOKEN in .env.local (copy them from a logged-in browser: see .env.example).
 * Progress is cached in data/graco-discounts.json after every few parts, so the run can be stopped and resumed.
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { dbConnect } from "../src/lib/db";
import { parsePriceWorkbook } from "../src/lib/priceImport";
import { Part } from "../src/models/Part";

const ROOT = path.resolve(__dirname, "..");
const CACHE_FILE = path.join(ROOT, "data", "graco-discounts.json");
const DEBUG_DIR = path.join(ROOT, "data", "graco-debug");
const BASE = process.env.GRACO_BASE_URL || "https://partnerportal.graco.com";
const LINE = process.env.GRACO_LINE_NUMBER || "3"; // same line number the browser used; only a UI slot id
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36";

type Status = "ok" | "no-discount" | "not-found";
type Entry = { status: Status; discountPct: number | null; netPrice: number | null; quantity: number | null; name: string; resolvedPn: string; message?: string; fetchedAt: string };
type Cache = Record<string, Entry>;

class SessionExpired extends Error {}

// ---------- args ----------
function parseArgs(argv: string[]) {
  const o = { files: [] as string[], only: [] as string[], limit: Infinity, concurrency: 2, delay: 250, retryMissing: false, refresh: false, noDb: false, syncOnly: false, maxMisses: 100, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => { const v = argv[++i]; if (v === undefined) throw new Error(`${a} needs a value`); return v; };
    if (a === "--file") o.files.push(val());
    else if (a === "--only") o.only.push(...val().split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean));
    else if (a === "--limit") o.limit = Number(val());
    else if (a === "--concurrency") o.concurrency = Math.max(1, Number(val()));
    else if (a === "--delay") o.delay = Math.max(0, Number(val()));
    else if (a === "--max-misses") o.maxMisses = Math.max(0, Number(val()));
    else if (a === "--retry-missing") o.retryMissing = true;
    else if (a === "--refresh") o.refresh = true;
    else if (a === "--no-db") o.noDb = true;
    else if (a === "--sync-only") o.syncOnly = true;
    else if (a === "--verbose") o.verbose = true;
    else throw new Error(`Unknown option ${a} (see the header of scripts/fetchDiscounts.ts)`);
  }
  return o;
}

// ---------- cache ----------
function loadCache(): Cache {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")); } catch { return {}; }
}
function saveCache(cache: Cache) {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  const tmp = CACHE_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(cache));
  fs.renameSync(tmp, CACHE_FILE);
}

// ---------- part numbers from the Excel files ----------
async function partNumbersFrom(files: string[]): Promise<string[]> {
  const list = files.length ? files : fs.readdirSync(ROOT).filter((f) => /India_INR.*\.xlsx$/i.test(f) && !f.startsWith("~$")).map((f) => path.join(ROOT, f));
  if (!list.length) throw new Error("No price-list .xlsx found. Pass --file <xlsx> or use --only <pn>.");
  const parsed = [];
  for (const f of list) {
    process.stdout.write(`Reading ${path.basename(f)} … `);
    const p = await parsePriceWorkbook(fs.readFileSync(f), path.basename(f));
    console.log(`${p.rows.length} rows (year ${p.year ?? "?"})`);
    parsed.push(p);
  }
  parsed.sort((a, b) => (b.year ?? 0) - (a.year ?? 0)); // newest list first, so current parts are fetched first
  const seen = new Set<string>();
  for (const p of parsed) for (const r of p.rows) seen.add(r.pn);
  return [...seen];
}

// ---------- portal ----------
const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

/** Pulls the <input type="hidden" name="product" data-discount="30.0" …> element out of the HTML fragment */
function parseProduct(html: string): { value: string; name: string; quantity: number | null; netPrice: number | null; discount: number | null } | null {
  const found: Record<string, string>[] = [];
  for (const tag of html.match(/<input\b[^>]*>/gi) ?? []) {
    const attrs: Record<string, string> = {};
    for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? "");
    if (attrs.name === "product" && ("data-discount" in attrs || "data-net-price" in attrs)) found.push(attrs);
  }
  if (!found.length) return null;
  const a = found[0];
  const num = (v: string | undefined) => { if (v === undefined || v.trim() === "") return null; const n = Number(v.replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
  return { value: (a.value ?? "").trim(), name: a["data-name"] ?? "", quantity: num(a["data-quantity"]), netPrice: num(a["data-net-price"]), discount: num(a["data-discount"]) };
}

/** The red message the portal shows for a part it cannot sell, e.g. "This item is no longer available for purchase." */
function parseMessage(html: string): string {
  const m = html.match(/<div class="color-bright-red">([\s\S]*?)<\/div>/i);
  return m ? decode(m[1].replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim() : "";
}

class CookieJar {
  private jar = new Map<string, string>();
  constructor(header: string) {
    for (const part of header.split(";")) { const i = part.indexOf("="); if (i > 0) this.jar.set(part.slice(0, i).trim(), part.slice(i + 1).trim()); }
  }
  header() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "); }
  update(setCookies: string[]) {
    for (const sc of setCookies) { const [kv] = sc.split(";"); const i = kv.indexOf("="); if (i > 0) this.jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim()); }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makeFetcher(cookie: CookieJar, csrf: string) {
  return async function fetchHtml(code: string): Promise<string> {
    const body = new URLSearchParams({ productCode: code, CSRFToken: csrf, quantity: "1" }).toString();
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await fetch(`${BASE}/quote-and-order?lineNumber=${LINE}`, {
          method: "POST",
          redirect: "manual",
          headers: {
            Accept: "*/*", "Accept-Language": "en-US,en;q=0.9", "Content-Type": "application/x-www-form-urlencoded",
            Cookie: cookie.header(), Origin: BASE, Referer: `${BASE}/quote-and-order`, "User-Agent": UA,
            "HX-Current-URL": `${BASE}/quote-and-order`, "HX-Request": "true", "HX-Target": `lineResult${LINE}`, "HX-Trigger": `lineCode${LINE}`, "HX-Trigger-Name": "productCode",
            "Sec-Fetch-Dest": "empty", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Site": "same-origin",
          },
          body,
        });
        cookie.update(res.headers.getSetCookie?.() ?? []);
        if (res.status >= 300 && res.status < 400) throw new SessionExpired(`Portal redirected to ${res.headers.get("location") ?? "?"} (HTTP ${res.status}) – the session cookie has probably expired.`);
        if (res.status === 401 || res.status === 403) throw new SessionExpired(`Portal answered HTTP ${res.status} – the session cookie / CSRF token is expired or invalid.`);
        if (res.status === 429 || res.status >= 500) {
          if (attempt >= 5) throw new Error(`HTTP ${res.status} after ${attempt} attempts`);
          const wait = Number(res.headers.get("retry-after")) * 1000 || 2000 * attempt;
          await sleep(wait); continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        if (/name=["']j_username["']|name=["']j_password["']|id=["']loginForm["']/i.test(html)) throw new SessionExpired("Portal returned the login page – the session cookie has expired.");
        return html;
      } catch (e) {
        if (e instanceof SessionExpired) throw e;
        if (attempt >= 5) throw e;
        await sleep(1500 * attempt); // network hiccup – retry
      }
    }
  };
}

// ---------- DB ----------
async function syncToDb(items: [string, Entry][]) {
  const ok = items.filter(([, e]) => e.status === "ok" && e.discountPct !== null);
  let matched = 0;
  for (let i = 0; i < ok.length; i += 500) {
    const res = await Part.bulkWrite(
      ok.slice(i, i + 500).map(([pn, e]) => ({
        updateMany: {
          filter: { pn },
          update: { $set: { partnerDiscountPct: e.discountPct, partnerNetPrice: e.netPrice, partnerResolvedPn: e.resolvedPn && e.resolvedPn !== pn ? e.resolvedPn : "", partnerDiscountAt: new Date(e.fetchedAt) } },
        },
      })),
      { ordered: false }
    );
    matched += res.matchedCount;
  }
  return { sent: ok.length, matched };
}

// ---------- main ----------
async function main() {
  const opt = parseArgs(process.argv.slice(2));
  const cache = loadCache();
  console.log(`Cache: ${Object.keys(cache).length} parts already fetched (${CACHE_FILE})`);

  if (opt.syncOnly) {
    await dbConnect();
    const r = await syncToDb(Object.entries(cache));
    console.log(`✔ synced ${r.sent} discounts → ${r.matched} Part documents updated`);
    await mongoose.disconnect();
    return;
  }

  const cookieStr = (process.env.GRACO_COOKIE ?? "").trim();
  const csrf = (process.env.GRACO_CSRF_TOKEN ?? "").trim();
  if (!cookieStr || !csrf) throw new Error("GRACO_COOKIE and GRACO_CSRF_TOKEN must be set in .env.local (see .env.example).");

  const all = opt.only.length ? opt.only : await partNumbersFrom(opt.files);
  const queue = all.filter((pn) => {
    const c = cache[pn];
    if (opt.refresh || opt.only.length) return true;
    if (!c) return true;
    return opt.retryMissing && c.status !== "ok";
  }).slice(0, Number.isFinite(opt.limit) ? opt.limit : undefined);
  console.log(`${all.length} part numbers · ${queue.length} to fetch · concurrency ${opt.concurrency} · delay ${opt.delay}ms`);
  if (!queue.length) { console.log("Nothing to fetch. (Use --retry-missing or --refresh to go again.)"); }

  const useDb = !opt.noDb;
  if (useDb) await dbConnect();

  const fetchHtml = makeFetcher(new CookieJar(cookieStr), csrf);
  const stats = { ok: 0, noDiscount: 0, notFound: 0, errors: 0 };
  const pending: [string, Entry][] = [];
  const missRun: string[] = [];
  let next = 0, done = 0, misses = 0, fatal: Error | null = null, lastFlush = Date.now(), debugSaved = 0;
  const started = Date.now();
  const verbose = opt.verbose || queue.length <= 50;

  const flush = async () => {
    saveCache(cache);
    if (useDb && pending.length) { const batch = pending.splice(0); await syncToDb(batch); }
    lastFlush = Date.now();
  };
  const onStop = async () => { console.log("\nStopping – saving progress …"); try { await flush(); } finally { process.exit(130); } };
  process.once("SIGINT", onStop);

  async function worker() {
    while (!fatal) {
      const i = next++;
      if (i >= queue.length) return;
      const pn = queue[i];
      try {
        const html = await fetchHtml(pn);
        const p = parseProduct(html);
        let entry: Entry;
        if (!p) {
          const message = parseMessage(html);
          entry = { status: "not-found", discountPct: null, netPrice: null, quantity: null, name: "", resolvedPn: "", message, fetchedAt: new Date().toISOString() };
          stats.notFound++;
          // An explicit portal message ("no longer available…") is a genuine answer. Only an empty/unknown reply counts towards the session-expired check.
          if (message) { misses = 0; missRun.length = 0; } else { misses++; missRun.push(pn); }
          if (!message && debugSaved < 3) { fs.mkdirSync(DEBUG_DIR, { recursive: true }); fs.writeFileSync(path.join(DEBUG_DIR, `${pn.replace(/[^\w.-]/g, "_")}.html`), html); debugSaved++; }
        } else {
          misses = 0; missRun.length = 0;
          const status: Status = p.discount === null ? "no-discount" : "ok";
          entry = { status, discountPct: p.discount, netPrice: p.netPrice, quantity: p.quantity, name: p.name, resolvedPn: p.value, fetchedAt: new Date().toISOString() };
          if (status === "ok") stats.ok++; else stats.noDiscount++;
        }
        cache[pn] = entry;
        pending.push([pn, entry]);
        if (verbose) console.log(`[${done + 1}/${queue.length}] ${pn} → ${entry.status === "ok" ? `${entry.discountPct}%  net ${entry.netPrice}  ${entry.name}${entry.resolvedPn && entry.resolvedPn !== pn ? `  (portal item ${entry.resolvedPn})` : ""}` : `${entry.status}${entry.message ? ` – ${entry.message}` : ""}`}`);
        if (opt.maxMisses && misses >= opt.maxMisses) {
          // do not remember the streak as real "not-found" results – they are probably session failures
          for (const m of missRun) { delete cache[m]; const k = pending.findIndex(([x]) => x === m); if (k >= 0) pending.splice(k, 1); }
          stats.notFound -= missRun.length; missRun.length = 0;
          fatal = new SessionExpired(`${misses} parts in a row returned no product – the session has most likely expired (see data/graco-debug/*.html). Refresh GRACO_COOKIE / GRACO_CSRF_TOKEN, or use --max-misses 0 to ignore.`);
        }
      } catch (e) {
        if (e instanceof SessionExpired) { fatal = e; break; }
        stats.errors++;
        console.error(`\n! ${pn}: ${(e as Error).message} (will be retried next run)`);
      }
      done++;
      if (!verbose && done % 25 === 0) {
        const rate = done / ((Date.now() - started) / 1000);
        process.stdout.write(`\r${done}/${queue.length} · ok ${stats.ok} · no-discount ${stats.noDiscount} · not-found ${stats.notFound} · err ${stats.errors} · ${rate.toFixed(1)}/s · ETA ${Math.round((queue.length - done) / rate / 60)} min   `);
      }
      if (pending.length >= 200 || Date.now() - lastFlush > 15000) await flush();
      if (opt.delay) await sleep(opt.delay);
    }
  }

  await Promise.all(Array.from({ length: Math.min(opt.concurrency, Math.max(queue.length, 1)) }, worker));
  await flush();
  console.log(`\n${fatal ? "✖ aborted" : "✔ done"}: ok ${stats.ok} · no-discount ${stats.noDiscount} · not-found ${stats.notFound} · errors ${stats.errors}`);
  if (useDb) console.log(`MongoDB: Part.partnerDiscountPct updated from ${Object.values(cache).filter((e) => e.status === "ok").length} cached parts`);
  else console.log("MongoDB not touched (--no-db). Run with --sync-only to push the cache later.");
  if (fatal) console.error(`\n${(fatal as Error).message}\nProgress is saved – fix the session in .env.local and run the same command again to resume.`);
  if (useDb) await mongoose.disconnect();
  if (fatal) process.exit(2);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
