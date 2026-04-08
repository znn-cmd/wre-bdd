import type { UserRole } from "./roles";

export type LeadRow = {
  lead_id: string;
  crm_deal_id: string;
  created_at: string;
  updated_at: string;
  created_by_user_id: string;
  updated_by_user_id: string;
  created_by_role: string;
  country_code: string;
  country_name: string;
  partner_id: string;
  partner_name: string;
  partner_manager_name: string;
  source_manager_id: string;
  source_manager_name: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  client_language: string;
  service_type: string;
  source_channel: string;
  transfer_status: string;
  partner_status: string;
  final_outcome: string;
  lead_priority: string;
  sent_to_partner_at: string;
  partner_accepted_at: string;
  partner_rejected_at: string;
  first_contact_at: string;
  in_progress_at: string;
  proposal_sent_at: string;
  contract_signed_at: string;
  closed_lost_at: string;
  last_update_at: string;
  contract_amount_local: string;
  contract_currency: string;
  fx_rate_to_usd: string;
  contract_amount_usd: string;
  commission_percent: string;
  commission_amount_local: string;
  commission_amount_usd: string;
  manager_comment: string;
  partner_comment: string;
  rejection_reason: string;
  loss_reason: string;
  is_archived: string;
  tags: string;
  hidden_meta_json: string;
};

export type UserRow = {
  user_id: string;
  full_name: string;
  role: UserRole | string;
  is_active: string;
  token_hash: string;
  token_last_rotated_at: string;
  token_expires_at: string;
  partner_id: string;
  source_manager_id: string;
  allowed_country_codes: string;
  allowed_partner_ids: string;
  telegram_chat_id_optional: string;
  dashboard_preset_json: string;
  created_at: string;
  updated_at: string;
};

/** Subset passed to the Users admin UI (avoids huge / sensitive fields breaking RSC serialization). */
export type UserListRow = Pick<
  UserRow,
  | "user_id"
  | "full_name"
  | "role"
  | "is_active"
  | "partner_id"
  | "source_manager_id"
  | "allowed_country_codes"
  | "allowed_partner_ids"
  | "token_last_rotated_at"
  | "created_at"
  | "updated_at"
>;

export type PartnerRow = {
  partner_id: string;
  partner_name: string;
  /** Legacy / display: keep in sync with first entry in `country_codes` when possible. */
  country_code: string;
  /** Comma-separated extra countries (union with `country_code`). Empty = use `country_code` only. */
  country_codes: string;
  /** Comma-separated `source_manager_id`; empty = any our_manager allowed by geography. */
  source_manager_ids: string;
  active_flag: string;
  owner_name: string;
  telegram_bot_token: string;
  telegram_chat_id: string;
  notification_enabled: string;
  default_currency: string;
  notes: string;
};

export type CountryRow = {
  country_code: string;
  country_name: string;
  local_currency: string;
  fx_rate_to_usd: string;
  active_flag: string;
};

export type SourceManagerRow = {
  source_manager_id: string;
  source_manager_name: string;
  active_flag: string;
  country_scope: string;
  partner_scope: string;
};

export type PartnerManagerRow = {
  partner_manager_id: string;
  partner_id: string;
  partner_manager_name: string;
  active_flag: string;
};

export type StatusRow = {
  category: string;
  status_code: string;
  status_label: string;
  status_description: string;
  sort_order: string;
  is_final: string;
  active_flag: string;
  /** Display hint in tables: empty = default; yellow | green | red = bold colored text. */
  color: string;
};

export type AuditLogRow = {
  log_id: string;
  timestamp: string;
  lead_id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  action_type: string;
  field_name: string;
  old_value: string;
  new_value: string;
  comment: string;
  ip_optional: string;
  user_agent_optional: string;
};

export type TelegramLogRow = {
  telegram_log_id: string;
  timestamp: string;
  lead_id: string;
  partner_id: string;
  recipient_chat_id: string;
  message_text: string;
  status: string;
  error_message: string;
};

export type SystemSettingRow = {
  key: string;
  value: string;
  comment: string;
};

export type ViewsConfigRow = {
  config_id: string;
  user_id: string;
  role: string;
  config_key: string;
  config_json: string;
  updated_at: string;
};

export type SessionUser = {
  userId: string;
  fullName: string;
  role: UserRole;
  partnerId: string;
  sourceManagerId: string;
  allowedCountryCodes: string[];
  allowedPartnerIds: string[];
};
