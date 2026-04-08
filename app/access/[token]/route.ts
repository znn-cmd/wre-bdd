import { NextRequest, NextResponse } from "next/server";
import { isAfter, isValid, parseISO } from "date-fns";
import { hashAccessToken } from "@/lib/token";
import { findUserByTokenHash } from "@/server/sheets/repository";
import { signSessionJwtForUserRow } from "@/server/auth/session-from-user";
import { SESSION_COOKIE_NAME } from "@/config/constants";
import { parseSheetBool } from "@/lib/dates";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token: encoded } = await ctx.params;
  const rawToken = decodeURIComponent(encoded ?? "").trim();
  if (!rawToken) {
    return NextResponse.redirect(new URL("/access/invalid", _req.url));
  }

  try {
    const user = await findUserByTokenHash(hashAccessToken(rawToken));
    if (!user || !parseSheetBool(user.is_active)) {
      const url = new URL("/access/invalid", _req.url);
      // People often paste token_hash (64 hex) into the URL; the path must be the *plain* secret token.
      if (/^[0-9a-f]{64}$/i.test(rawToken)) {
        url.searchParams.set("reason", "hash-in-url");
      }
      return NextResponse.redirect(url);
    }
    if (user.token_expires_at?.trim()) {
      try {
        const exp = parseISO(user.token_expires_at.trim());
        if (isValid(exp) && isAfter(new Date(), exp)) {
          return NextResponse.redirect(new URL("/access/invalid", _req.url));
        }
      } catch {
        /* ignore parse errors */
      }
    }
    let jwt: string;
    try {
      jwt = await signSessionJwtForUserRow(user);
    } catch {
      return NextResponse.redirect(new URL("/access/invalid", _req.url));
    }

    const res = NextResponse.redirect(new URL("/app/dashboard", _req.url));
    res.cookies.set(SESSION_COOKIE_NAME, jwt, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch {
    return NextResponse.redirect(new URL("/access/invalid", _req.url));
  }
}
