import type { Session } from "next-auth";
/* eslint-disable @typescript-eslint/no-explicit-any */
export const canEditQuote = (s: Session, q: any) => s.user.role === "admin" || (s.user.role === "sales" && q.createdBy === s.user.id);
