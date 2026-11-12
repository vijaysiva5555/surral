/* Server only: file storage in Amazon S3. Every upload lives under the project folder (AWS_S3_PREFIX, "surral"). */
import { randomUUID } from "node:crypto";
import { DeleteObjectsCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export const S3_PREFIX = (process.env.AWS_S3_PREFIX || "surral").replace(/^\/+|\/+$/g, "");
const BUCKET = process.env.AWS_S3_BUCKET ?? "";

let client: S3Client | null = null;
function s3() {
  if (!BUCKET || !process.env.AWS_REGION) throw new Error("File storage is not configured (AWS_S3_BUCKET / AWS_REGION).");
  return (client ??= new S3Client({ region: process.env.AWS_REGION }));
}

export type UploadFolder = "offers" | "logos";
export type ImageType = { ext: "jpg" | "png"; mime: "image/jpeg" | "image/png" };

/** recognise an image by its first bytes, never by the name or the browser-declared type */
export function sniffImage(b: Buffer): ImageType | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (b.length > 8 && b.readUInt32BE(0) === 0x89504e47 && b.readUInt32BE(4) === 0x0d0a1a0a) return { ext: "png", mime: "image/png" };
  return null;
}

/** a key this app created: surral/<folder>/<yyyy>/<uuid>.<jpg|png> */
export const isOwnKey = (key: string, folder?: UploadFolder) =>
  key.startsWith(`${S3_PREFIX}/`) &&
  new RegExp(String.raw`^(${folder ?? "offers|logos"})/\d{4}/[0-9a-f-]{36}\.(jpg|png)$`).test(key.slice(S3_PREFIX.length + 1));

export async function putImage(folder: UploadFolder, body: Buffer, type: ImageType): Promise<string> {
  const key = `${S3_PREFIX}/${folder}/${new Date().getFullYear()}/${randomUUID()}.${type.ext}`;
  await s3().send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: type.mime, CacheControl: "max-age=31536000, immutable" }));
  return key;
}

export async function getObject(key: string): Promise<{ body: Buffer; type: string } | null> {
  try {
    const r = await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    return { body: Buffer.from(await r.Body!.transformToByteArray()), type: r.ContentType ?? "application/octet-stream" };
  } catch (e) {
    if ((e as { name?: string }).name === "NoSuchKey") return null;
    throw e;
  }
}

/** best effort: a failed clean-up must never fail the save that triggered it */
export async function deleteObjects(keys: string[]) {
  const own = [...new Set(keys.filter((k) => isOwnKey(k)))];
  if (!own.length) return;
  try { await s3().send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: own.map((Key) => ({ Key })) } })); }
  catch (e) { console.error("S3 clean-up failed", e); }
}
