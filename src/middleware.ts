import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/pricing",
  "/features",
  "/blog",
  "/tools",
  "/compare",
  "/platforms",
  "/ai-agents",
  "/terms",
  "/privacy",
  "/contact",
  "/affiliates",
  "/faqs",
];

const AUTH_ROUTES = ["/login", "/register"];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const path = nextUrl.pathname;

  // Allow public routes and API routes
  const isPublic =
    PUBLIC_ROUTES.some((r) => path === r || path.startsWith(r + "/")) ||
    path.startsWith("/api/auth") ||
    path.startsWith("/api/v1") ||
    path.startsWith("/api/mcp") ||
    path.startsWith("/api/webhooks");

  if (isPublic) return NextResponse.next();

  // Redirect logged-in users away from auth pages
  if (isLoggedIn && AUTH_ROUTES.some((r) => path.startsWith(r))) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  // Require auth for dashboard and app routes
  if (!isLoggedIn && path.startsWith("/dashboard")) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
