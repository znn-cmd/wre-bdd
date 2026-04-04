# Telegram setup

## Behavior

When an **our manager** (or admin / ROP / partner dept manager) **creates** a lead, the app:

1. Resolves `partner_id` on the new row.
2. Loads the partner row from `Partners`.
3. Chooses **bot token**:
   - `Partners.telegram_bot_token` if non-empty
   - otherwise `TELEGRAM_DEFAULT_BOT_TOKEN` from environment
4. Sends `sendMessage` to `Partners.telegram_chat_id`.
5. Appends a row to `Telegram_Log` (`sent`, `failed`, or `skipped`).

## Recommended security layout

| Secret | Where to store | Why |
|--------|----------------|-----|
| Bot token (shared) | **Vercel env** `TELEGRAM_DEFAULT_BOT_TOKEN` | Not duplicated in Sheets; easy rotation |
| Chat per partner | **`Partners.telegram_chat_id`** | Non-secret routing target |
| Bot token per partner | `Partners.telegram_bot_token` | Only if you truly need different bots |

**Avoid** putting the **only** copy of a highly sensitive token only in Sheets if the spreadsheet has broad human access. Prefer env for the default bot; keep chat IDs in the sheet.

## Message contents

Includes partner name, country, CRM id, client name/phone, service, source manager, created time, and a deep link:

`{APP_BASE_URL}/app/leads/{lead_id}`

## Retries

On first failure, the service attempts **one** additional send and logs under `Telegram_Log.status` `failed_retry` / `sent_retry` as appropriate.

## Bot setup (Telegram)

1. Talk to [@BotFather](https://t.me/BotFather), create a bot, copy the token → env or sheet.
2. Obtain **chat_id** for the partner channel/user (forward a message to userinfobot or use `getUpdates` after the bot receives a message).
3. Put `chat_id` in `Partners.telegram_chat_id` for that partner.
