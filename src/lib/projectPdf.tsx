/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import ProjectQuotePdf from "@/components/pdf/ProjectQuotePdf";
import { loadBranding } from "@/lib/branding";

export async function renderProjectQuotePdf(q: any): Promise<Buffer> {
  const { logo } = await loadBranding();
  return renderToBuffer(<ProjectQuotePdf q={q} logo={logo} />);
}
