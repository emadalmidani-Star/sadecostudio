
# Turn Spazio into a multi-tenant SaaS using SADECO's features

## Heads-up: the two projects don't share a stack

This work happens in the **Spazio Design Studio** project, not here. Important differences I have to bridge:

| | SADECO (this project) | Spazio (target) |
|---|---|---|
| Routing | React Router v6 (`src/pages/*`) | TanStack Router (file-based `src/routes/*`, SSR via TanStack Start) |
| React | 18 | 19 |
| Tailwind | v3 (HSL tokens in `index.css`) | v4 (`@tailwindcss/vite`) |
| Backend | Lovable Cloud + many edge functions | Lovable Cloud + Stripe already enabled |
| State of features | All built (exports, projects, fitout, marketing, meetings, team) | Mostly empty (auth, billing, index) |

So this isn't a copy-paste — each page is re-authored as a TanStack route, Tailwind v4 classes, and a workspace-scoped data model.

## Multi-tenant model

Every existing single-user table moves to **workspace-scoped**.

```text
auth.users
   └── workspace_members (user_id, workspace_id, role)
          └── workspaces (id, name, slug, plan, stripe_customer_id, stripe_subscription_id, plan_status, trial_ends_at)
                 └── all feature data: projects, fitout_projects, leads, meetings,
                     email_*, whatsapp_*, company_profile, partners, pdf_templates,
                     template_sets, category_covers, etc.
```

Rules:
- A user can belong to multiple workspaces; one is "active" (stored client-side + last-used in profile).
- `workspace_role` enum: `owner | admin | editor | viewer`. (SADECO's page-level permissions become role-scoped.)
- All tenant tables get `workspace_id uuid not null` and an RLS policy `is_workspace_member(auth.uid(), workspace_id)` via a `security definer` function. Mutations check `has_workspace_role(...)`.
- Workspace creation auto-runs on first signup; invite flow seeds `workspace_invitations` (reuses SADECO's invitation pattern, but workspace-scoped).

## Billing (Stripe, already enabled in Spazio)

Three tiers, gated by plan on the workspace:

| Plan | Price | Limits | Features |
|---|---|---|---|
| Free | $0 | 1 workspace, 3 members, 10 projects, no marketing sends | Projects, PDF Exports (watermarked), Team |
| Pro | $29/mo | 10 members, 200 projects, 1k email + 500 WA sends/mo | + Marketing (Email/WhatsApp), Meetings, Fitout tracker, no watermark |
| Business | $99/mo | Unlimited members/projects, 25k email + 10k WA sends/mo | + Template Designer, LinkedIn scheduler, Lead intake tokens, custom domain |

Implementation:
- `subscription_plans` table seeded with the tiers + Stripe price IDs.
- `workspaces.plan` updated by the `stripe-webhook` edge function on `customer.subscription.*`.
- Client-side `useEntitlements(workspaceId)` returns flags + counters; gate UI with `<PaywallGate feature="marketing">`. Server-side gate inside each edge function (reject if plan insufficient).
- Reuse Spazio's existing `billing.tsx` and `checkout.return.tsx`; add a `/billing/plans` page with the three tiers.

## Feature scope ported from SADECO

All four areas you picked, rebuilt as workspace-scoped TanStack routes:

```text
/app/$wsSlug
  /dashboard              → KPIs from SADECO Dashboard
  /projects               → Projects list + editor + gallery
  /projects/$id
  /gallery
  /exports                → PDF Exports (full profile / portfolio / single)
  /template-designer      → (Business plan)
  /company                → Company profile + partners + category covers
  /team                   → Members, invitations, roles
  /permissions            → Role page permissions (admin)
  /fitout                 → Dashboard, Tracker, PMs, Team
  /marketing
     /leads, /analytics, /competitors, /connections, /scheduler
     /email/{campaigns,automations,contacts,lists,sender,templates,analytics}
     /whatsapp/{campaigns,automations,contacts,lists,sender,templates,snippets,inbox}
  /meetings
     /upcoming, /scheduler, /notes, /drop-in
  /settings
     /workspace, /billing, /integrations
```

Public routes (kept from SADECO): `/auth`, `/p/book/:token`, `/p/dropin/:token`, `/p/lead/:token`, `/p/note/:token`, `/unsubscribe`.

Library files migrated 1:1 (they're framework-agnostic): `pdf.ts`, `pdfFonts.ts`, `pdfRasterize.ts`, `emailRender.ts`, `whatsapp.ts`, `fitout.ts`, `meetings.ts`, `projectPhase.ts`, `storagePath.ts`, `flattenImage.ts`, `templateRender.ts`.

All ~25 edge functions ported as-is to Spazio's `supabase/functions/*`, with two changes:
1. Resolve `workspace_id` from the authed user + path/header, not just `user_id`.
2. Plan-check at the top of each marketing-send function.

## Phased delivery

Doing this in one go would be a 20+ migration mega-PR. Proposed phases (each is a self-contained shippable step):

1. **Foundation** — workspaces, members, invitations, roles, RLS helper functions, `useWorkspace()` hook, workspace switcher, `/app/$wsSlug` layout. Seed Free plan on signup.
2. **Billing & plans** — `subscription_plans`, plan gating helpers, `/billing/plans` page, Stripe webhook → workspace.plan, entitlements hook, paywall component.
3. **Core: Projects + Company + Team + Exports** — ports `projects`, `company_profile`, `partners`, `category_covers`, `pdf_templates`, `template_sets`, `profiles`, `user_roles` → workspace-scoped. PDF library lifted as-is.
4. **Fitout module** — `fitout_projects`, sheet sync, tracker UI.
5. **Marketing** — Leads, Email (lists, contacts, templates, campaigns, automations, sender, analytics, webhook, unsubscribe), WhatsApp (same surface), LinkedIn scheduler. All cron tick functions ported. Plan-gated.
6. **Meetings** — availability, booking tokens, drop-in, notes, public share pages.
7. **Polish** — empty states, onboarding tour, marketing landing page on `/`, docs, SEO.

I'd ship phase 1 first and pause for review before continuing.

## What I need confirmed before starting

1. **Pricing** — OK with Free / $29 Pro / $99 Business above, or different numbers/tiers?
2. **Trial** — 14-day Pro trial on signup, or straight to Free?
3. **Branding** — Keep Spazio's current visual identity, or carry over SADECO's serif/luxury look as the default theme?
4. **SADECO data** — Migrate SADECO's existing data into a "SADECO" workspace inside Spazio, or start Spazio empty and leave SADECO running separately?
5. **Start point** — Begin with **Phase 1 (Foundation)** only and review before continuing? (Recommended.)
