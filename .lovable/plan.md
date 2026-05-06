## Template Sets + Multi-page Template Upload

Two related additions on top of the existing Template Designer.

### 1. Template Sets (per export type)

Today, one saved layout per page type is used for every export. We'll add **named template sets**, and each export type picks its own set.

New table `template_sets`:
```
id uuid pk
user_id uuid
name text                  -- e.g. "Hospitality 2026"
scope text                 -- 'profile' | 'project' | 'portfolio' | null (general)
created_at, updated_at
```

Modify `pdf_templates`:
- Add `set_id uuid` (nullable for backwards compatibility — existing rows become the "Default" set).
- Drop unique `(user_id, page_type)`, replace with unique `(set_id, page_type)`.

New table `export_template_assignments`:
```
user_id uuid pk part
export_kind text pk part   -- 'profile' | 'project' | 'portfolio'
set_id uuid                -- which template set to use
```

UI:
- **Template Designer** gets a top "Set" picker + "New set" / "Rename" / "Duplicate" / "Delete" buttons. Page-type tabs work within the selected set.
- **Exports page** gets three small selectors: "Profile uses…", "Single project uses…", "Portfolio uses…", each listing the user's sets (plus "Default layout — no template").

PDF generator (`src/lib/pdf.ts`):
- `loadTemplates()` becomes `loadTemplates(exportKind)` — looks up the assigned set, returns its 4 page templates, or `{}` if "Default layout".

### 2. Multi-page template upload + page mapping

Right now you upload one image per page type. We'll add a flow to upload an entire multi-page template (PDF or several images) and map each page to a role.

UI in Template Designer, new "Pages" panel above the canvas:
1. Click **Upload template pages** → file picker accepting `.pdf`, `.png`, `.jpg`, multiple files.
2. PDFs are rasterised in the browser with `pdfjs-dist` (one canvas per page, exported as PNG, stored in `project-images` bucket).
3. A horizontal strip shows page thumbnails with a role dropdown under each: **Unused / Cover / Category Divider / Project Page / Thank You**.
4. Choosing a role sets that page image as the background of the corresponding page-type tab and switches to it so you can drop fields on it.
5. Pages can be reassigned at any time; "Unused" leaves them as available backgrounds in a small library.

Storage of uploaded pages — new table `template_pages`:
```
id uuid pk
set_id uuid                -- belongs to a template set
page_index int             -- order within upload
image_url text
role text                  -- 'cover' | 'divider' | 'project' | 'thankyou' | null
```

When a page is assigned a role, we also write its `image_url` to `pdf_templates.background_url` for that `(set_id, page_type)` row, so the PDF generator stays unchanged aside from the set lookup.

### Files

New:
- migration: `template_sets`, `template_pages`, alter `pdf_templates`, `export_template_assignments`, RLS for all.
- `src/lib/pdfRasterize.ts` — `pdfjs-dist`-based PDF→PNG[] helper, uploads each to storage, returns URLs.
- `src/components/TemplatePagesStrip.tsx` — thumbnail row with role dropdowns.

Edit:
- `src/pages/TemplateDesigner.tsx` — set picker, upload-pages button, pages strip, route all reads/writes through `set_id`.
- `src/pages/Exports.tsx` — three set-assignment selectors at the top of the page.
- `src/lib/pdf.ts` — `loadTemplates(exportKind)` resolves the assigned set and returns its templates.

Add dependency: `pdfjs-dist`.

### Out of scope (v1)
- Auto-detecting which uploaded page is "the cover" — you assign manually.
- Editing the rasterised page image; it's used as-is as a background.
- Sharing template sets between users.