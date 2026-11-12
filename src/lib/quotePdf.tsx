/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import QuotePdf from "@/components/pdf/QuotePdf";
import { loadBranding, loadImage, type Img } from "@/lib/branding";

export async function renderQuotePdf(q: any): Promise<Buffer> {
  // uploaded photos live in S3; fetch them in parallel (a missing one is simply left out)
  const [{ logo, partner }, images] = await Promise.all([
    loadBranding(),
    Promise.all((q.images ?? []).map(loadImage)).then((xs) => xs.filter(Boolean) as Img[]),
  ]);
  return renderToBuffer(<QuotePdf q={q} logo={logo} graco={partner} images={images} />);
}
