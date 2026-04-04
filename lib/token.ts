import { createHash, randomBytes } from "crypto";

export function hashAccessToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

/** URL-safe random token (show once to admin; store only hash in sheet). */
export function generateAccessToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
