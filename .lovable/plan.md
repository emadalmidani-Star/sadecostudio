# Meetings Section Plan

A solid, cohesive addition — it reuses patterns already in the app (public token links like `PublicLeadForm`, realtime notifications like `NotificationsBell`, RoleRoute gating, dark sidebar + gold accent). Below is what I'd build.

## Scope

Add a **Meetings** group to the sidebar with 4 routes:
- `/meetings/scheduler` — set weekly availability, copy public booking link, see bookings
- `/meetings/dropin` — copy public drop-in link, live request inbox (Accept/Decline)
- `/meetings/notes` — meeting notes with action items + shareable read-only link
- `/meetings/upcoming` — week + next-week calendar, gold = Scheduled, green = Drop-In

Plus 3 public (no-login) pages:
- `/book/:token` — client picks a slot, enters name/email/note
- `/dropin/:token` — client sends quick call request
- `/notes/:token` — read-only meeting notes share

All public pages render the company logo from `company_profile` and the SADECO dark + gold theme.

## Database (Supabase migration)

New tables, all with RLS scoped to `auth.uid() = user_id` for owner access, plus narrow public read paths via edge functions where needed.

- **`meeting_availability`** — `user_id`, `weekday` (0–6), `start_time`, `end_time`, `slot_minutes` (default 30), `timezone`. Owner CRUD.
- **`meeting_booking_tokens`** — `user_id`, `token` (unique), `label`, `active`. Owner CRUD; public lookup via edge function.
- **`meetings`** — `user_id`, `client_name`, `client_email`, `note`, `scheduled_at`, `duration_minutes`, `status` (`upcoming|completed|cancelled`), `source` (`scheduled|dropin`), `created_at`. Owner CRUD; public insert via edge function.
- **`dropin_tokens`** — `user_id`, `token`, `active`. Owner CRUD.
- **`dropin_requests`** — `user_id`, `client_name`, `message`, `status` (`pending|accepted|declined`), `created_at`. Owner CRUD; public insert via edge function. Added to `supabase_realtime` publication.
- **`meeting_notes`** — `user_id`, `meeting_id` (nullable), `project_id` (nullable), `title`, `meeting_date`, `attendees` (jsonb array), `summary`, `action_items` (jsonb: `[{text, done, assignee}]`), `share_token` (nullable unique). Owner CRUD; public read via edge function when `share_token` matches.

Validation triggers (not CHECK constraints) for status/source enums, per project convention. GRANTs to `authenticated` + `service_role` on every table; no `anon` grants (public access goes through edge functions using service role).

Notifications: reuse the existing `notifications` table — insert a row on new booking, new drop-in request, and on Accept/Decline events so `NotificationsBell` lights up.

## Edge functions (public, `verify_jwt = false`, zod validation)

- `booking-availability` — GET slots for a token: reads owner's `meeting_availability` + existing `meetings` to compute free slots for the next 14 days.
- `booking-create` — POST `{token, slot_iso, client_name, client_email, note}`; inserts `meetings` row with `status=upcoming`, `source=scheduled`; inserts notification.
- `dropin-create` — POST `{token, client_name, message}`; inserts `dropin_requests`; realtime fires to designer.
- `meeting-note-public` — GET `?token=...` returns a single read-only note.

All use service role server-side, validate input length/format, and never expose other users' data.

## Frontend

**Sidebar (`AppLayout.tsx`)** — add a Meetings group (Calendar icon) gated by a new `meetings` page key in `RoleRoute`/`role_page_permissions`. Children use existing `NavLink` styling so the dark + gold treatment is automatic.

**Pages (`src/pages/meetings/`)**
- `Scheduler.tsx` — weekly grid editor (7 rows × time inputs), slot length selector, "Copy booking link" button, bookings table with status pills (gold = upcoming, green = completed, muted = cancelled) + Complete/Cancel actions.
- `DropIn.tsx` — copy link card + live list (subscribes to `dropin_requests` via `supabase.channel`). Each card has Accept (reveals designer's WhatsApp from `profiles.whatsapp` + `wa.me` deep link) and Decline.
- `Notes.tsx` — card grid; create/edit drawer with title, date, project select (from `projects`), attendees chips, summary textarea, action-items list with checkbox + assignee input; per-card Share toggle generates `share_token` and copies `/notes/:token`.
- `Upcoming.tsx` — two-week calendar view, color-coded dots (gold/green), click to Complete/Cancel.

**Public pages (`src/pages/public/`)**
- `BookMeeting.tsx` — fetches availability via edge function, shows date+slot picker, form, success state. Header shows company logo.
- `DropInRequest.tsx` — single form, success state.
- `MeetingNoteShare.tsx` — read-only rendering with checkboxes disabled.

All client-facing pages reuse the same dark background, gold primary buttons, and `company_profile.logo_url` header treatment used in `PublicLeadForm`.

**Routes (`App.tsx`)** — public routes outside `ProtectedRoute`, authed routes inside it under `RoleRoute page="meetings"`.

## Real-time

`ALTER PUBLICATION supabase_realtime ADD TABLE public.dropin_requests, public.meetings, public.notifications;` so the drop-in inbox, upcoming calendar, and bell update live.

## What I'd flag

- **Time zones**: scheduler uses the designer's timezone (stored on availability); the public booker shows slots in the client's local TZ with the designer's TZ labeled. Worth being explicit.
- **No email/calendar invites** in v1 — bookings live only in-app + notifications bell. Easy to add later via a transactional email function if you want.
- **WhatsApp reveal on Accept** assumes the designer has `whatsapp` set on their profile; if missing, the Accept dialog will prompt them to add it on `/me`.
- **Role permissions**: I'll add `meetings` to `role_page_permissions` defaulting to allowed for `admin` and `user`; admins can tune in `/permissions`.

Ready to build this in one pass on approval.
