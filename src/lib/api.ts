import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";

export type Role = "admin" | "sales" | "viewer";

/** Returns the session, or throws a ready-made NextResponse for 401/403 */
export async function guard(roles?: Role[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (roles && !roles.includes(session.user.role)) throw NextResponse.json({ error: "Not allowed" }, { status: 403 });
  return session;
}

export function handle(fn: () => Promise<Response>) {
  return fn().catch((e) => {
    if (e instanceof Response) return e;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = e as any;
    if (err?.name === "ZodError") return NextResponse.json({ error: err.issues?.[0]?.message ?? "Invalid data" }, { status: 400 });
    if (err?.code === 11000) return NextResponse.json({ error: "Duplicate value (already exists)" }, { status: 409 });
    console.error(e);
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: 500 });
  });
}
