"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAfter, isValid, parseISO } from "date-fns";
import { SESSION_COOKIE_NAME } from "@/config/constants";
import { parseSheetBool } from "@/lib/dates";
import { normalizeLogin, verifyUserPassword } from "@/lib/password";
import { findUserByLogin } from "@/server/sheets/repository";
import { signSessionJwtForUserRow } from "@/server/auth/session-from-user";

export type LoginFormState = { error: string } | null;

export async function loginWithPasswordAction(
  _prev: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const login = normalizeLogin(String(formData.get("login") ?? ""));
  const password = String(formData.get("password") ?? "");
  if (!login || !password) {
    return { error: "Enter login and password." };
  }

  const user = await findUserByLogin(login);
  if (!user || !parseSheetBool(user.is_active)) {
    return { error: "Invalid login or password." };
  }

  if (!(await verifyUserPassword(user.password ?? "", password))) {
    return { error: "Invalid login or password." };
  }

  if (user.token_expires_at?.trim()) {
    try {
      const exp = parseISO(user.token_expires_at.trim());
      if (isValid(exp) && isAfter(new Date(), exp)) {
        return { error: "Your account link has expired. Ask an administrator." };
      }
    } catch {
      /* ignore */
    }
  }

  let jwt: string;
  try {
    jwt = await signSessionJwtForUserRow(user);
  } catch {
    return { error: "Invalid login or password." };
  }

  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect("/app/dashboard");
}
