/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { ProjectQuote } from "@/models/ProjectQuote";

export const dynamic = "force-dynamic";

/** turn the public link on/off and return the share token */
export const POST = (_: NextRequest, { params }: { params: { id: string } }) => handle(async () => {
  const session = await guard(["admin", "sales"]);
  await dbConnect();
  const q: any = await ProjectQuote.findById(params.id);
  if (!q) return NextResponse.json({ error: "Project offer not found" }, { status: 404 });
  if (!q.shareToken) q.shareToken = crypto.randomBytes(24).toString("base64url");
  q.shareExpiresAt = new Date(Date.now() + 90 * 86400000);
  await q.save();
  await audit(session, "share", "projectQuote", params.id, `Shared project offer ${q.number}`);
  return NextResponse.json({ token: q.shareToken, expiresAt: q.shareExpiresAt });
});

/** switch the link off */
export const DELETE = (_: NextRequest, { params }: { params: { id: string } }) => handle(async () => {
  await guard(["admin", "sales"]);
  await dbConnect();
  const q: any = await ProjectQuote.findById(params.id);
  if (!q) return NextResponse.json({ ok: true });
  q.shareToken = undefined;
  q.shareExpiresAt = undefined;
  await q.save();
  return NextResponse.json({ ok: true });
});
