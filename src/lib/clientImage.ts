/** Resize an uploaded image in the browser. PNG keeps transparency (logos); JPEG is smaller (photos). */
export async function resizeImage(file: File, max = 900, type: "image/jpeg" | "image/png" = "image/jpeg"): Promise<string> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  const ctx = c.getContext("2d")!;
  if (type === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
  return type === "image/png" ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.85);
}

/** Shrink an image in the browser, then store it in S3 (via /api/uploads). Returns the stored key. */
export async function uploadImage(file: File, kind: "offer" | "quote" | "logo", max = 1400, type: "image/jpeg" | "image/png" = "image/jpeg"): Promise<string> {
  const dataUrl = await resizeImage(file, max, type);
  const blob = await (await fetch(dataUrl)).blob();
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", blob, `${file.name.replace(/\.[^.]+$/, "")}.${type === "image/png" ? "png" : "jpg"}`);
  const res = await fetch("/api/uploads", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Upload failed (${res.status})`);
  return data.key as string;
}
