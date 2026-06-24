## 1. "About Us" company profile page (PDF export + public web page)

A reusable About page driven by `company_profile` + featured project selection, surfaced two ways:

**a) PDF export cover** — in `src/pages/Exports.tsx`, when the user picks projects to export, prepend an editable "About Us" cover page before the project pages. New panel above the project picker:
- Toggle: "Include About Us page" (default on)
- Editable fields: headline, intro paragraph, services list, contact (phone/email/website), stats (years, projects, clients), accent color
- Live preview thumbnail
- Defaults pulled from `company_profile` table; overrides stored per-export in localStorage (no schema changes needed)
- Renderer added to `src/lib/pdf.ts` as `renderAboutPage(doc, profile, opts)` — full-page layout: logo top, big serif headline, intro, 3-column services, stats row, contact footer.

**b) Public web page** at `/about` (and shareable `/about/:slug?` for selected project sets):
- New `src/pages/public/About.tsx` route
- New "About page" editor at `/settings/about` (`src/pages/AboutEditor.tsx`) — same fields as the PDF cover, plus pick featured projects from `projects` table to show in a grid below the bio.
- Stored in a new table `about_pages` (id, user_id, slug, headline, intro, services jsonb, stats jsonb, contact jsonb, featured_project_ids uuid[], accent, updated_at) with RLS + GRANTs.
- Shared `AboutContent` component used by both the public page and the PDF preview to guarantee parity.

## 2. Template Designer: don't regenerate untouched pages

Currently `TemplateDesigner.tsx` auto-seeds a full set of pages (cover/first/last) whenever a set is loaded or any page changes, so editing one page rewrites siblings.

Fix:
- Remove the auto-seed on load. Only seed when the user explicitly clicks "Add cover page" / "Add closing page".
- Save touches **only the page currently being edited** — strip the bulk upsert of all pages.
- Add a `last_edited_at` on each `template_pages` row (already present via `updated_at`) and surface "Last saved" per page in the sidebar.
- Exports/preview read whatever rows exist; missing pages are simply skipped instead of being generated on the fly.

## 3. Font family + size controls (email templates + PDF Template Designer)

Add a shared font registry `src/lib/fonts.ts` exporting:
- `EMAIL_FONTS` — email-safe stacks (Georgia/Serif, Helvetica/Sans, Inter, Playfair, Cormorant, Outfit; Google fallbacks for client previews)
- `PDF_FONTS` — fonts already bundled in `src/lib/pdfFonts.ts` (add 2–3 more if missing)
- `FONT_SIZES` — preset sizes (12, 14, 16, 18, 20, 24, 28, 32, 40, 56)

**Email templates** (`src/pages/marketing/email/Templates.tsx` + `src/lib/emailRender.ts` + `supabase/functions/_shared/emailRender.ts`):
- Add `fontFamily` and `fontSize` to `heading` and `text` block schemas (optional, falls back to current SANS/SERIF + computed sizes).
- Block editor: two new selects per text/heading block — Font family, Font size.
- Renderer uses inline `font-family` + `font-size` when provided.
- Template-level defaults: heading font, body font, base size — picker in the template settings panel.

**PDF Template Designer** (`src/pages/TemplateDesigner.tsx` + `src/lib/templateRender.ts` + `src/lib/pdf.ts`):
- Each text element gains `fontFamily` and `fontSize` controls in the inspector.
- Page-level defaults (title font, body font, base size) editable from the page settings panel.
- `pdf.ts` already supports font registration via `pdfFonts.ts`; wire the new fields into the text-drawing helpers.

## 4. Full WhatsApp removal (UI + backend)

**Frontend deletions:**
- `src/components/WhatsAppButton.tsx`
- `src/lib/whatsapp.ts`
- `src/pages/marketing/whatsapp/` (entire folder: Automations, Campaigns, Contacts, Inbox, Lists, Sender, Snippets, Templates)
- Remove WhatsApp routes from `src/App.tsx`
- Remove the WhatsApp section from `src/components/AppLayout.tsx` sidebar
- Strip WhatsApp UI from `src/pages/marketing/Leads.tsx`, `src/pages/meetings/DropIn.tsx`, `src/pages/MyProfile.tsx`, `src/pages/IdCards.tsx` (the WhatsApp button + the `whatsapp` profile field input)

**Backend deletions:**
- Delete edge functions: `whatsapp-webhook`, `whatsapp-send`, `whatsapp-templates-sync`, `whatsapp-campaign-send`, `whatsapp-campaign-test`, `whatsapp-campaign-tick`, `whatsapp-automation-tick`, `lead-intake-whatsapp`
- Migration to DROP: `whatsapp_messages`, `whatsapp_conversations`, `whatsapp_sends`, `whatsapp_campaigns`, `whatsapp_automation_runs`, `whatsapp_automation_steps`, `whatsapp_automations`, `whatsapp_list_members`, `whatsapp_lists`, `whatsapp_contacts`, `whatsapp_snippets`, `whatsapp_templates`, `whatsapp_sender_config`, `whatsapp_notification_settings`
- Drop `sync_lead_to_whatsapp_contact()` function and its trigger on `leads`
- Drop `whatsapp` column from `profiles`

**Confirmed destructive** — all WhatsApp data will be permanently lost.

## Technical notes

- Order of work: WhatsApp removal first (clears noise) → Template Designer stickiness → font controls → About page (largest).
- New `about_pages` table follows the existing RLS pattern (`user_id = auth.uid()`), with `GRANT SELECT, INSERT, UPDATE, DELETE … TO authenticated`, `GRANT ALL … TO service_role`, and `GRANT SELECT TO anon` only for the public-share read path scoped by slug.
- No new external dependencies; fonts piggyback on the existing `@fontsource/*` packages plus the PDF font loader.
