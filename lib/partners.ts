import type { PartnerRow } from "@/types/models";

function normCountry(code: string): string {
  return (code ?? "").trim().toUpperCase();
}

/** Split scope-like CSV from sheet cells. */
export function parsePartnerList(raw: string): string[] {
  return raw
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * All country codes where the partner operates: union of `country_code` and `country_codes`.
 */
export function partnerOperatingCountryCodes(p: PartnerRow): string[] {
  const set = new Set<string>();
  const one = (p.country_code ?? "").trim();
  if (one) set.add(normCountry(one));
  const multi = (p.country_codes ?? "").trim();
  for (const x of parsePartnerList(multi)) {
    const c = normCountry(x);
    if (c) set.add(c);
  }
  return [...set];
}

export function partnerPrimaryCountryCode(p: PartnerRow): string {
  return partnerOperatingCountryCodes(p)[0] ?? "";
}

/** Human label for tables (e.g. "DE / AE"). */
export function partnerCountriesLabel(p: PartnerRow): string {
  return partnerOperatingCountryCodes(p).join(" / ") || "—";
}

/**
 * If `source_manager_ids` is empty, any our_manager matching geography may use the partner.
 * Otherwise only listed `source_manager_id` values.
 */
export function partnerVisibleToSourceManager(
  p: PartnerRow,
  sourceManagerId: string,
): boolean {
  const raw = (p.source_manager_ids ?? "").trim();
  if (!raw) return true;
  const sm = sourceManagerId.trim();
  if (!sm) return false;
  return parsePartnerList(raw).some((id) => id.trim() === sm);
}

export function leadCountryMatchesPartner(
  leadCountryCode: string,
  p: PartnerRow,
): boolean {
  const cc = normCountry(leadCountryCode);
  if (!cc) return false;
  return partnerOperatingCountryCodes(p).includes(cc);
}
