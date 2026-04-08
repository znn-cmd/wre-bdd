import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/config/constants";

export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}
