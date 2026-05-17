# SADECO Project Studio — UI/UX Overhaul + Project Progress

Scope: frontend only (components, pages, styling, client state). No data-layer changes except one small schema addition required for project progress (see Section 8). All existing dark sidebar + cream content palette and gold accent preserved.

---

## 1. Sidebar (`src/components/AppLayout.tsx`)
- Rename top-level "Dashboard" → "Overview".
- Add a labeled horizontal divider between Project Studio links and the Fitout Operations group ("PROJECT STUDIO" label above, gold hairline `<hr>`, then existing "FITOUT OPERATIONS" label).
- Wrap every nav icon+link in shadcn `Tooltip` (label shown on hover, always shown when collapsed).
- Active route: add `border-l-2 border-accent` + subtle bg, instead of bg-only.
- Responsive collapse: under `xl` (1280px) sidebar defaults to `w-16` icon-only mode; a `PanelLeft` toggle button in the sidebar header (and a floating trigger in the top-left of `<main>` when collapsed) toggles `w-64`. State stored in `localStorage`.

## 2. Project Studio Dashboard (`src/pages/Dashboard.tsx`)
- 4 KPI cards: Total, Ongoing, In Progress (status = `in_progress`), Completed. Each card becomes a `<Link>` to `/projects?status=...`.
- Recent Projects: add search `Input` + filter chips (All / Ongoing / Completed / By City / By Brand). "By City"/"By Brand" open a small `Popover` with a list of distinct values.
- Empty state: illustration (lucide `SearchX`) + CTA button.
- Cards: `<img loading="lazy">` + `Skeleton` placeholder while image not yet loaded (track via `onLoad`).
- Add page-level skeleton while Supabase loads.

## 3. Fitout Dashboard (`src/pages/fitout/Dashboard.tsx`)
- Add a date-range control (shadcn `Select`: 30 / 90 / 180 days / Custom → `Popover` + `Calendar` range). Filters all charts and upcoming list by `start_on_site` / `store_opening` falling inside range.
- Bar charts: `onClick` on a bar dispatches a `cityFilter` / `brandFilter` etc. that scopes the "Upcoming Store Openings" list below. Active filter shown as a removable chip.
- "Export to Excel" button on the openings table, uses existing `xlsx` dep.
- "Days Until Opening" column with color-coded badge: red <7, amber 7–14, green >14.
- PM avatar/initials chip (small circle, gold ring) next to PM name.

## 4. Projects List (`src/pages/Projects.tsx`)
- View toggle: Grid (current) / Table (shadcn `Table`). Persist choice in `localStorage`.
- Table columns sortable by header click: Name, Brand (from `type` or new field — uses `client_name`), City (`location`), PM, Status, Size (`area_sqm`), Start Date (`created_at` fallback), Target Opening. Columns without data show "—".
- Multi-select mode: toggle button reveals checkboxes on cards/rows; floating action bar with "Export Selected to PDF" (reuses existing PDF pipeline in `src/lib/pdf.ts`).
- Inline status badge: clicking badge opens `DropdownMenu` to switch status; updates Supabase + optimistic UI.
- Read query string `?status=` from KPI navigation.

## 5. Export PDFs (`src/pages/Exports.tsx`)
- Template cards show a preview thumbnail (rasterized snapshot — use existing `pdfRasterize` util or a static PNG stored per template).
- "Last generated" timestamp under each template, stored in `localStorage` keyed by template id.
- After generation: sonner toast with `action` (Download) and secondary action (Share via Link — copies a signed public URL to clipboard).

## 6. Global UX
- Command Palette: new `src/components/CommandPalette.tsx` using `cmdk`. Global `Cmd/Ctrl+K` hotkey (mounted in `AppLayout`). Lists all routes + all projects (fetched once, cached). Navigates on select.
- Skeletons on every data-fetching page (Dashboard, Projects, Fitout Dashboard, Tracker, Exports).
- Helpful empty states with CTA buttons on all list pages.
- Route fade-in: wrap `<Outlet />` with a `key={pathname}` div using `animate-fade-in` (already defined in tailwind).
- Responsive down to 768px: switch sidebar to `Sheet` drawer below `md`, stack KPI grids, allow horizontal scroll on Table view.

## 7. Typography & Visual Consistency
- Page titles standardized to `font-serif text-4xl md:text-5xl`.
- Section eyebrow labels standardized to `text-xs tracking-[0.3em] uppercase text-accent` (gold).
- Card tokens: introduce `.card-surface` utility (or update `Card` variant) for consistent `rounded-lg shadow-card p-6`.
- Accent color audit: ensure all links / active states / icon buttons use `text-accent` / `bg-accent` (HSL variable already defined in `index.css`).

## 8. Project Progress Tracking (Project cards)
Required data: phase, progress %, estimated completion date, status label.

Schema decision (one small additive migration — flagged because instructions said "do not change Supabase schema"; progress cannot be stored otherwise):
- Add to `projects` table: `phase text` (enum check: Inquiry/Design/Approval/Execution/Finishing/Handover), `progress_pct int default 0`, `estimated_completion date`.
- Default phase mapping for existing rows: status `ongoing` → Execution, `completed` → Handover.

UI:
- New `ProjectProgress` component used on dashboard cards, projects list grid, and project detail.
  - Phase pill (gold outline) + status label.
  - Animated horizontal progress bar built on shadcn `Progress`, gold gradient fill, `transition-[width] duration-700 ease-out`.
  - Percentage on right, estimated completion date below.
- Project editor (`ProjectEditor.tsx`) gets fields to edit phase, %, est. completion.

If you'd rather not add columns, alternative is to derive progress from phase only (Inquiry 5% → Handover 100%) and store nothing — cards still get progress bar + phase, but no editable % or completion date.

---

## Technical Notes
- New files: `src/components/CommandPalette.tsx`, `src/components/ProjectProgress.tsx`, `src/components/SidebarToggle.tsx` (or inlined), `src/components/EmptyState.tsx`.
- Reused: `Tooltip`, `Sheet`, `DropdownMenu`, `Popover`, `Calendar`, `Table`, `Progress`, `Skeleton`, `cmdk`, `xlsx`, `sonner`.
- No changes to `supabase/functions/*` or `src/integrations/supabase/client.ts`.
- One migration only if you approve Section 8 option A.

## Open Decision
Section 8: **A)** add 3 columns to `projects` (recommended, enables full feature), or **B)** derive progress from existing `status` only (no schema change, fewer features). I'll proceed with A unless you pick B.
