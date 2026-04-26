import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const envSchema = z.object({
  GOOGLE_SHEETS_SPREADSHEET_ID: z.string().min(1),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().min(1),
  SESSION_JWT_SECRET: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().min(32),
  ),
  APP_BASE_URL: z.string().url().optional(),
  TELEGRAM_DEFAULT_BOT_TOKEN: z.string().optional(),
  /** Weekly ops report group/supergroup chat id (Bot API). */
  TELEGRAM_WEEKLY_REPORT_CHAT_ID: z.string().optional(),
  /** Optional separate bot for weekly report; falls back to TELEGRAM_DEFAULT_BOT_TOKEN. */
  TELEGRAM_WEEKLY_BOT_TOKEN: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

const buildStub: Env = {
  GOOGLE_SHEETS_SPREADSHEET_ID: "build-stub",
  GOOGLE_SERVICE_ACCOUNT_JSON: "{}",
  SESSION_JWT_SECRET: "0".repeat(32),
  APP_BASE_URL: "http://localhost:3000",
  TELEGRAM_DEFAULT_BOT_TOKEN: undefined,
  TELEGRAM_WEEKLY_REPORT_CHAT_ID: undefined,
  TELEGRAM_WEEKLY_BOT_TOKEN: undefined,
  NODE_ENV: "production",
};

/** Prefer file on disk (local dev); otherwise inline env (e.g. Vercel). */
export function resolveGoogleServiceAccountJsonString(): string | undefined {
  const filePath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_FILE?.trim();
  if (filePath) {
    const abs = resolve(process.cwd(), filePath);
    if (!existsSync(abs)) {
      throw new Error(`GOOGLE_SERVICE_ACCOUNT_JSON_FILE not found: ${abs}`);
    }
    return readFileSync(abs, "utf8").trim();
  }
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  return inline || undefined;
}

export function getEnv(): Env {
  if (cached) return cached;
  if (process.env.SKIP_ENV_VALIDATION === "1") {
    cached = buildStub;
    return cached;
  }
  const parsed = envSchema.safeParse({
    GOOGLE_SHEETS_SPREADSHEET_ID: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    GOOGLE_SERVICE_ACCOUNT_JSON: resolveGoogleServiceAccountJsonString(),
    SESSION_JWT_SECRET: process.env.SESSION_JWT_SECRET,
    APP_BASE_URL: process.env.APP_BASE_URL,
    TELEGRAM_DEFAULT_BOT_TOKEN: process.env.TELEGRAM_DEFAULT_BOT_TOKEN,
    TELEGRAM_WEEKLY_REPORT_CHAT_ID: process.env.TELEGRAM_WEEKLY_REPORT_CHAT_ID,
    TELEGRAM_WEEKLY_BOT_TOKEN: process.env.TELEGRAM_WEEKLY_BOT_TOKEN,
    NODE_ENV: process.env.NODE_ENV,
  });
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment: ${JSON.stringify(msg)}`);
  }
  cached = parsed.data;
  return cached;
}

export function getAppBaseUrl(): string {
  const e = process.env.APP_BASE_URL;
  if (e) return e.replace(/\/$/, "");
  if (process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, "");
  return "http://localhost:3000";
}
