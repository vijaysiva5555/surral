/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "node:fs";
import path from "node:path";
import { dbConnect } from "./db";
import { imageSize } from "./imageSize";
import { Company } from "@/models/Company";

export type Img = { data: Buffer; format: "png" | "jpg"; width: number; height: number };

function fromDataUrl(u?: string | null): Img | null {
  const m = String(u ?? "").match(/^data:image\/(png|jpe?g);base64,(.+)$/);
  if (!m) return null;
  const data = Buffer.from(m[2], "base64");
  return { data, format: m[1] === "png" ? "png" : "jpg", ...imageSize(data) };
}
function fromPublic(f: string): Img | null {
  try { const data = fs.readFileSync(path.join(process.cwd(), "public", f)); return { data, format: "png", ...imageSize(data) }; } catch { return null; }
}

/** Letterhead images: the ones uploaded on the Company page, otherwise the bundled defaults */
export async function loadBranding(): Promise<{ logo: Img | null; partner: Img | null }> {
  let c: any = null;
  try { if (process.env.MONGODB_URI) { await dbConnect(); c = await Company.findOne().select("logoData partnerLogoData").lean(); } } catch { /* use defaults */ }
  return { logo: fromDataUrl(c?.logoData) ?? fromPublic("sscpl-logo.png"), partner: fromDataUrl(c?.partnerLogoData) ?? fromPublic("graco-logo.png") };
}
