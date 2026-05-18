# Project Gallery — Plan

Add a new **Gallery** page that aggregates images from every project into a visual grid (with lightbox), gated by a new `gallery` permission so admins can grant access per role from the existing Permissions page.

## 1. Database (migration)

- Add `'gallery'` value to `role_page_permissions.page` usage (it's a free-text column — no enum change needed).
- Seed default rows in `role_page_permissions`:
  - `('admin','gallery', true)`
  - `('user','gallery', false)`
  - `('marketing','gallery', true)` — marketing typically needs visuals.

Admins can later toggle other roles from `/permissions`.

## 2. Permission wiring

- `src/hooks/useUserRole.ts`: add `"gallery"` to `PageKey` type and to `ALL_PAGES` (label: "Project Gallery"). The Permissions page renders the matrix from `ALL_PAGES`, so a new column appears automatically.

## 3. New page — `src/pages/Gallery.tsx`

- Fetch all projects with their `images` (jsonb array) and `cover_image`.
- Flatten into a single list of `{ url, projectId, projectName, location }`.
- Toolbar:
  - Search by project name / location / client.
  - Filter chips by project status (All / Ongoing / In Progress / Completed).
  - Project filter dropdown (multi-select).
  - Density toggle (small / medium / large tiles).
- Layout: responsive masonry-style CSS grid using existing `LazyImage`.
- Click an image → lightbox dialog (shadcn `Dialog`) with prev/next arrow keys, project name + a "Open project" button linking to `/projects/:id`.
- Empty state when no images exist.

## 4. Routing — `src/App.tsx`

- Add `<Route path="/gallery" element={<RoleRoute page="gallery"><Gallery /></RoleRoute>} />`.

## 5. Sidebar — `src/components/AppLayout.tsx`

- Add `{ to: "/gallery", icon: Images, label: "Gallery", page: "gallery" }` to the ungrouped Project Studio links, placed right after Projects.

## 6. Permissions UI

- No code change needed. The new "Project Gallery" column shows up automatically in `/permissions`, and admins can toggle each role's access there.

## Out of scope

- No upload/edit from the gallery (use the existing Project Editor).
- No reordering, tags, or albums.
- No download-as-zip or bulk export.

## Files touched

- New: `supabase/migrations/<timestamp>_gallery_permission.sql`, `src/pages/Gallery.tsx`
- Edited: `src/hooks/useUserRole.ts`, `src/App.tsx`, `src/components/AppLayout.tsx`
