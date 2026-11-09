/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import QuotePdf from "@/components/pdf/QuotePdf";
import { loadBranding } from "@/lib/branding";

export async function renderQuotePdf(q: any): Promise<Buffer> {
  const { logo, partner } = await loadBranding();
  return renderToBuffer(<QuotePdf q={q} logo={logo} graco={partner} />);
}
