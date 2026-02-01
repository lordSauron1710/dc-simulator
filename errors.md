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

*(No entries yet.)*

---

## State & params

*Param updates, selection, store actions. Re-read before changing state flow or URL/serialised state.*

*(No entries yet.)*

---

## Environment & types

*Types, units, encoding, env assumptions. Re-read before adding or changing environment support or frame/data encoding.*

*(No entries yet.)*

---

## Build & deploy

*Next.js build, `npm run dev`/`build`/`start`, hosting, env vars.*

*(No entries yet.)*

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
