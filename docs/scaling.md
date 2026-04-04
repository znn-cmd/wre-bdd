# Scaling after MVP

## Limits of Google Sheets

- Read/write latency and quota per minute.
- Row scan cost grows linearly; “full table” reads do not scale to very large datasets.
- No transactions; concurrent edits last-write-wins at row level.

## Near-term mitigations (already partially in code)

- `unstable_cache` on reference data (`getCachedPartners`, countries, statuses).
- `revalidateTag` after mutations for lead list freshness.
- Repository abstraction (`server/sheets/*`) isolates persistence from UI.

## Medium-term

- **Dashboard_Cache** tab or Vercel KV / Redis for pre-aggregated KPIs refreshed on a schedule or on write.
- Split **hot** lead index (e.g. last 90 days) vs **archive** sheet to shrink reads.

## Long-term: PostgreSQL

1. Mirror schema 1:1 with typed tables.
2. Replace `repository.ts` methods with SQL implementations behind the same function signatures.
3. Keep `Audit_Log` append-only; consider event stream (SQS / PubSub) for high volume.
4. Move **secrets** (bot tokens) to a vault; keep only chat routing in DB if needed.

## Telegram at scale

- Queue outbound messages; worker with backoff.
- Deduplicate by `(lead_id, event_type)` if retries multiply.
