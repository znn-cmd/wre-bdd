import { NextResponse } from "next/server";
import { formatSlotKeyMsk } from "@/lib/weekly-report-stats";
import { getEnv } from "@/config/env";
import {
  TELEGRAM_WEEKLY_REPORT_IDEMPOTENCY_KEY,
  batchLoadReference,
  getSystemSettings,
  getLeadsFresh,
  loadAuditLogPage,
  upsertSystemSetting,
} from "@/server/sheets/repository";
import { sendWeeklyOpsTelegramReport } from "@/server/telegram/weekly-ops-report";

export const dynamic = "force-dynamic";

/**
 * Без CRON_SECRET: в production принимаем только запросы с User-Agent Vercel Cron
 * (`vercel-cron/1.0`). В dev/preview — любой GET (локальная отладка).
 * UA подделываем; для строгой защиты позже можно добавить CRON_SECRET в проект.
 */
function isAllowedCronRequest(request: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const ua = request.headers.get("user-agent") ?? "";
  return ua.startsWith("vercel-cron/");
}

export async function GET(request: Request) {
  if (!isAllowedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  getEnv();

  const slotKey = formatSlotKeyMsk(new Date());
  const settings = await getSystemSettings();
  const prevSlot = settings.find(
    (s) => s.key.trim() === TELEGRAM_WEEKLY_REPORT_IDEMPOTENCY_KEY,
  )?.value?.trim();
  if (prevSlot === slotKey) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "idempotent_slot",
      slotKey,
    });
  }

  const [leads, audit, ref] = await Promise.all([
    getLeadsFresh(),
    loadAuditLogPage({}),
    batchLoadReference(),
  ]);

  const result = await sendWeeklyOpsTelegramReport({
    leads,
    audit,
    statuses: ref.statuses,
  });

  if (result.ok && !result.skipped) {
    await upsertSystemSetting({
      key: TELEGRAM_WEEKLY_REPORT_IDEMPOTENCY_KEY,
      value: slotKey,
      comment: "MSK yyyy-MM-dd-HH of last successful weekly ops Telegram report",
    });
  }

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, slotKey },
      { status: 500 },
    );
  }

  if (result.skipped) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: result.reason,
      slotKey,
    });
  }

  return NextResponse.json({ ok: true, slotKey });
}
