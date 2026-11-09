import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { guard, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { Company } from "@/models/Company";
import { GSTIN_RE, cleanGstin, stateFromGstin } from "@/lib/india";

export const dynamic = "force-dynamic";

export const GET = () => handle(async () => {
  await guard();
  await dbConnect();
  return NextResponse.json({ item: await Company.findOne().lean() });
});

const schema = z.object({
  name: z.string().trim().min(2, "Company name is required"),
  tagline: z.string().trim().default(""),
  addressLines: z.array(z.string().trim()).transform((a) => a.filter(Boolean)),
  gstin: z.string().transform(cleanGstin).refine((g) => g === "" || GSTIN_RE.test(g), "Invalid GSTIN format"),
  phone: z.string().trim().default(""), mobile: z.string().trim().default(""),
  website: z.string().trim().default(""), email: z.string().trim().default(""),
  quotePrefix: z.string().trim().min(1, "Quote prefix is required"),
  quoteStartNo: z.coerce.number().int().min(1).default(1),
  logoData: z.string().max(700_000).optional(), partnerLogoData: z.string().max(700_000).optional(),
  bank: z.object({ name: z.string().default(""), branch: z.string().default(""), accountNo: z.string().default(""), ifsc: z.string().default("") }).default({ name: "", branch: "", accountNo: "", ifsc: "" }),
});

export const PUT = (req: NextRequest) => handle(async () => {
  const session = await guard(["admin"]);
  const data = schema.parse(await req.json());
  await dbConnect();
  const doc = await Company.findOneAndUpdate({}, { ...data, ...stateFromGstin(data.gstin) }, { new: true, upsert: true });
  await audit(session, "update", "company", String(doc._id), "Company details updated");
  return NextResponse.json({ item: doc });
});
