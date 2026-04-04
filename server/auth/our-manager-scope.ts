import { parseSheetBool } from "@/lib/dates";
import {
  leadCountryMatchesPartner,
  partnerOperatingCountryCodes,
  partnerVisibleToSourceManager,
} from "@/lib/partners";
import type {
  CountryRow,
  LeadRow,
  PartnerRow,
  SessionUser,
  SourceManagerRow,
  StatusRow,
} from "@/types/models";

/** Same shape as `batchLoadReference()` result — used for scope + UI narrowing. */
export type SheetReferenceBundle = {
  partners: PartnerRow[];
  countries: CountryRow[];
  sourceManagers: SourceManagerRow[];
  statuses: StatusRow[];
};

export function parseScopeTokens(raw: string): string[] {
  return raw
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normCountry(code: string): string {
  return (code ?? "").trim().toUpperCase();
}

function activeCountryCodes(countries: CountryRow[]): Set<string> {
  const s = new Set<string>();
  for (const c of countries) {
    if (!parseSheetBool(c.active_flag)) continue;
    const code = normCountry(c.country_code);
    if (code) s.add(code);
  }
  return s;
}

/**
 * Effective countries + partner ids for `our_manager`.
 * - `Source_Managers.country_scope`: `*` or empty = all active countries; else comma-separated codes.
 * - `Source_Managers.partner_scope`: `*` or empty = all active partners in those countries; else explicit partner ids.
 * - `Users.allowed_country_codes` / `allowed_partner_ids` (session) further narrow when non-empty.
 * Missing/inactive SM row: falls back to session allow-lists only; if those are empty, scope is empty (no access).
 */
export function resolveOurManagerScope(
  user: SessionUser,
  ref: SheetReferenceBundle,
): { countryCodes: Set<string>; partnerIds: Set<string> } {
  const activeCc = activeCountryCodes(ref.countries);

  const sm = ref.sourceManagers.find(
    (s) => s.source_manager_id.trim() === user.sourceManagerId.trim(),
  );
  const smActive = sm ? parseSheetBool(sm.active_flag) : false;

  let countrySet: Set<string>;

  if (sm && smActive) {
    const raw = (sm.country_scope ?? "").trim();
    if (!raw || raw === "*") {
      countrySet = new Set(activeCc);
    } else {
      countrySet = new Set();
      for (const t of parseScopeTokens(raw)) {
        const c = normCountry(t);
        if (activeCc.has(c)) countrySet.add(c);
      }
    }
  } else {
    countrySet = new Set(
      user.allowedCountryCodes.map((x) => normCountry(x)).filter(Boolean),
    );
    countrySet = new Set([...countrySet].filter((c) => activeCc.has(c)));
  }

  if (user.allowedCountryCodes.length > 0) {
    const narrow = new Set(
      user.allowedCountryCodes.map((x) => normCountry(x)).filter(Boolean),
    );
    countrySet = new Set([...countrySet].filter((c) => narrow.has(c)));
  }

  let partners = ref.partners.filter((p) => {
    if (!parseSheetBool(p.active_flag)) return false;
    const op = partnerOperatingCountryCodes(p);
    if (!op.some((c) => countrySet.has(c))) return false;
    return partnerVisibleToSourceManager(p, user.sourceManagerId);
  });

  if (sm && smActive) {
    const ps = (sm.partner_scope ?? "").trim();
    if (ps && ps !== "*") {
      const allow = new Set(parseScopeTokens(ps));
      partners = partners.filter((p) => allow.has(p.partner_id.trim()));
    }
  }

  if (user.allowedPartnerIds.length > 0) {
    const ap = new Set(user.allowedPartnerIds.map((x) => x.trim()).filter(Boolean));
    partners = partners.filter((p) => ap.has(p.partner_id.trim()));
  }

  return {
    countryCodes: countrySet,
    partnerIds: new Set(partners.map((p) => p.partner_id.trim())),
  };
}

export function ourManagerLeadAllowedByScope(
  user: SessionUser,
  lead: LeadRow,
  ref: SheetReferenceBundle,
): boolean {
  const scope = resolveOurManagerScope(user, ref);
  if (scope.countryCodes.size === 0 || scope.partnerIds.size === 0) return false;
  const pid = (lead.partner_id ?? "").trim();
  if (!scope.partnerIds.has(pid)) return false;
  const cc = normCountry(lead.country_code);
  if (!scope.countryCodes.has(cc)) return false;
  const partner = ref.partners.find((p) => p.partner_id.trim() === pid);
  if (!partner || !parseSheetBool(partner.active_flag)) return false;
  return leadCountryMatchesPartner(lead.country_code, partner);
}

/** Countries / partners for dropdowns (active + role scope). */
export function narrowReferenceForLeadsUi(
  user: SessionUser,
  ref: SheetReferenceBundle,
): {
  partners: {
    partner_id: string;
    partner_name: string;
    country_code: string;
    operating_country_codes: string[];
  }[];
  countries: { country_code: string; country_name: string }[];
  statuses: StatusRow[];
} {
  const countriesBase = ref.countries.filter((c) => parseSheetBool(c.active_flag));
  const partnersBase = ref.partners.filter((p) => parseSheetBool(p.active_flag));

  const mapPartner = (p: PartnerRow) => ({
    partner_id: p.partner_id,
    partner_name: p.partner_name,
    country_code: p.country_code,
    operating_country_codes: partnerOperatingCountryCodes(p),
  });

  if (user.role !== "our_manager") {
    return {
      countries: countriesBase.map((c) => ({
        country_code: c.country_code,
        country_name: c.country_name,
      })),
      partners: partnersBase.map(mapPartner),
      statuses: ref.statuses,
    };
  }

  const scope = resolveOurManagerScope(user, ref);
  const countries = countriesBase
    .filter((c) => scope.countryCodes.has(normCountry(c.country_code)))
    .map((c) => ({
      country_code: c.country_code,
      country_name: c.country_name,
    }));
  const partners = partnersBase
    .filter((p) => scope.partnerIds.has(p.partner_id.trim()))
    .map(mapPartner);

  return { countries, partners, statuses: ref.statuses };
}
