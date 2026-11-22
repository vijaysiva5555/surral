/* eslint-disable @typescript-eslint/no-explicit-any */
import { dbConnect } from "./db";
import { AppSetting } from "@/models/AppSetting";
import { resolveAccess, type AccessMap } from "./pageAccess";

let cache: { at: number; access: AccessMap } | null = null;
const TTL = 15_000;

/** the page access the admin configured (or the defaults), cached for a few seconds */
export async function getPageAccess(): Promise<AccessMap> {
  if (cache && Date.now() - cache.at < TTL) return cache.access;
  await dbConnect();
  const doc = await AppSetting.findOne({ key: "pageAccess" }).lean<any>();
  const access = resolveAccess(doc?.value);
  cache = { at: Date.now(), access };
  return access;
}

export async function savePageAccess(access: AccessMap, by: string): Promise<AccessMap> {
  await dbConnect();
  const clean = resolveAccess(access);
  await AppSetting.updateOne({ key: "pageAccess" }, { $set: { value: clean, updatedByName: by } }, { upsert: true });
  cache = { at: Date.now(), access: clean };
  return clean;
}
