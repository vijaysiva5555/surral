/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { canEditQuote } from "@/lib/quoteAccess";
import { appUrl } from "@/lib/url";
import { Quote } from "@/models/Quote";
import { ensureShare } from "@/lib/share";

type Ctx = { params: { id: string } };
const info = (q: any) => ({ enabled: !!q.shareToken, url: q.shareToken ? `${appUrl()}/q/${q.shareToken}` : null, expiresAt: q.shareExpiresAt ?? null, views: q.shareViews ?? 0, lastViewedAt: q.shareLastViewedAt ?? null });

export const GET = (_: NextRequest, { params }: Ctx) => handle(async () => {
  await guard(); await dbConnect();
  const q: any = await Quote.findById(params.id).lean();
  return q ? NextResponse.json(info(q)) : NextResponse.json({ error: "Quotation not found" }, { status: 404 });
});

export const POST = (_: NextRequest, { params }: Ctx) => handle(async () => {
  const session = await guard(["admin", "sales"]); await dbConnect();
  const q: any = await Quote.findById(params.id);
  if (!q) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  if (!canEditQuote(session, q)) return NextResponse.json({ error: "You can only share your own quotations" }, { status: 403 });
  const had = !!q.shareToken; await ensureShare(q);
  if (!had) await audit(session, "share", "quote", params.id, `Created share link for ${q.number}`);
  return NextResponse.json(info(q));
});

export const DELETE = (_: NextRequest, { params }: Ctx) => handle(async () => {
  const session = await guard(["admin", "sales"]); await dbConnect();
  const q: any = await Quote.findById(params.id);
  if (!q) return NextResponse.json({ ok: true });
  if (!canEditQuote(session, q)) return NextResponse.json({ error: "You can only change your own quotations" }, { status: 403 });
  q.shareToken = undefined; q.shareExpiresAt = undefined; await q.save();
  await audit(session, "unshare", "quote", params.id, `Disabled share link for ${q.number}`);
  return NextResponse.json(info(q));
});
