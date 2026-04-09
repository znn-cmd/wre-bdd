/**
 * Rules for when to send `notifyPartnerNewLead` (Telegram).
 *
 * The trigger is `transfer_status` on the Leads row matching a configured code
 * from the Statuses sheet (category `transfer_status`), e.g. `sent` = "Sent to partner".
 */

export function transferStatusCodesTriggeringPartnerTelegram(): Set<string> {
  const raw = process.env.TELEGRAM_NOTIFY_TRANSFER_STATUS_CODES?.trim();
  if (!raw) return new Set(["sent"]);
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function userRoleMayTriggerPartnerTelegramNotify(role: string): boolean {
  return (
    role === "our_manager" ||
    role === "admin" ||
    role === "rop" ||
    role === "partner_dept_manager"
  );
}
