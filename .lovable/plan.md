## Goal

Pull rows from a Google Sheet into the Fitout Tracker automatically (and on demand), without creating duplicate projects. Matching uses **Brand + Location + City** (case-insensitive, trimmed).

## How it will work

```text
 Google Sheet  ──▶  Edge Function (sync-fitout-sheet)  ──▶  fitout_projects table
       ▲                       ▲                                    │
       │                       │                                    ▼
       │              cron (every X min)                    Tracker UI shows rows
       │                       ▲
       └────────── "Sync now" button in Tracker ◀──────────
```

1. You connect your Google account once (OAuth via the Lovable Google Sheets connector).
2. In a new **Sheet Sync** settings panel on the Tracker page you paste the **Google Sheet URL** and pick the worksheet/tab + header row.
3. The system reads the rows, validates them with the same parser used by the Excel importer, and **upserts** into `fitout_projects`:
   - If a row matches an existing project on Brand+Location+City → update only changed fields.
   - If no match → insert a new project.
   - Rows already in the tracker but missing from the sheet are **left untouched** (we don't delete).
4. Sync runs:
   - **Manual** "Sync now" button (with progress + result toast).
   - **Scheduled** every 15 min via `pg_cron` calling the edge function.
5. A small **Sync Log** shows last run time, rows inserted/updated/skipped, and any per-row errors.

## What gets built

### Backend
- New table `fitout_sheet_config` (one row per workspace): `sheet_url`, `sheet_id`, `worksheet_name`, `header_row`, `enabled`, `last_synced_at`, `last_result` (jsonb).
- New table `fitout_sheet_sync_runs`: `started_at`, `finished_at`, `inserted`, `updated`, `skipped`, `errors` (jsonb), `triggered_by` ('manual' | 'cron').
- RLS: both tables readable/writable by authenticated users (admin-only for write if you prefer — tell me if so).
- Edge function `sync-fitout-sheet`:
  - Reads config, fetches rows from Google Sheets via the Lovable connector gateway.
  - Reuses parsing/validation logic mirroring `src/lib/fitout.ts` (`parseFitoutFile`, `splitPeople`, status normalization, date parsing).
  - Dedup key: `lower(trim(brand)) | lower(trim(location)) | lower(trim(city_province))`.
  - Performs insert/update in batches; writes a sync run record.
- `pg_cron` job hitting the edge function every 15 minutes.

### Frontend (Tracker page)
- New **"Sheet Sync"** dropdown/dialog beside the existing Import/Template buttons:
  - Connect Google (one-click connector flow).
  - Paste Sheet URL → fetch tab list → pick worksheet + header row.
  - Toggle enable scheduled sync.
  - "Sync now" button.
  - Last sync status + expandable error list (re-uses styling from `ImportPreviewDialog`).
- No changes to existing manual Excel import — both can coexist.

### Required Sheet format
Same headers as the existing CSV/XLSX template (the "Template" download already covers this). Brand, Location, and City/Province are required for dedup.

## Open questions / assumptions
- **Auth scope:** uses your Google account (developer/owner of the connector). All users of the app see the same synced data — fine because `fitout_projects` is shared.
- **Conflict rule:** when both the sheet and the tracker have a value for the same field on a matched row, the **sheet wins** (sheet is the source of truth). Tell me if you'd prefer "only fill blanks".
- **Schedule:** every 15 min by default; easy to change.
- **Delete behavior:** rows removed from the sheet are **kept** in the tracker. Tell me if you want them archived/deleted instead.

After you approve, I'll create the tables, the edge function, the cron job, and the UI panel.