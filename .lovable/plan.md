## Visual Template Mapper

Goal: let you upload a page-background image (e.g. an exported Canva page) and visually place rectangular "slots" on it for each dynamic field. Saved layouts are then used by the PDF generator instead of the current hard-coded layout.

### What you'll be able to do
1. Open a new page **Template Designer** (`/template`).
2. Upload a background image per page type: **Cover**, **Category Divider**, **Project Page**, **Thank You**.
3. Drag and resize labelled boxes onto the canvas:
   - Cover: `company_name`, `subtitle`, `date`, `logo`
   - Divider: `category_title`, `category_image`
   - Project: `project_title`, `project_type`, `client`, `location`, `area`, `status`, `description`, `highlights`, `cover_image`, `gallery_1..gallery_4`
   - Thank You: `company_name`, `contact`, `logo`
4. Each box stores: `x, y, width, height` (as % of page), font size, alignment, and (for text) color.
5. Save → used automatically next time you export from `/exports`.

### UX
- Left sidebar: list of available field tokens for the current page type. Click a token to add a default-sized box centered on the canvas.
- Center: the uploaded template image displayed at A4 landscape ratio. Boxes overlay with drag handles (move + 8 resize handles) using `react-rnd`.
- Right sidebar: properties for selected box (font size, align, bold, color, delete).
- Top: page-type tabs, "Upload background", "Save", "Reset".

### Data model (new table `pdf_templates`)
```
id uuid pk
user_id uuid
page_type text  -- 'cover' | 'divider' | 'project' | 'thankyou'
background_url text null
slots jsonb     -- [{ field, x, y, w, h, fontSize, align, bold, color }]
updated_at timestamptz
unique(user_id, page_type)
```
RLS: owner-only (same pattern as `category_covers`).

Background images uploaded to existing `project-images` bucket under `${user.id}/template-${page_type}-...`.

### PDF generator changes (`src/lib/pdf.ts`)
- Add `loadTemplates(userId)` → returns `{ cover, divider, project, thankyou }` records.
- For each page render: if a template exists, draw `background_url` full-bleed, then iterate `slots` and render the resolved value at the slot's rect (text wraps inside box; images use `cover` fit). If no template, fall back to current layout.
- Field resolver maps token → value from project/company (e.g. `gallery_1` → `project.images[0]`).

### Files to add/change
- New: `src/pages/TemplateDesigner.tsx` — the editor.
- New: `src/lib/templateRender.ts` — helpers to draw a templated page in jsPDF.
- Edit: `src/lib/pdf.ts` — branch into templated rendering when templates exist.
- Edit: `src/App.tsx` + `src/components/AppLayout.tsx` — add `/template` route + nav link.
- Edit: `src/pages/Exports.tsx` — small banner: "Using custom template" when one is saved, with link to designer.
- New migration: create `pdf_templates` table + RLS.
- Add dependency: `react-rnd` for drag/resize.

### Out of scope (can add later)
- Multi-page project layouts (will use one project-page template repeated; gallery overflow continues on a second auto-page).
- Rotated text, curved text, vector shapes.
- Importing a multi-page PDF as background (only image backgrounds in v1; PNG/JPG export from Canva works fine).

After approval I'll implement the migration, designer page, and PDF integration.