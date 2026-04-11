/** Roles that must not receive full `client_phone` in leads UI / audit (masked like partner). */
export function shouldMaskClientPhoneForRole(role: string): boolean {
  return role === "partner" || role === "our_manager";
}

/**
 * For Google Sheets: a leading `+` can make Sheets treat the cell like a formula.
 * Store digits/symbols without a leading plus (strip all leading `+`).
 */
export function normalizePhoneForSheetStorage(phone: string): string {
  let s = String(phone ?? "").trim();
  while (s.startsWith("+")) {
    s = s.slice(1).trimStart();
  }
  return s;
}

/**
 * For outbound messages (e.g. Telegram): show international prefix as a single leading `+`.
 * Accepts sheet values with or without `+`.
 */
export function formatPhoneLeadingPlusForExternal(phone: string): string {
  const normalized = normalizePhoneForSheetStorage(phone);
  if (!normalized) return "";
  return `+${normalized}`;
}

/**
 * Hide digits except the last 4 of the digit run.
 * Non-digit characters are ignored for counting; if there are no digits,
 * falls back to masking all but the last 4 characters of the raw string.
 */
export function maskPhoneLastFourDigits(phone: string): string {
  const raw = String(phone ?? "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) {
    if (raw.length <= 4) return raw.length > 0 ? "*".repeat(raw.length) : "";
    return "*".repeat(raw.length - 4) + raw.slice(-4);
  }
  const last4 = digits.slice(-4);
  const nStars = Math.max(0, digits.length - 4);
  return "*".repeat(nStars) + last4;
}

/** Apply {@link maskPhoneLastFourDigits} to `client_phone` (partner / our_manager lists). */
export function redactLeadPhoneForPartner<T extends { client_phone: string }>(
  lead: T,
): T {
  return {
    ...lead,
    client_phone: maskPhoneLastFourDigits(lead.client_phone),
  };
}
