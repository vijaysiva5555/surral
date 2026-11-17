import { withAuth } from "next-auth/middleware";
// Pages are protected here (redirect to /login). API routes are excluded on purpose: each one calls guard()
// and answers with a JSON 401/403, which is what fetch() callers expect.
export default withAuth({ pages: { signIn: "/login" } });
export const config = { matcher: ["/((?!login|forgot|reset/|q/|pq/|api|_next|favicon.ico|.*\\.(?:png|jpg|svg|ico)).*)"] };
