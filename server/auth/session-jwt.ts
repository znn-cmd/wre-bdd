import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@/types/roles";
import { getEnv } from "@/config/env";
import { getSessionJwtSecretBytes } from "@/lib/session-jwt-secret";

import { SESSION_COOKIE_NAME } from "@/config/constants";

export const COOKIE_NAME = SESSION_COOKIE_NAME;

export type SessionPayload = {
  sub: string;
  name: string;
  role: UserRole;
  partnerId: string;
  sourceManagerId: string;
  countries: string;
  partners: string;
};

function secretKey() {
  getEnv();
  return getSessionJwtSecretBytes();
}

export async function signSession(payload: SessionPayload, maxAgeSec: number) {
  return new SignJWT({
    name: payload.name,
    role: payload.role,
    partnerId: payload.partnerId,
    sourceManagerId: payload.sourceManagerId,
    countries: payload.countries,
    partners: payload.partners,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSec}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, secretKey());
  const sub = typeof payload.sub === "string" ? payload.sub : "";
  const name = typeof payload.name === "string" ? payload.name : "";
  const role = payload.role as UserRole;
  const partnerId =
    typeof payload.partnerId === "string" ? payload.partnerId : "";
  const sourceManagerId =
    typeof payload.sourceManagerId === "string" ? payload.sourceManagerId : "";
  const countries =
    typeof payload.countries === "string" ? payload.countries : "";
  const partners = typeof payload.partners === "string" ? payload.partners : "";
  if (!sub || !role) return null;
  return {
    userId: sub,
    fullName: name,
    role,
    partnerId,
    sourceManagerId,
    allowedCountryCodes: countries
      ? countries.split(",").map((s) => s.trim()).filter(Boolean)
      : [],
    allowedPartnerIds: partners
      ? partners.split(",").map((s) => s.trim()).filter(Boolean)
      : [],
  };
}
