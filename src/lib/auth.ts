import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { dbConnect } from "./db";
import { User } from "@/models/User";
import { tooMany, clearHits } from "./rateLimit";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        if (!creds?.email || !creds.password) return null;
        const email = creds.email.toLowerCase().trim(), key = `login:${email}`;
        if (tooMany(key, 8, 15 * 60_000)) return null;   // 8 attempts per 15 min per e-mail
        await dbConnect();
        const u = await User.findOne({ email, active: true });
        if (!u || !(await bcrypt.compare(creds.password, u.passwordHash))) return null;
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
