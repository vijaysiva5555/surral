/* Serves uploaded files from S3. Logos and Equipment/Spare quotation photos are public (they appear on the shared
   quotation page; keys are random UUIDs); project offer photos need a signed-in user (customers get them in the PDF). */
import { NextResponse } from "next/server";
import { guard, handle } from "@/lib/api";
import { S3_PREFIX, getObject, isOwnKey } from "@/lib/s3";

export const dynamic = "force-dynamic";

export const GET = (_req: Request, { params }: { params: { key: string[] } }) => handle(async () => {
  const key = params.key.join("/");
  if (!isOwnKey(key)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isPublic = key.startsWith(`${S3_PREFIX}/logos/`) || key.startsWith(`${S3_PREFIX}/quotes/`);
  if (!isPublic) await guard();
  const obj = await getObject(key);
  if (!obj) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(obj.body), {
    headers: {
      "Content-Type": obj.type,
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=31536000, immutable`, // keys are unique, never overwritten
      "X-Content-Type-Options": "nosniff",
    },
  });
});
