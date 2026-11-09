import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { AuditLog } from "@/models/AuditLog";

export const dynamic = "force-dynamic";
export const GET = (req: NextRequest) => handle(async () => {
  await guard(["admin"]);
  await dbConnect();
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1), limit = 50;
  const [total, items] = await Promise.all([AuditLog.countDocuments(), AuditLog.find().sort({ at: -1 }).skip((page - 1) * limit).limit(limit).lean()]);
  return NextResponse.json({ items, total, page, pages: Math.ceil(total / limit) });
});
