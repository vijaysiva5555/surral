import { NextResponse } from "next/server";
import { guard, handle } from "@/lib/api";
import { mailMode } from "@/lib/mail";
export const dynamic = "force-dynamic";
export const GET = () => handle(async () => { await guard(); return NextResponse.json({ mode: mailMode(), configured: mailMode() !== "off", from: process.env.MAIL_FROM ?? process.env.SMTP_USER ?? null }); });
