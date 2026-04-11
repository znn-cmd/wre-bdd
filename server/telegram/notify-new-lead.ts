import { getAppBaseUrl, getEnv } from "@/config/env";
import type { LeadRow } from "@/types/models";
import type { PartnerRow } from "@/types/models";
import { appendTelegramLogRow, newLogId } from "@/server/sheets/repository";
import { nowIso } from "@/lib/dates";

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
    disable_web_page_preview: false,
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

export async function notifyPartnerNewLead(opts: {
  lead: LeadRow;
  partner: PartnerRow;
}): Promise<void> {
  const env = getEnv();
  const defaultToken = env.TELEGRAM_DEFAULT_BOT_TOKEN?.trim();
  const partnerToken = (opts.partner.telegram_bot_token ?? "").trim();
  const botToken = partnerToken || defaultToken;
  const chatId = (opts.partner.telegram_chat_id ?? "").trim();

  const base = getAppBaseUrl();
  const leadUrl = `${base}/app/leads/${encodeURIComponent(opts.lead.lead_id)}`;

  const mc = (opts.lead.manager_comment ?? "").trim();
  const mcShort =
    mc.length > 600 ? `${mc.slice(0, 600)}…` : mc;
  const text = [
    `New lead: ${opts.partner.partner_name}`,
    `Country: ${opts.lead.country_name || opts.lead.country_code}`,
    `Client: ${opts.lead.client_name}`,
    `Phone: ${(opts.lead.client_phone ?? "").trim() || "—"}`,
    (opts.lead.client_email ?? "").trim()
      ? `Email: ${opts.lead.client_email}`
      : null,
    (opts.lead.client_language ?? "").trim()
      ? `Language: ${opts.lead.client_language}`
      : null,
    mcShort ? `WRE manager comment: ${mcShort}` : null,
    `Our manager: ${opts.lead.source_manager_name}`,
    `Created: ${opts.lead.created_at}`,
    `Open: ${leadUrl}`,
    `CRM: ${opts.lead.crm_deal_id || "—"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const logBase = {
    telegram_log_id: newLogId("TG"),
    timestamp: nowIso(),
    lead_id: opts.lead.lead_id,
    partner_id: opts.partner.partner_id,
    recipient_chat_id: chatId || "",
    message_text: text,
    status: "",
    error_message: "",
  };

  if (!botToken || !chatId) {
    await appendTelegramLogRow({
      ...logBase,
      status: "skipped",
      error_message: "Missing bot token or chat_id (set TELEGRAM_DEFAULT_BOT_TOKEN env and partner telegram_chat_id)",
    });
    return;
  }

  const attempt = await sendTelegramMessage(botToken, chatId, text);
  if (attempt.ok) {
    await appendTelegramLogRow({ ...logBase, status: "sent", error_message: "" });
    return;
  }

  await appendTelegramLogRow({
    ...logBase,
    status: "failed",
    error_message: attempt.error,
  });

  const retry = await sendTelegramMessage(botToken, chatId, text);
  if (retry.ok) {
    await appendTelegramLogRow({
      ...logBase,
      telegram_log_id: newLogId("TG"),
      status: "sent_retry",
      error_message: "",
    });
  } else {
    await appendTelegramLogRow({
      ...logBase,
      telegram_log_id: newLogId("TG"),
      status: "failed_retry",
      error_message: retry.error,
    });
  }
}
