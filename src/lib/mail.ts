import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";

/** The only mail this app sends is the optional password-reset link. */
const mailMode = () => (process.env.MAIL_TRANSPORT === "file" ? "file" : process.env.SMTP_HOST ? "smtp" : "off");
export const mailConfigured = () => mailMode() !== "off";
export const appUrl = () => (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

type Mail = { to: string[]; subject: string; text: string };
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const linkify = (s: string) => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, "<br>");

export async function sendMail(m: Mail) {
  const mode = mailMode();
  if (mode === "off") throw new Error("E-mail is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS and MAIL_FROM in the environment.");
  const from = process.env.MAIL_FROM ?? process.env.SMTP_USER ?? "no-reply@surral.in";
  if (mode === "file") {   // development: write the message to .mail-outbox/ instead of sending it
    const dir = path.join(process.cwd(), ".mail-outbox"); fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 6)}.json`);
    fs.writeFileSync(f, JSON.stringify({ from, ...m, html: linkify(m.text) }, null, 2));
    return;
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  const t = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
  await t.sendMail({ from, to: m.to, subject: m.subject, text: m.text, html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">${linkify(m.text)}</div>` });
}
