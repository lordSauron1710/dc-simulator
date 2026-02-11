# errors.md — Error log and lessons

Use this file to log bugs and fixes so the same mistakes are not repeated. When you fix a bug, add a short entry: **symptom**, **root cause**, **fix**, and a **one-line lesson**. When you hit an error, check this file first.

---

## Categorisation summary

| Category | Description |
|----------|-------------|
| [Scene & rendering](#scene--rendering) | 3D viewport, Three.js lifecycle, init/cleanup, connection timing |
| [State & params](#state--params) | Store, selection, param updates, serialisation |
| [Environment & types](#environment--types) | TypeScript, units, encoding, env vars, build/runtime assumptions |
| [Build & deploy](#build--deploy) | Next.js build, hosting, env config, static/edge behaviour |

---

## Scene & rendering

*Lifecycle and timing: init before render, cleanup on unmount. Re-read this section before changing 3D/scene or real-time behaviour.*

### [Inconsistent world scaling across scene systems]

- **Symptom:** At high parameter values (for example 12 data halls), geometry looked spatially inconsistent and hall counts appeared visually compressed or ambiguous.
- **Root cause:** Scene generation mixed many local world-space constants with parameter-driven dimensions, so halls, cooling, and utility systems did not share one physical scaling model.
- **Fix:** Refactored viewport layout to a feet-first global scale context (normalized params -> physical dimensions -> single world conversion), and updated halls/cooling/redundancy geometry to derive from the same dimensions.
- **Lesson:** Keep one canonical unit system for scene math; convert to render units once at the edge to preserve spatial awareness and predictable parameter response.

### [Whitespace footprint outpaced load and hall scaling]

- **Symptom:** At large whitespace values, the facility footprint expanded much faster than IT load and hall visuals, making halls appear sparse and disconnected.
- **Root cause:** Hall field extents were derived mostly from shell margins instead of jointly from whitespace area, hall geometry, and load pressure.
- **Fix:** Reworked scale derivation so hall field dimensions are computed from hall count + modeled hall size + circulation factors, then fit to the building shell with shared load/area coupling.
- **Lesson:** Couple footprint, hall envelope, and load pressure in one derivation path; do not let any one slider dominate scene scale independently.

### [Max-area scene under-framed and visually faint]

- **Symptom:** At 200,000 sq ft whitespace, the model appeared hard to read or partly out of useful frame.
- **Root cause:** Camera distance, floor/grid extents, and fog were static/heuristic instead of derived from the actual generated layout bounds.
- **Fix:** Added bounds-based camera fit and adaptive ground/fog scaling so the viewport frames the full layout volume at any parameter extreme.
- **Lesson:** Frame the camera from scene bounds, not from one dimension heuristic, when model scale can vary by orders of magnitude.

### [Halls under-packed inside the shell]

- **Symptom:** Even with high hall counts, large areas of the building shell looked empty and halls appeared clustered in a smaller core.
- **Root cause:** Hall grid selection ignored hall aspect in relation to building aspect, and hall volumes were based on whitespace-only geometry with conservative spacing factors.
- **Fix:** Added aspect-aware hall packing selection, switched visual hall sizing to gross hall area with adaptive fit, and reduced over-conservative circulation/inset shrink factors.
- **Lesson:** For dense layout visuals, optimize packing using both hall aspect and envelope aspect, not hall count alone.

### [Uniform hall scaling left one axis visibly underfilled]

- **Symptom:** A large blank band could remain along one side (often the lower/near side) even after denser grid packing.
- **Root cause:** Hall width/depth used one shared scale factor, so whichever axis constrained first forced the other axis to stay underfilled.
- **Fix:** Replaced uniform hall scaling with axis-aware width/depth scaling to independently fit each axis to cell bounds.
- **Lesson:** Preserve aspect only where it helps; for high-density planning views, independent axis fit improves coverage and readability.

### [Transparent shell occluded interior halls]

- **Symptom:** The lower/near half of the hall field appeared empty even when hall count was high.
- **Root cause:** Transparent shell and interior materials still wrote to depth, so front shell faces could hide near-side halls due render ordering.
- **Fix:** Disabled depth writing for transparent scene materials and forced shell render order behind interior hall content.
- **Lesson:** For x-ray-style interiors, transparent surfaces must not write depth or they will visually erase valid geometry behind them.

---

## State & params

*Param updates, selection, store actions. Re-read before changing state flow or URL/serialised state.*

### [UI range and scene normalization drifted]

- **Symptom:** Increasing slider limits made scene reactions feel inconsistent near the top end.
- **Root cause:** UI slider maxima and viewport normalization ranges were not aligned.
- **Fix:** Updated slider limits and `PARAM_RANGES` together so normalization tracks the same domain.
- **Lesson:** Whenever parameter domains change, update both input controls and normalization constants in the same patch.

---

## Environment & types

*Types, units, encoding, env assumptions. Re-read before adding or changing environment support or frame/data encoding.*

### [Three.js type declarations missing]

- **Symptom:** `npm run build` failed with `Could not find a declaration file for module 'three'`.
- **Root cause:** The runtime dependency `three` was added without its TypeScript declaration package in this repo setup.
- **Fix:** Installed `@types/three` as a dev dependency so strict type checking can compile scene files.
- **Lesson:** When adding new runtime libraries in strict TS projects, verify declaration packages are present before final build validation.

---

## Build & deploy

*Next.js build, `npm run dev`/`build`/`start`, hosting, env vars.*

### [Dev server crashed with missing chunk module `./819.js`]

- **Symptom:** `next dev` returned a server error: `Cannot find module './819.js'` with a require stack through `.next/server/webpack-runtime.js` and `.next/server/pages/_document.js`.
- **Root cause:** The `.next` directory contained a mixed artifact state (dev runtime files with stale production `app/page.js` chunk references), typically after interrupted/restarted dev sessions while previous build output remained.
- **Fix:** Stop the running dev server, remove `.next`, and restart with `npm run dev` so all server/runtime chunks are regenerated consistently.
- **Lesson:** For unexplained Next.js chunk resolution errors in dev, do a clean `.next` rebuild first before debugging app logic.

---

## Entry format

When adding an entry, use this structure under the right category:

```markdown
### [Short title]

- **Symptom:** What the user or dev saw (error message, wrong behaviour).
- **Root cause:** Why it happened (assumption, API misuse, missing step).
- **Fix:** What was done (code/config change, link or file if helpful).
- **Lesson:** One line to remember (e.g. "Always dispose Three.js resources on unmount.").
```

Update the categorisation summary table if you add a new category.
