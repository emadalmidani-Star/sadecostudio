## Goal
Make the AI-generated project descriptions and highlights genuinely "premium editorial" — specific, brand-aligned, and useful in the PDF — instead of generic marketing fluff.

## What's wrong today
The `generate-description` edge function uses a short generic system prompt with `gemini-2.5-flash`. Output ends up bland and forgettable, not matching the SADECO brand or the design publication tone (Wallpaper*, AD Middle East) we want for the PDF case studies.

## Changes

### 1. `supabase/functions/generate-description/index.ts` — rewrite
- **Upgrade model** from `gemini-2.5-flash` → `gemini-2.5-pro` for stronger writing quality and better adherence to constraints.
- **Pass company context** from the client (name, about, services) so the AI grounds copy in the actual brand, not a generic fit-out firm.
- **Pass project status** as well as the existing fields.
- **Stronger system prompt** with explicit brand voice rules:
  - Reference real construction/design vocabulary (joinery, MEP, fluted oak, book-matched stone, integrated lighting, snagging, handover…)
  - Ban clichés ("state-of-the-art", "one-stop shop", emojis, hashtags)
  - British English, third person, varied sentence rhythm
  - Never invent missing facts (clients, awards, dimensions)
- **Type-specific guidance** — a small lookup keyed on project type (fit-out, residential, commercial, hospitality, retail, F&B, office, construction) injected into the prompt so a hospitality project reads differently from an office project.
- **Richer structured output** via tool calling:
  - `headline` — short editorial headline (≤10 words) capturing the design idea
  - `description` — 140–180 words, two short paragraphs (intent → materiality → delivery)
  - `highlights` — exactly 4 concrete, specific highlights (≤18 words each, no repeated openings)

### 2. `src/pages/ProjectEditor.tsx` — minimal update to `generateAI()`
- Fetch `company_profile` once (or use cached) and pass `company: { name, about, services }` and `status: p.status` in the request body.
- Store the new `headline` on the project. Two options — pick one:
  - **Option A (simple):** prepend the headline to the description as a bold first line, no schema change.
  - **Option B:** add a `headline` column to `projects` and a small input field. *(Recommend A for now to avoid schema churn; can promote later.)*

### 3. PDF (no change required)
The existing PDF layout already shows project name, type, location, description, and highlights. The richer copy will flow through automatically. If we go with Option B later, we can render the headline under the project name on the case-study hero page.

## Technical details
- Model: `google/gemini-2.5-pro` via Lovable AI Gateway (existing `LOVABLE_API_KEY`).
- Existing 429 / 402 / generic error handling preserved and surfaced via toasts.
- Tool-calling response shape extended; client falls back gracefully if `headline` is missing.
- No database migration needed for Option A.

## Out of scope
- Per-language output (English only for now).
- Regenerating descriptions in bulk for existing projects.
- Image-aware generation (using project photos as context).
