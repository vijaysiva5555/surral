import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { dbConnect } from "./db";
import { User } from "@/models/User";
import { AuditLog } from "@/models/AuditLog";
import { tooMany, clearHits } from "./rateLimit";
import { normUsername } from "./username";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: { username: {}, password: {} },
      async authorize(raw) {
        // users sign in with their username; an address with "@" is still looked up by e-mail so nobody is locked out
        const creds = raw as Record<string, string> | undefined;
        const login = normUsername(creds?.username ?? creds?.email), password = creds?.password;
        if (!login || !password) return null;
        const key = `login:${login}`;
        if (tooMany(key, 8, 15 * 60_000)) return null;   // 8 attempts per 15 min per sign-in name
        await dbConnect();
        const u = await User.findOne(login.includes("@") ? { email: login, active: true } : { username: login, active: true });
        if (!u) return null;
        const ok = await bcrypt.compare(password, u.passwordHash);
        // audit trail: sign-ins, and failed attempts on a real account (never what was typed)
        await AuditLog.create({ userId: String(u._id), userName: u.name, role: u.role, action: ok ? "login" : "login-failed", entity: "user", entityId: String(u._id),
          summary: ok ? `${u.username || u.email} signed in` : `Failed sign-in for ${u.username || u.email} (wrong password)` }).catch((e) => console.error("audit failed", e));
        if (!ok) return null;
        clearHits(key);
        return { id: String(u._id), name: u.name, email: u.email, role: u.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.id = user.id; token.role = user.role; }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
};
