import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// A separate, Edge-safe NextAuth instance (no Prisma/bcrypt in this bundle)
// used only to decode the session JWT for route protection.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = Boolean(req.auth);
  const { pathname } = req.nextUrl;
  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (!isLoggedIn && !isAuthPage) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  // API routes handle their own auth() checks and return proper JSON 401s
  // instead of an HTML redirect, so they're excluded here.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
