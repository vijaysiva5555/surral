/** width/height of a PNG or JPEG buffer (no dependencies) */
export function imageSize(b: Buffer): { width: number; height: number } {
  try {
    if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1], len = b.readUInt16BE(i + 2);
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
        i += 2 + len;
      }
    }
  } catch { /* fall through */ }
  return { width: 100, height: 100 };
}
export const fit = (img: { width: number; height: number }, maxW: number, maxH: number) => { const k = Math.min(maxW / img.width, maxH / img.height); return { width: Math.round(img.width * k * 10) / 10, height: Math.round(img.height * k * 10) / 10 }; };
