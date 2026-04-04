import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE_NAME } from "@/config/constants";
import { getSessionJwtSecretBytes } from "@/lib/session-jwt-secret";

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname.startsWith("/app")) {
    // RSC/segment prefetch often omits cookies; auth runs in Server Components.
    // Without this, users get redirected to /access/invalid while navigating.
    const prefetch = request.headers.get("next-router-prefetch");
    if (prefetch === "1" || prefetch === "2") {
      return NextResponse.next();
    }

    const qToken = searchParams.get("token");
    if (qToken) {
      const url = request.nextUrl.clone();
      url.pathname = `/access/${encodeURIComponent(qToken)}`;
      url.search = "";
      return NextResponse.redirect(url);
    }

    const raw = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!raw) {
      return NextResponse.redirect(new URL("/access/invalid", request.url));
    }
    try {
      await jwtVerify(raw, getSessionJwtSecretBytes());
      return NextResponse.next();
    } catch {
      const res = NextResponse.redirect(new URL("/access/invalid", request.url));
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
