
# WhatsApp Messaging Suite

A new Marketing → WhatsApp module that mirrors the Email Marketing suite, with two sender modes:

- **Business** — Meta WhatsApp Cloud API (verified business number). Used for broadcasts, automations, system notifications, and the shared inbox.
- **Personal** — `wa.me` click-to-chat links. Used when a team member wants to message a client from their own phone (no automation possible, one tap per message).

## What you need from Meta (one-time setup)

Before automation works, you (or Sadeco) must complete these on Meta:

1. Create a **Meta Business account** + **Meta App** (type: Business).
2. Add the **WhatsApp** product, register a **business phone number**, and verify it.
3. Get a **System User permanent access token** and the **Phone Number ID** + **WhatsApp Business Account ID**.
4. Approve a few **message templates** (required for sending outside a 24h conversation window — used for marketing/notifications).
5. Configure the webhook URL (we'll generate it) so inbound messages and delivery statuses flow back.

I'll store the access token, phone-number ID, WABA ID, and a webhook verify token as project secrets and walk you through Meta setup step-by-step.

## Scope

### 1. Sender configuration (`/marketing/whatsapp/sender`)
- Connect/disconnect Meta Cloud API
- Show registered phone number, display name, quality rating
- Webhook URL + verify token to paste into Meta
- Sync approved templates from Meta (name, language, category, body, variables)

### 2. Contacts (`/marketing/whatsapp/contacts`)
- Reuse `email_contacts` + add `whatsapp_contacts` (phone E.164, opt-in status, tags, source)
- Auto-sync from leads with phone numbers (trigger like the email one)
- Import CSV, manual add, lists/segments
- Opt-out tracking (any "STOP" reply marks unsubscribed)

### 3. Lists & segments (`/marketing/whatsapp/lists`)
Same model as email lists, separate table.

### 4. Broadcasts (`/marketing/whatsapp/campaigns`)
- Pick an **approved template** + fill variables (per-contact merge tags like `{{name}}`)
- Choose list/segment, schedule send time
- Test send to your own number
- Per-recipient status (sent / delivered / read / failed) via webhook
- Rate-limited send loop (Meta tier-based; start at 250 msgs/24h)

### 5. Automations (`/marketing/whatsapp/automations`)
Trigger-based flows, same engine as email automations:
- Triggers: new lead with phone, meeting booked, meeting accepted (drop-in), project status changed, manual tag added
- Action: send approved template, wait N hours, send follow-up
- Per-step delivery log

### 6. 1-to-1 Inbox (`/marketing/whatsapp/inbox`)
- Conversations list (last message, unread count)
- Thread view with full history (in/out, media, status icons)
- Reply box — free-form text allowed inside 24h customer service window; outside, must pick template
- Realtime updates via Supabase channel as webhook writes new messages

### 7. Click-to-chat (personal number mode)
- Each user can set a personal WhatsApp number in **My Profile** (already exists)
- Anywhere we show a lead/client with a phone, add a "WhatsApp on my phone" button that opens `https://wa.me/<phone>?text=<prefilled>`
- Optional **personal templates** library (saved snippets) the user can pick before the link opens — no API call, just URL-encoded text

### 8. Notifications wiring (using Business sender)
Opt-in toggles to auto-send WhatsApp templates for:
- Booking confirmation to client
- Drop-in accepted
- Project status change to client contact

## Database changes

New tables (all with RLS scoped to `user_id`/org):

- `whatsapp_sender_config` — token ref, phone_number_id, waba_id, display name, verify token, status
- `whatsapp_templates` — synced from Meta (name, language, category, body, vars, status)
- `whatsapp_contacts` — phone E.164, name, status (subscribed/unsubscribed/blocked), tags, source, lead_id
- `whatsapp_lists` + `whatsapp_list_members`
- `whatsapp_campaigns` — template_id, list_id, variables_map, schedule, status, stats
- `whatsapp_sends` — per-recipient: campaign_id, contact_id, wa_message_id, status, error, timestamps
- `whatsapp_automations` + `whatsapp_automation_steps` + `whatsapp_automation_runs`
- `whatsapp_conversations` + `whatsapp_messages` (for inbox: direction, body, media_url, template_name, status, wa_message_id)

Plus a trigger to mirror leads with phones into `whatsapp_contacts` (parallel to existing email sync).

## Edge functions

- `whatsapp-send` — sends a single template/text message via Meta Cloud API
- `whatsapp-campaign-tick` — cron every minute; picks scheduled campaigns and dispatches batches respecting tier rate limit
- `whatsapp-campaign-send` — fans out a campaign across its list
- `whatsapp-campaign-test` — send to a test number
- `whatsapp-automation-tick` — cron every 5 min; advances automation runs
- `whatsapp-webhook` — public endpoint Meta calls:
  - GET → verify handshake using stored verify token
  - POST → inbound messages, status updates, opt-outs → write to `whatsapp_messages` / update `whatsapp_sends`
- `whatsapp-templates-sync` — pulls approved templates from Meta on demand

## Secrets to add (after Meta setup)

`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WABA_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` (for webhook signature verification).

## Out of scope (v1)

- Bot/AI auto-replies (can add later via Lovable AI)
- Voice/video calling
- Multi-business-number (one WABA number for v1; click-to-chat covers personal mixing)
- WhatsApp Pay / catalog / flows

## Phased delivery

1. **Phase 1 — foundation**: Sender setup, webhook, template sync, contacts + lists, click-to-chat buttons across leads/projects.
2. **Phase 2 — broadcasts**: Campaigns + test send + sends log + rate-limited cron.
3. **Phase 3 — automations + notifications wiring**.
4. **Phase 4 — 1-to-1 inbox** with realtime.

Confirm and I'll start with Phase 1 (and walk you through the Meta setup before asking for the secrets).
