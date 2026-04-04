import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE_NAME } from "@/config/constants";

function jwtSecret() {
  const s = process.env.SESSION_JWT_SECRET ?? "";
  return new TextEncoder().encode(s.length >= 32 ? s : "0".repeat(32));
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname.startsWith("/app")) {
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
      await jwtVerify(raw, jwtSecret());
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
