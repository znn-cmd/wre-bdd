import { getEnv } from "@/config/env";
import {
  computeWeeklyReportStats,
  formatWeeklyReportMessage,
  buildWeeklyReportWindow,
  buildWeeklyReportTelegramParts,
  expandWeeklyPartsForTelegramLimit,
} from "@/lib/weekly-report-stats";
import { appendTelegramLogRow, newLogId } from "@/server/sheets/repository";
import { transferStatusCodesTriggeringPartnerTelegram } from "@/server/telegram/notify-rules";
import { nowIso } from "@/lib/dates";
import type { AuditLogRow, LeadRow, StatusRow } from "@/types/models";

const TG_API = "https://api.telegram.org";

async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = `${TG_API}/bot${botToken}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json()) as { ok?: boolean; description?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.description ?? res.statusText };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export type WeeklyOpsReportResult =
  | { ok: true; skipped?: false }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string };

/**
 * Отчёт в TELEGRAM_WEEKLY_REPORT_CHAT_ID: сначала общий блок, затем отдельное сообщение на каждую страну.
 * Очень длинная страна режется на несколько фрагментов по лимиту Telegram.
 */
export async function sendWeeklyOpsTelegramReport(opts: {
  leads: LeadRow[];
  audit: AuditLogRow[];
  statuses: StatusRow[];
  /** prepended to the first message only */
  preamble?: string;
}): Promise<WeeklyOpsReportResult> {
  const env = getEnv();
  const chatId = env.TELEGRAM_WEEKLY_REPORT_CHAT_ID?.trim() ?? "";
  const defaultToken = env.TELEGRAM_DEFAULT_BOT_TOKEN?.trim();
  const weeklyToken = env.TELEGRAM_WEEKLY_BOT_TOKEN?.trim();
  const botToken = weeklyToken || defaultToken;

  const periodEnd = new Date();
  const window = buildWeeklyReportWindow(periodEnd, 7);
  const stats = computeWeeklyReportStats(opts.leads, opts.audit, {
    window,
    transferTriggerCodes: transferStatusCodesTriggeringPartnerTelegram(),
  });
  const parts = buildWeeklyReportTelegramParts(stats, opts.statuses);
  if (opts.preamble?.trim()) {
    parts[0] = `${opts.preamble.trim()}\n\n${parts[0]}`;
  }
  const chunks = expandWeeklyPartsForTelegramLimit(parts);
  const reportJoined = formatWeeklyReportMessage(stats, opts.statuses);
  const fullText = [opts.preamble?.trim(), reportJoined]
    .filter(Boolean)
    .join("\n\n──────────\n\n");

  const logBase = {
    telegram_log_id: newLogId("TG"),
    timestamp: nowIso(),
    lead_id: "",
    partner_id: "",
    recipient_chat_id: chatId || "",
    message_text: fullText,
    status: "",
    error_message: "",
  };

  if (!chatId) {
    await appendTelegramLogRow({
      ...logBase,
      status: "skipped",
      error_message: "TELEGRAM_WEEKLY_REPORT_CHAT_ID is not set",
    });
    return { ok: true, skipped: true, reason: "missing_chat_id" };
  }

  if (!botToken) {
    await appendTelegramLogRow({
      ...logBase,
      status: "skipped",
      error_message:
        "No bot token (set TELEGRAM_WEEKLY_BOT_TOKEN or TELEGRAM_DEFAULT_BOT_TOKEN)",
    });
    return { ok: true, skipped: true, reason: "missing_bot_token" };
  }

  if (chunks.length === 0) {
    await appendTelegramLogRow({
      ...logBase,
      status: "skipped",
      error_message: "Empty report body",
    });
    return { ok: true, skipped: true, reason: "empty_body" };
  }

  const n = chunks.length;
  for (let i = 0; i < n; i++) {
    const part =
      n > 1 ? `${chunks[i]}\n\n📎 ${i + 1}/${n}` : chunks[i]!;
    let attempt = await sendTelegramMessage(botToken, chatId, part);
    if (!attempt.ok) {
      attempt = await sendTelegramMessage(botToken, chatId, part);
    }
    if (!attempt.ok) {
      await appendTelegramLogRow({
        ...logBase,
        status: "failed_retry",
        error_message: `[part ${i + 1}/${n}] ${attempt.error}`,
      });
      return { ok: false, error: attempt.error };
    }
  }

  await appendTelegramLogRow({ ...logBase, status: "sent", error_message: "" });
  return { ok: true };
}
