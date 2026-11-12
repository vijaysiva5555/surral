/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import ProjectQuotePdf from "@/components/pdf/ProjectQuotePdf";
import { loadBranding, loadImage, type Img } from "@/lib/branding";

export async function renderProjectQuotePdf(q: any): Promise<Buffer> {
  // offer images live in S3; fetch them all in parallel (a missing one is simply left out)
  const [{ logo }, offerImages] = await Promise.all([
    loadBranding(),
    Promise.all((q.offers ?? []).map(async (o: any) => (await Promise.all((o.images ?? []).map(loadImage))).filter(Boolean) as Img[])),
  ]);
  return renderToBuffer(<ProjectQuotePdf q={q} logo={logo} offerImages={offerImages} />);
}
