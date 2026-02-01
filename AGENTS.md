# Agent instructions — DC Simulator

**Core instruction for this repo.** AI agents working on DC Simulator should follow this document to keep the codebase consistent, deployable, and aligned with the product goal.

---

## End goal

Deliver a **visually creative, deployable webapp**: a parameter-driven 3D data center sandbox with a polished UI, smooth interactions, and production-ready build/deploy.

---

## Mindset

**Think like a senior developer.**

- Prefer simple, explicit solutions over clever ones. Readability and maintainability trump brevity.
- Preserve existing behaviour unless the task explicitly changes it. When in doubt, match current patterns (e.g. `src/ui/`, `app/globals.css`, route structure).
- Design for the whole stack: types, state, rendering, and deployment. Avoid local fixes that create debt elsewhere.
- Optimise for users: performance (e.g. 60 fps target), accessibility, and clear feedback. Prefer progressive enhancement.
- Keep the app deployable: no hardcoded secrets, env-based config, and a clean `npm run build` / standard hosting path.

---

## Tech stack

| Layer | Choice | Notes |
|-------|--------|--------|
| Framework | Next.js 14 (App Router) | Single route `/`; use `app/` for layout and page. |
| Language | TypeScript (strict) | Strict mode on; no `any` without justification. |
| UI | React 18 | Client components where state/effects are needed; server components where not. |
| Styling | CSS (globals + variables) | Design tokens in `app/globals.css`; avoid one-off inline styles for layout/theme. |
| 3D | Three.js (planned) | Scene and viewport live under `src/scene/`; keep rendering logic out of `app/`. |
| State | TBD (roadmap Prompt 03) | Global store for params, selection, viewMode, UI; keep model logic in `src/model/`. |

Use this stack as the default. If you introduce a new dependency or pattern, document why and update this table or README.

---

## Principles

**Design**

- UI reference: `src/ui/`, `app/globals.css`, `src/scene/Viewport.tsx`. Match the existing layout (dark canvas, left explorer, glass spec panel, bottom controls) unless the task changes it.
- Use CSS variables for colours, spacing, and radii. Prefer semantic names (e.g. `--bg-panel-glass`, `--text-secondary`).
- Keep the 3D view uncluttered: UI overlays must not block the render surface (pointer-events, z-index).

**Development**

- Types first: model params, selection, and store state should be typed; avoid loose objects.
- Prefer pure functions in `src/model/` for computations; keep side effects in React components or store actions.
- Prefer small, focused components and files. Co-locate only when it improves readability.

**Deployment**

- No secrets in repo; use env vars (e.g. `NEXT_PUBLIC_*` for client-safe config).
- Ensure `npm run build` succeeds and the app runs with `npm run start` (or the chosen host's command).
- Prefer static or edge-friendly patterns where possible so the app is easy to host (e.g. Vercel, Netlify).

---

## Key files

| File | Purpose |
|------|--------|
| [roadmap.md](roadmap.md) | Development prompts for the v0 MVP. Execute prompts in order; update status tags as you work. |
| [README.md](README.md) | Project overview, setup, and run instructions. Keep it accurate. |
| [errors.md](errors.md) | Log of errors: symptom, root cause, fix, and one-line lesson. Use it to avoid repeating mistakes. |

---

## Keeping README.md up to date

The README is the public face of this project. Keep it current:

**Screenshots**

- After any **major UI update** (new panel, significant visual change, layout restructure), add a screenshot to `docs/screenshots/` and update the screenshot at the top of README.md.
- Name screenshots descriptively: `ui-param-drawer.png`, `3d-rack-layout.png`, etc.
- Keep one hero screenshot at the top; archive older ones in `docs/screenshots/archive/` if needed.

**File structure**

- After any **major file structure change** (new folders, significant reorganisation), update the project structure section in README.md.
- Include only meaningful files/folders; omit generated files, lock files, and trivial items.

---

## Learning from errors

Use **errors.md** to learn from past mistakes and avoid repeating them.

- **Before changing 3D / scene or real-time behaviour**  
  Re-read any "Scene, rendering & connection timing" (or equivalent) section in errors.md so lifecycle and timing stay correct (e.g. init before render, cleanup on unmount).

- **Before adding or changing environment or data assumptions**  
  Re-read any "Environment, types & encoding" (or equivalent) section so behaviour stays robust (e.g. types, units, serialisation).

- **When you fix a bug**  
  Add a short entry to errors.md: symptom, root cause, fix, and a one-line lesson. Use existing categories or add one. Update the categorisation summary table if it helps.

- **When you hit an error**  
  Check errors.md first; it may describe a known bug, assumption, or API misuse and how it was fixed.

If errors.md is missing, create it with a short intro and a categorisation table (e.g. Scene & rendering, State & params, Environment & types, Build & deploy).

---

## Prompt execution tracking (roadmap.md)

When working through [roadmap.md](roadmap.md):

1. **Status tags**  
   Add a status line at the top of each prompt block, immediately after the `## Prompt NN — ...` header:

   - `<!-- IN PROGRESS -->` — when you start work on that prompt.
   - `<!-- EXECUTED -->` — when work for that prompt is complete.

2. **Update promptly**  
   Set the tag as soon as you start or finish; don't leave it stale.

3. **Leave the prompt text unchanged**  
   Do not edit the prompt body, expected output, or acceptance criteria; only add/update the status comment.

Example:

```markdown
## Prompt 03 — Global state store
<!-- EXECUTED -->

**Prompt**
Implement a global store with:
...
```

---

## Summary

- **Goal:** Visually creative, deployable 3D data center webapp.
- **Mindset:** Senior dev — simple, typed, user- and deployment-aware.
- **Stack:** Next.js 14, TypeScript (strict), React, CSS variables, Three.js (planned).
- **Key files:** roadmap.md (prompts), README.md (docs), errors.md (lessons).
- **Errors:** Check errors.md when stuck; add entries when fixing bugs; re-read relevant sections before changing critical flows.
- **Roadmap:** Use status tags (`IN PROGRESS` / `EXECUTED`) in roadmap.md and keep prompt text unchanged.
- **Documentation:** After major UI changes, add screenshots to `docs/screenshots/` and update README. After file structure changes, update README.
