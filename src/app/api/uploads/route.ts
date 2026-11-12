/* Image upload to S3. kind=offer (project offer photos, admin/sales) or kind=logo (letterhead logos, admin). */
import { NextRequest, NextResponse } from "next/server";
import { guard, handle } from "@/lib/api";
import { putImage, sniffImage, type UploadFolder } from "@/lib/s3";

export const dynamic = "force-dynamic";
const MAX_BYTES = 4 * 1024 * 1024; // the browser shrinks images first; this is only a safety net

const KINDS: Record<string, { folder: UploadFolder; roles: ("admin" | "sales")[] }> = {
  offer: { folder: "offers", roles: ["admin", "sales"] },
  logo: { folder: "logos", roles: ["admin"] },
};

export const POST = (req: NextRequest) => handle(async () => {
  const form = await req.formData();
  const kind = KINDS[String(form.get("kind") ?? "")];
  if (!kind) return NextResponse.json({ error: "Unknown upload type" }, { status: 400 });
  await guard(kind.roles);
  const file = form.get("file");
  if (!(file instanceof Blob) || !file.size) return NextResponse.json({ error: "Choose an image to upload" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image is too large (max 4 MB)" }, { status: 413 });
  const body = Buffer.from(await file.arrayBuffer());
  const type = sniffImage(body);
  if (!type) return NextResponse.json({ error: "Only image files can be uploaded" }, { status: 415 });
  const key = await putImage(kind.folder, body, type);
  return NextResponse.json({ key });
});
