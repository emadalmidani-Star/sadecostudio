## Fitout Tracker — Project Management Module

Add a new "Fitout Tracker" section to the existing SADECO app as a separate Project Manager workspace, reusing current auth, sidebar shell, and dark theme. It will not replace the existing Projects (portfolio) feature — it lives alongside it under new routes.

### Scope

**New top-level area** in the sidebar: "Fitout Tracker" with sub-items Dashboard, Tracker, Team.

Routes (all behind existing `ProtectedRoute` + `RoleRoute`):
- `/fitout` — Dashboard (KPIs + charts + upcoming openings)
- `/fitout/projects` — Tracker table (all columns, filters, CSV export)
- `/fitout/projects/:id` — Detail page (timeline + progress)
- `/fitout/team` — PM / HOD / Supervisor roster

A new role page key `fitout` will be added so admins can grant access via the existing Permissions page.

### Database (Supabase migration)

New table `public.fitout_projects` with the exact schema requested:

```
id uuid pk default gen_random_uuid()
date_added date
hod text
pm text
city_province text
brand text
location text
project_type text
size_m2 numeric
fitout_period_days integer
start_on_site date
fitout_completion date
store_handover date
snag_prep_date date
contract_period_days integer
store_opening date
snag_completion_date date
comments text
status text  -- enforced via trigger to one of: Planning, In Progress, Snag, Completed, On Hold, Cancelled
supervisor text
created_by uuid          -- owner for RLS
created_at timestamptz default now()
updated_at timestamptz default now()
```

- Status validated by a BEFORE INSERT/UPDATE trigger (not CHECK, per project rules).
- `updated_at` maintained by existing `touch_updated_at` trigger.
- RLS enabled. Policies:
  - SELECT: any authenticated user
  - INSERT: authenticated, `created_by = auth.uid()`
  - UPDATE / DELETE: `created_by = auth.uid()` OR `has_role(auth.uid(),'admin')`
- Index on `status`, `start_on_site`, `store_opening`.

(Used as the table to make role/permissions integration easy. If you'd rather any authenticated user can edit any record like the existing `projects` table, say so and I'll loosen the policies.)

### Pages

**1. Dashboard `/fitout`**
- KPI cards: Total, In Progress, Completed, Avg Fitout Period (days), Total Size (m²)
- Recharts: Bar by Status, Bar by Brand, Bar by City/Province, Bar by Project Type, Line of projects started per month (from `start_on_site`)
- Table: Upcoming Store Openings in next 30 days, sorted ascending

**2. Tracker `/fitout/projects`**
- Horizontally scrollable shadcn `Table` showing all columns
- Search input filtering Brand, Location, PM, HOD, City/Province, Supervisor
- Filter `Select`s: Status, Brand, City/Province, Project Type, PM, HOD (options derived from data)
- Color-coded status `Badge`: Planning=slate, In Progress=sky, Snag=amber, Completed=emerald, On Hold=orange, Cancelled=red
- Row actions: Edit (opens drawer), Delete (confirm dialog)
- "+ New Project" button → same drawer in create mode
- "Export CSV" button (client-side serialization of current filtered rows)

**3. Add / Edit Drawer**
- shadcn `Sheet` (drawer) form with all schema fields
- Date pickers (shadcn Calendar in Popover, `pointer-events-auto`)
- `Select` for Status
- Number inputs for size_m2, fitout_period_days, contract_period_days
- Live computed read-only fields:
  - Days Remaining to Store Opening = `store_opening - today`
  - Fitout Duration Progress % = `(today - start_on_site) / fitout_period_days * 100`, clamped 0–100, with shadcn `Progress`
- `Textarea` for comments
- Save / Cancel

**4. Detail `/fitout/projects/:id`**
- Card layout grouping: Identity, People, Schedule, Metrics, Comments
- Timeline list with date + label + days-remaining/elapsed for: Date Added → Start on Site → Fitout Completion → Store Handover → Snag Prep Date → Snag Completion → Store Opening
- Progress bar for fitout duration
- Edit button reopens the drawer

**5. Team `/fitout/team`**
- Aggregates unique PMs, HODs, Supervisors from `fitout_projects`
- Cards: Name, Role tag, # assigned, list of active (non-Completed/Cancelled) projects
- Click a card → navigates to `/fitout/projects?pm=Name` (or `hod=` / `supervisor=`) to pre-filter the tracker

### Design

- Reuse existing dark theme and design tokens in `index.css` / `tailwind.config.ts`. Add semantic tokens for status colors (`--status-planning`, `--status-progress`, `--status-snag`, `--status-completed`, `--status-hold`, `--status-cancelled`) so `Badge` variants stay token-driven (no raw hex in JSX). The requested palette (#020617 / #0f172a / #1e293b, sky #0ea5e9, indigo #6366f1) will be expressed as HSL tokens. Existing pages remain visually unchanged.
- Sidebar (`AppLayout.tsx`) gains a "Fitout Tracker" group with Dashboard / Tracker / Team using Lucide icons (`LayoutDashboard`, `Hammer`, `Users`).

### Auth & permissions

- Auth already exists — no changes to login flow.
- Add `fitout` page key to `role_page_permissions` seed and to `RoleRoute` page list.
- Sidebar footer (already shows logged-in info) unchanged.

### Files to add / change

Add:
- `src/pages/fitout/Dashboard.tsx`
- `src/pages/fitout/Tracker.tsx`
- `src/pages/fitout/ProjectDetail.tsx`
- `src/pages/fitout/Team.tsx`
- `src/components/fitout/ProjectFormDrawer.tsx`
- `src/components/fitout/StatusBadge.tsx`
- `src/lib/fitout.ts` (types, status enum, CSV export, date helpers)

Edit:
- `src/App.tsx` — register the four new routes
- `src/components/AppLayout.tsx` — add sidebar group
- `src/components/RoleRoute.tsx` — accept `fitout` page key
- `src/index.css` / `tailwind.config.ts` — status color tokens
- Migration via Supabase tool for the new table, trigger, and RLS

### Out of scope (confirm if you want any of these)

- Importing existing `projects` rows into `fitout_projects`
- File attachments per fitout project
- Notifications/reminders for upcoming dates
- Changing the existing `/projects` (portfolio) feature
