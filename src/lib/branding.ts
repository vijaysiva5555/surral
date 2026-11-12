/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "node:fs";
import path from "node:path";
import { dbConnect } from "./db";
import { imageSize } from "./imageSize";
import { Company } from "@/models/Company";
import { getObject, isOwnKey, sniffImage } from "./s3";

export type Img = { data: Buffer; format: "png" | "jpg"; width: number; height: number };

export function fromDataUrl(u?: string | null): Img | null {
  const m = String(u ?? "").match(/^data:image\/(png|jpe?g);base64,(.+)$/);
  if (!m) return null;
  const data = Buffer.from(m[2], "base64");
  return { data, format: m[1] === "png" ? "png" : "jpg", ...imageSize(data) };
}
function fromPublic(f: string): Img | null {
  try { const data = fs.readFileSync(path.join(process.cwd(), "public", f)); return { data, format: "png", ...imageSize(data) }; } catch { return null; }
}

const cache = new Map<string, Img>();   // S3 keys are never overwritten, so a fetched image can be kept
/** a stored image value – an S3 key (current uploads) or a data URL (older records) – as PDF-ready bytes */
export async function loadImage(v?: string | null): Promise<Img | null> {
  if (!v) return null;
  if (v.startsWith("data:")) return fromDataUrl(v);
  if (!isOwnKey(v)) return null;
  const hit = cache.get(v);
  if (hit) return hit;
  try {
    const obj = await getObject(v);
    const type = obj && sniffImage(obj.body);
    if (!obj || !type) return null;
    const img: Img = { data: obj.body, format: type.ext, ...imageSize(obj.body) };
    if (cache.size > 200) cache.clear();
    cache.set(v, img);
    return img;
  } catch (e) { console.error("Could not load image from S3", v, e); return null; }
}

/** Letterhead images: the ones uploaded on the Company page, otherwise the bundled defaults */
export async function loadBranding(): Promise<{ logo: Img | null; partner: Img | null }> {
  let c: any = null;
  try { if (process.env.MONGODB_URI) { await dbConnect(); c = await Company.findOne().select("logoData partnerLogoData").lean(); } } catch { /* use defaults */ }
  const [logo, partner] = await Promise.all([loadImage(c?.logoData), loadImage(c?.partnerLogoData)]);
  return { logo: logo ?? fromPublic("sscpl-logo.png"), partner: partner ?? fromPublic("graco-logo.png") };
}
