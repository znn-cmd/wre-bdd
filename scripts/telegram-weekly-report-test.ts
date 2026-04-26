/**
 * One-off test: loads leads + audit from Sheets and sends the weekly ops report to Telegram
 * (TELEGRAM_WEEKLY_REPORT_CHAT_ID + bot token in env).
 *
 * Usage: npm run telegram-weekly-test
 *
 * Requires the same env as the app (Google Sheets + SESSION_JWT_SECRET, etc.).
 */
import { resolve } from "node:path";
import { config } from "dotenv";
import { getEnv } from "@/config/env";
import {
  batchLoadReference,
  getLeadsFresh,
  loadAuditLogPage,
} from "@/server/sheets/repository";
import { sendWeeklyOpsTelegramReport } from "@/server/telegram/weekly-ops-report";

const dotenvQuiet = { quiet: true as const };
config({ path: resolve(process.cwd(), ".env"), ...dotenvQuiet });
config({ path: resolve(process.cwd(), ".env.local"), override: true, ...dotenvQuiet });

async function main() {
  getEnv();
  const [leads, audit, ref] = await Promise.all([
    getLeadsFresh(),
    loadAuditLogPage({}),
    batchLoadReference(),
  ]);
  const result = await sendWeeklyOpsTelegramReport({
    leads,
    audit,
    statuses: ref.statuses,
    preamble: "🧪 Тестовое сообщение (telegram-weekly-report-test)",
  });
  if (!result.ok) {
    console.error("Send failed:", result.error);
    process.exit(1);
  }
  if (result.skipped) {
    console.warn("Skipped:", result.reason);
    process.exit(result.reason === "missing_chat_id" ? 1 : 0);
  }
  console.log("OK: weekly report sent.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
