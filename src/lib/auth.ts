import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { Role, TenantStatus } from "@prisma/client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const email = credentials?.email as string | undefined;
          const password = credentials?.password as string | undefined;
          if (!email || !password) return null;

          const user = await db.user.findUnique({
            where: { email: email.toLowerCase() },
            include: { organization: true },
          });
          if (!user || !user.active) return null;

          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            organizationId: user.organizationId,
            organizationName: user.organization?.name ?? null,
            organizationStatus: user.organization?.status ?? null,
            organizationSlug: user.organization?.slug ?? null,
            departmentId: user.departmentId ?? null,
          };
        } catch (err) {
          console.error("[auth.authorize] failed:", err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role as Role;
        token.organizationId = user.organizationId ?? null;
        token.organizationName = user.organizationName ?? null;
        token.organizationStatus = (user.organizationStatus as TenantStatus) ?? null;
        token.organizationSlug = user.organizationSlug ?? null;
        token.departmentId = user.departmentId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.organizationId = token.organizationId;
        session.user.organizationName = token.organizationName;
        session.user.organizationStatus = token.organizationStatus;
        session.user.organizationSlug = token.organizationSlug;
        session.user.departmentId = token.departmentId ?? null;
      }
      return session;
    },
  },
});
