/* Image upload to S3. kind=offer (project offer photos, admin/sales), kind=quote (Equipment/Spare quotation photos,
   admin/sales) or kind=logo (letterhead logos, admin). */
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { guard, guardAccess, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { putImage, sniffImage, type UploadFolder } from "@/lib/s3";

export const dynamic = "force-dynamic";
const MAX_BYTES = 4 * 1024 * 1024; // the browser shrinks images first; this is only a safety net

/** who may upload: Edit on the page the picture belongs to (Administration → Page access) */
const KINDS: Record<string, { folder: UploadFolder; pages: string[]; what: string }> = {
  offer: { folder: "offers", pages: ["projectQuotes"], what: "project offer photo" },
  logo: { folder: "logos", pages: ["company"], what: "letterhead logo" },
  quote: { folder: "quotes", pages: ["equipmentQuotes", "spareQuotes"], what: "quotation photo" },
};

export const POST = (req: NextRequest) => handle(async () => {
  const form = await req.formData();
  const kind = KINDS[String(form.get("kind") ?? "")];
  if (!kind) return NextResponse.json({ error: "Unknown upload type" }, { status: 400 });
  const session = await guardAccess(kind.pages);
  const file = form.get("file");
  if (!(file instanceof Blob) || !file.size) return NextResponse.json({ error: "Choose an image to upload" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image is too large (max 4 MB)" }, { status: 413 });
  const body = Buffer.from(await file.arrayBuffer());
  const type = sniffImage(body);
  if (!type) return NextResponse.json({ error: "Only image files can be uploaded" }, { status: 415 });
  const key = await putImage(kind.folder, body, type);
  // the file is already stored: a logging problem must not fail the upload
  try { await dbConnect(); await audit(session, "upload", "upload", key, `Uploaded ${kind.what} (${type.ext.toUpperCase()}, ${Math.max(1, Math.round(file.size / 1024))} KB)`); } catch (e) { console.error("audit failed", e); }
  return NextResponse.json({ key });
});
