
# Make ID Card / QR Card a designable template

Add a fifth page type — `idcard` — to the Template Designer so SADECO can design custom ID-card layouts. The IdCards page then renders each member's badge using the designed template (background + positioned slots), instead of the current hardcoded React layout.

## 1. Add `idcard` page type to the template system

In `src/lib/templateRender.ts`:
- Extend `Template["page_type"]` union with `"idcard"`.
- Add an `idcard` entry to `FIELDS_BY_TYPE` with these fields:
  - text: `member_name`, `member_title`, `member_email`, `member_phone`, `member_whatsapp`, `company_name`, `company_website`, `company_phone`
  - image: `member_photo`, `company_logo`, `qr_code`
- Extend `resolveText` and `resolveImageUrl` with the new cases. `qr_code` resolves from `ctx.qrDataUrl` (the pre-generated QR data URL), `member_photo` from `ctx.member.avatar_url`, etc.

In `src/pages/TemplateDesigner.tsx`:
- Add `{ key: "idcard", label: "ID Card" }` to `PAGE_TABS`.
- Use a portrait card aspect ratio (e.g. `54/85.6` credit-card-vertical) when `pageType === "idcard"` instead of A4 `297/210`. The canvas auto-resizes accordingly.

In `src/components/TemplatePagesStrip.tsx`:
- Add `{ value: "idcard", label: "ID Card" }` to `ROLES` so an uploaded thumbnail can be mapped to the ID card layout.

## 2. Render IdCards from the designed template

Refactor `QrTile` in `src/pages/IdCards.tsx`:
- After loading the active template set, fetch the `idcard` `pdf_template` row (background + slots).
- If a template exists, render the badge as an absolutely-positioned div sized to the template's aspect ratio:
  - Background image fills the card.
  - Each slot becomes a positioned `<div>` (percent-based x/y/w/h) containing either text (with the slot's font size/align/color/bold) or an image (`object-contain`).
  - The QR slot renders the generated `qr` data URL.
  - The photo slot renders the member's avatar (rounded via slot styling on the background, or keep current avatar circle look by just using the photo as-is).
- If no `idcard` template is set, fall back to the current hardcoded badge layout so nothing breaks.

PNG/PDF/vCard download buttons keep working — `html2canvas` captures whatever is in `wrapRef`.

## 3. Theme selector

Templates supersede the gradient/black/white theme switcher (the design lives in the background image). Hide the theme selector when an `idcard` template is active; keep it when falling back to the legacy layout.

## 4. Active template set

The `template_sets` selector already exists. The IdCards page picks the user's currently selected set the same way `Exports.tsx` does (via `export_template_assignments`, or just the first set). Add a small "Template set" dropdown at the top of the IdCards page so admins can switch which designed layout is used.

## 5. Out of scope

- No multi-tenant / company changes (deferred per your instruction).
- No new database tables — `pdf_templates` already supports any `page_type` string.
- No changes to PDF export pipeline in `src/lib/pdf.ts`; ID-card PDF stays as html2canvas → jsPDF.

## Files touched

- `src/lib/templateRender.ts` — add `idcard` page type, fields, resolvers
- `src/pages/TemplateDesigner.tsx` — new tab, portrait aspect ratio for ID card
- `src/components/TemplatePagesStrip.tsx` — new role option
- `src/pages/IdCards.tsx` — render from template when present, hide theme switcher in that mode, add set selector
