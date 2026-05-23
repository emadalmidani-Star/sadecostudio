# Marketing Leads — Plan

A new **Leads** hub under Marketing that captures inbound interest from manual entry, a public web form, forwarded emails, and WhatsApp Business — managed in a Kanban + Table pipeline, and convertible to a SADECO project.

## 1. Database (migration)

New tables:

- **`leads`** — `id`, `user_id` (owner/creator), `name`, `email`, `phone`, `company`, `message`, `source` (`manual` | `web_form` | `email` | `whatsapp` | `other`), `source_meta` (jsonb — raw payload, subject, channel id, etc.), `stage` (`new` | `contacted` | `qualified` | `proposal` | `won` | `lost`, default `new`), `assigned_to` (uuid, nullable), `project_id` (uuid, nullable — set when converted), `created_at`, `updated_at`.
- **`lead_intake_tokens`** — `id`, `user_id`, `kind` (`web_form` | `email` | `whatsapp`), `token` (unique random string), `label`, `active` (bool), `created_at`. Used as the public identifier in the form URL, the email alias, and the WhatsApp webhook verify token.

RLS:
- `leads`: owner-only CRUD (`auth.uid() = user_id`); edge functions write with the service-role key.
- `lead_intake_tokens`: owner-only CRUD.

Permissions:
- Add `leads` to `role_page_permissions` defaults (admin + marketing = true).

## 2. Permission + routing wiring

- `src/hooks/useUserRole.ts`: add `"leads"` to `PageKey` and `ALL_PAGES` (label "Marketing Leads").
- `src/App.tsx`: add `/marketing/leads` → `<RoleRoute page="leads"><MarketingLeads /></RoleRoute>`.
- `src/components/AppLayout.tsx`: add a Leads item inside the Marketing group.

## 3. Leads page — `src/pages/marketing/Leads.tsx`

- Tabs: **Kanban** | **Table**.
- **Kanban**: 6 columns (New, Contacted, Qualified, Proposal, Won, Lost). Drag a card to change `stage` (use `@dnd-kit` — already in shadcn-friendly use, or simple buttons if not installed). Cards show name, source badge (with icon: 📱 WhatsApp, ✉️ Email, 🌐 Form, ✍️ Manual), company, created date.
- **Table**: sortable columns (name, source, stage, created), text filter, source filter, stage filter.
- **New Lead** button → drawer/dialog with form (name required, email/phone/company/message optional, source default `manual`).
- **Lead detail drawer**: edit fields, change stage, view raw `source_meta`, **Convert to Project** button (creates a row in `projects` with `name = lead.name / lead.company`, `client_name = lead.company`, `status = 'ongoing'`, links back via `leads.project_id`, then navigates to `/projects/:id`).
- **Intake settings** dialog (gear icon): generate/revoke tokens for Web Form, Email, WhatsApp; show the shareable URLs/addresses.

## 4. Public web form — `src/pages/PublicLeadForm.tsx`

- Route `/leads/new/:token` (added in `App.tsx` outside `ProtectedRoute`).
- Fields: name, email, phone, company, message. Zod validation, honeypot field + 1 submission per 30s client throttle.
- Submits to edge function `lead-intake-form` which validates token, resolves `user_id`, and inserts the lead. Renders a "Thanks, we'll be in touch" state.

## 5. Edge functions

All deployed automatically; CORS enabled; input validated with Zod.

- **`lead-intake-form`** (`verify_jwt = false`): POST `{ token, name, email?, phone?, company?, message? }`. Looks up `lead_intake_tokens` (active, kind=`web_form`), inserts a lead with `source='web_form'` via service-role client. Returns `{ok:true}`.
- **`lead-intake-email`** (`verify_jwt = false`): Inbound webhook endpoint for an email provider (Mailgun Routes or Resend Inbound). Parses `from`, `subject`, `text`/`html`; the recipient address embeds the token (`leads+<token>@yourdomain`); inserts a lead with `source='email'`, `source_meta = { subject, raw }`.
- **`lead-intake-whatsapp`** (`verify_jwt = false`): Meta WhatsApp Business webhook. GET handles the `hub.challenge` verification using the token. POST parses `messages[]` entries and inserts leads with `source='whatsapp'`, `source_meta = { wa_id, phone_number_id, text, profile_name }`. Phone & name pulled from the contact payload.

## 6. Setup notes shown in the Intake dialog

- **Web form**: copy `https://<app>/leads/new/<token>` — works immediately, no extra setup.
- **Email forwarding**: requires connecting an email provider (Resend or Mailgun) with inbound routing pointed at the edge function URL — Intake dialog shows the webhook URL + the expected `leads+<token>@…` address pattern. We'll wire the connector when you're ready.
- **WhatsApp Business**: requires a Meta WhatsApp Business app — Intake dialog shows the **Callback URL** (the edge function) and the **Verify Token** (the token row) for you to paste into Meta's dashboard. Setup is heavier and may need Meta approval; the wiring will work as soon as those credentials are in place.

## 7. Convert lead → Project

Single edge-free client action: insert into `projects` (`name`, `client_name`, `status='ongoing'`, `type='fit-out'`, `created_by = auth.uid()`), then `update leads set stage='won', project_id=<new id>`. Toast + navigate.

## Out of scope (v1)

- Assignment to team members, notes/activity timeline, analytics on lead source, SLA timers, bulk import, duplicate detection.

## Files touched

- New: migration, `src/pages/marketing/Leads.tsx`, `src/pages/PublicLeadForm.tsx`, `supabase/functions/lead-intake-form/index.ts`, `supabase/functions/lead-intake-email/index.ts`, `supabase/functions/lead-intake-whatsapp/index.ts`.
- Edited: `src/App.tsx`, `src/components/AppLayout.tsx`, `src/hooks/useUserRole.ts`.
