import { z } from "zod";

export const createLeadSchema = z.object({
  crm_deal_id: z.string().max(200).optional().default(""),
  country_code: z.string().min(2).max(8),
  partner_id: z.string().min(1).max(64),
  client_name: z.string().min(1).max(300),
  client_phone: z.string().max(80).optional().default(""),
  client_email: z.union([z.literal(""), z.string().email()]).default(""),
  client_language: z.string().max(40).optional().default(""),
  service_type: z.string().max(120).optional().default(""),
  source_channel: z.string().max(120).optional().default(""),
  transfer_status: z.string().max(80).optional().default("new"),
  partner_status: z.string().max(80).optional().default(""),
  lead_priority: z.string().max(40).optional().default(""),
  contract_amount_local: z.string().max(40).optional().default(""),
  contract_currency: z.string().max(16).optional().default(""),
  fx_rate_to_usd: z.string().max(40).optional().default(""),
  commission_percent: z.string().max(40).optional().default(""),
  manager_comment: z.string().max(5000).optional().default(""),
  tags: z.string().max(500).optional().default(""),
});

export const patchLeadSchema = z
  .record(z.string(), z.string())
  .refine((o) => Object.keys(o).length > 0, "empty patch");

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
