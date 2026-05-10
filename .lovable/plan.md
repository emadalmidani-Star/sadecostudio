## Speed up the ID Cards page

Apply four targeted optimizations to `src/pages/IdCards.tsx` so the page renders fast — especially for admins viewing the whole team.

### 1. Lazy QR generation (IntersectionObserver)
- Wrap each `QrTile` with an IntersectionObserver hook.
- Only call `QRCode.toDataURL` once the card enters the viewport (with a small `rootMargin` so it starts a moment before it's visible).
- Show the existing `bg-muted animate-pulse` placeholder until then.

### 2. Module-level QR cache
- Add a `Map<string, string>` cache keyed by a stable hash of the vCard string (e.g. member id + updated_at-ish version counter).
- On generate, write to the cache; on mount, read from it first.
- Result: switching themes or remounting a card never re-encodes the QR. Regenerate clears that member's entry.

### 3. Idle pre-warm of `html2canvas` and `jspdf`
- In the parent `IdCards` page, after first paint, run `requestIdleCallback` (with `setTimeout` fallback) to fire `import("html2canvas")` and `import("jspdf")`.
- Discard the resolved values — Vite/browser will keep the chunks cached, so the first PNG/PDF click resolves instantly.

### 4. Lower QR render resolution
- Change `QRCode.toDataURL` `width` from `800` → `400`.
- Visual size on screen is ~180px, and the PDF export uses 90mm @ 3× scale via html2canvas, so 400px is still well above print sharpness.
- ~4× faster encoding and ~4× smaller data URLs (lower memory pressure with many cards).

### Files touched
- `src/pages/IdCards.tsx` (only file changed)

### Out of scope
- No backend changes, no new dependencies, no UI redesign — purely performance.