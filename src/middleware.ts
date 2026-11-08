import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
  });

  const path = req.nextUrl.pathname;
  const isAuth = path.startsWith("/login") || path.startsWith("/register");
  const isPublic =
    isAuth ||
    path === "/" ||
    path.startsWith("/site") ||
    path.startsWith("/shop") ||
    path.startsWith("/portal") ||
    path.startsWith("/suspended") ||
    path.startsWith("/api/auth") ||
    path.startsWith("/api/org-logo") ||
    path.startsWith("/api/platform-logo") ||
    path.startsWith("/api/webhooks/");

  if (!token && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (token && isAuth) {
    const url = req.nextUrl.clone();
    url.pathname =
      token.role === "SUPER_ADMIN"
        ? "/admin"
        : token.role === "DEPARTMENT_USER"
          ? "/department"
          : "/inbox";
    return NextResponse.redirect(url);
  }

  if (token && path.startsWith("/admin") && token.role !== "SUPER_ADMIN") {
    const url = req.nextUrl.clone();
    url.pathname = "/inbox";
    return NextResponse.redirect(url);
  }

  if (
    token &&
    token.role !== "SUPER_ADMIN" &&
    token.organizationStatus === "SUSPENDED" &&
    !path.startsWith("/suspended") &&
    !path.startsWith("/api/auth") &&
    !isAuth
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/suspended";
    return NextResponse.redirect(url);
  }

  if (token?.role === "SUPER_ADMIN" && (path.startsWith("/inbox") || path.startsWith("/dashboard"))) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
