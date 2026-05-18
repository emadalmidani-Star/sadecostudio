## Marketing Hub — Plan

A new top-level sidebar group **Marketing** with three pages: **Scheduler**, **Analytics**, **Competitors**. Gated by a new `marketing` role.

---

### 1. Sidebar & access

- Add collapsible **Marketing** group in `AppLayout.tsx` (matches Fitout group style).
- Pages: Scheduler, Analytics, Competitors.
- New role `marketing` added to the `app_role` enum; new `PageKey` `marketing` in `useUserRole`. Admins + marketing role can access.
- Seed `role_page_permissions` so admin + marketing = allowed.

---

### 2. Scheduler (LinkedIn + Meta, direct API / BYOK)

**Heads-up on BYOK reality.** You picked direct LinkedIn + Meta Graph API. That means:
- You create a LinkedIn Developer app + a Meta Developer app yourself.
- For LinkedIn: request `w_member_social` and `w_organization_social` (Community Management API — requires LinkedIn approval).
- For Meta: Facebook Page posting needs `pages_manage_posts`, Instagram needs `instagram_content_publish`, both require Meta App Review (1–4 weeks, business verification).
- Until approved, posting only works for the developer/test users.

**What we build:**
- Table `social_accounts` (provider: `linkedin` | `facebook` | `instagram`, page_id, access_token, refresh_token, expires_at, display_name, connected_by).
- Table `scheduled_posts` (caption, media_urls[], target accounts[], scheduled_for, status: draft/scheduled/posted/failed, provider_post_ids jsonb, error, created_by).
- Storage bucket `marketing-media` for images/videos.
- Edge functions:
  - `social-oauth-start` / `social-oauth-callback` — OAuth flow for each provider, stores tokens encrypted.
  - `publish-scheduled-posts` — runs every minute via pg_cron + pg_net, picks due posts, calls LinkedIn `/rest/posts` and Meta Graph `/{page-id}/feed` + IG container/publish flow.
  - `refresh-social-tokens` — daily refresh.
- Secrets needed (added later, after you confirm): `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `META_APP_ID`, `META_APP_SECRET`.
- UI: composer with media upload, multi-account targeting, date/time picker, preview cards per network, queue view (upcoming / posted / failed with retry).

---

### 3. Analytics

Mixed: Google Search Console live, LinkedIn/Meta live where APIs allow, plus manual entry as a fallback.

- **Google Search Console**: use the existing Lovable connector. Edge function `gsc-metrics` pulls clicks/impressions/CTR/position. No setup beyond linking the connector.
- **LinkedIn Page**: pull follower count + post stats via `/rest/organizationalEntityShareStatistics` using the same OAuth token. Requires `r_organization_social`.
- **Meta**: Facebook Page Insights (`/{page-id}/insights`) + IG Business `/media/insights`. Same OAuth, scopes `read_insights`, `pages_read_engagement`, `instagram_basic`, `instagram_manage_insights`.
- **Manual snapshots**: table `marketing_metrics` (network, metric, value, captured_on) so you can log numbers weekly while approvals are pending — the dashboard reads from API when available, falls back to manual rows.
- Daily snapshot cron stores values in `marketing_metrics` for trend charts (Recharts).
- Dashboard: KPI cards + 30/90-day line charts per network, top posts table.

---

### 4. Competitors (SEO + Social)

- Table `competitors` (name, website, linkedin_url, instagram_handle, facebook_handle, notes).
- Table `competitor_snapshots` (competitor_id, source, metrics jsonb, captured_on) for time series.
- **SEO side — Semrush**: Semrush is available to me as a research tool during build, but it is **not** a runtime connector — your app can't query it live without your own Semrush API plan. Two options:
  - (a) I curate an initial competitive report (top keywords, gaps, backlinks) inside the Competitors page during build.
  - (b) You add a Semrush API key as a secret later; we add a `semrush-sync` edge function for live refresh.
- **Social side**: LinkedIn/Meta APIs **do not** expose public competitor analytics. Real-time tracking requires a paid third party (Socialinsider, Phyllo, BrandWatch). For now we ship a **manual tracker**: weekly row entry (followers, posts/week, avg engagement) + chart. We can later wire a paid API if you sign up.
- UI: competitor list, per-competitor detail with SEO panel + social panel + notes timeline.

---

### Out of scope / explicit non-goals

- TikTok, X, YouTube scheduling (not asked).
- Auto-generated post copy (can add via existing Lovable AI gateway later).
- Image generation for posts.

---

### Technical summary

- **DB**: `social_accounts`, `scheduled_posts`, `marketing_metrics`, `competitors`, `competitor_snapshots`; extend `app_role` with `marketing`; add `marketing` PageKey + RLS.
- **Storage**: bucket `marketing-media` (authenticated write, public read).
- **Edge functions**: `social-oauth-start`, `social-oauth-callback`, `publish-scheduled-posts`, `refresh-social-tokens`, `gsc-metrics`, `social-metrics-sync`, plus optional `semrush-sync`.
- **Crons** (pg_cron + pg_net): publish queue every 1 min, metrics sync daily 02:00.
- **Frontend**: `src/pages/marketing/{Scheduler,Analytics,Competitors,Connections}.tsx`, new routes under `/marketing/*`, sidebar group in `AppLayout.tsx`, new `marketing` role checks.
- **Existing systems untouched**: Projects, Fitout, Exports, Templates, Team.

---

### Recommended build order

1. Role + sidebar + empty pages + Connections page scaffolding.
2. LinkedIn OAuth + posting (smallest review surface) end-to-end.
3. Meta OAuth + posting.
4. Scheduler cron + queue UI.
5. Analytics (GSC first since it's already connected, then social).
6. Competitors page (manual + Semrush curated report).

Want me to proceed with all 6 steps, or stop after step 1 so you can wire your LinkedIn/Meta developer apps first?