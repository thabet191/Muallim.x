import type { NextAuthConfig } from "next-auth";

// Edge-safe base config (no Prisma/bcrypt imports) shared by the full
// auth.ts (Node runtime) and middleware.ts (Edge runtime). Middleware only
// needs to decode the JWT session, not run the Credentials provider.
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.role = user.role;
        token.id = user.id;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "STUDENT" | "ADMIN";
      }
      return session;
    },
  },
};
