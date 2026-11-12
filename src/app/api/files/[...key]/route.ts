/* Serves uploaded files from S3. Logos are public (they appear on shared quotation links);
   offer photos need a signed-in user (customers get them inside the PDF). */
import { NextResponse } from "next/server";
import { guard, handle } from "@/lib/api";
import { S3_PREFIX, getObject, isOwnKey } from "@/lib/s3";

export const dynamic = "force-dynamic";

export const GET = (_req: Request, { params }: { params: { key: string[] } }) => handle(async () => {
  const key = params.key.join("/");
  if (!isOwnKey(key)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isPublic = key.startsWith(`${S3_PREFIX}/logos/`);
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
