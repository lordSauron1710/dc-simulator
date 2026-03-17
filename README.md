# DC Simulator

Parameter-driven data center visualization sandbox with a Next.js dashboard, typed global state, and an interactive viewport.

Live deployment: [dc-simulator-omega.vercel.app](https://dc-simulator-omega.vercel.app)

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](https://www.typescriptlang.org/)
[![Roadmap](https://img.shields.io/badge/Roadmap-01--18%20executed-blue)](docs/project/roadmap.md)

![DC Simulator UI (Campus Builder)](docs/screenshots/ui-campus-builder-v1.png)

## What it does

- Provides a dark-canvas sandbox UI with a left-rail authoring workspace that separates structural campus building from rack-parameter tuning.
- Supports hierarchy-first modeling (`Campus -> Zone -> Data Hall -> Rack count`) with direct inline add/remove actions.
- Exposes rack-module technical controls at campus, zone, or individual hall scope with immediate scene/spec updates.
- Uses industry-aligned data center terminology (critical load, PUE, redundancy, containment).
- Keeps model-facing inputs typed and centralized via a React Context + reducer store.
- Adds a typed v1 campus hierarchy (`Campus -> Zone -> Hall -> Rack`) with v0-compatible hydration.
- Includes cutaway mode, scenario presets, and URL-synced state for reproducible views.
- Adds mobile-friendly overlay behavior with quick panel toggles and one-tap "minimize all" UI controls.
- Maintains a deployment-friendly Next.js setup with standard build/start commands.

## Architecture

```text
Next.js App Router page (/)
  -> StoreProvider (typed app state)
  -> Authoring Workspace (CampusBuilderPanel + CampusParametersPanel tabs) + SpecsPanel + BottomControls
  -> Viewport (Three.js procedural building, halls, instanced racks, overlays, thermal layers, cutaway, and scroll/orbit/pan camera controls)
```

## Repository layout

```text
dc-simulator/
├── app/
│   ├── Providers.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── docs/
│   ├── policies/
│   │   ├── ACCESSIBILITY.md
│   │   ├── API.md
│   │   ├── AUTH.md
│   │   ├── DATABASE.md
│   │   ├── DEPLOYMENT.md
│   │   ├── ENV_VARIABLES.md
│   │   ├── INCIDENT_RESPONSE.md
│   │   ├── POLICY_INDEX.md
│   │   └── SECURITY.md
│   ├── project/
│   │   ├── errors.md
│   │   └── roadmap.md
│   ├── reports/
│   │   └── security_best_practices_report.md
│   └── screenshots/
├── ACCESSIBILITY.md
├── API.md
├── AGENTS.md
├── AUTH.md
├── DATABASE.md
├── DEPLOYMENT.md
├── ENV_VARIABLES.md
├── INCIDENT_RESPONSE.md
├── SECURITY.md
├── src/
│   ├── model/
│   │   ├── campus.ts
│   │   ├── campusBuilder.ts
│   │   └── dataCenter.ts
│   ├── scene/
│   │   └── Viewport.tsx
│   ├── state/
│   │   ├── actions.ts
│   │   ├── index.ts
│   │   ├── migrations.ts
│   │   ├── presets.ts
│   │   ├── reducer.ts
│   │   ├── store.tsx
│   │   ├── types.ts
│   │   └── urlState.ts
│   └── ui/
│       ├── BottomControls.tsx
│       ├── CampusBuilderPanel.tsx
│       ├── CampusParametersPanel.tsx
│       ├── Dropdown.tsx
│       ├── ExplorerTree.tsx
│       ├── IconButton.tsx
│       ├── InputField.tsx
│       ├── ParamDrawer.tsx
│       ├── PresetsPanel.tsx
│       ├── Slider.tsx
│       ├── SpecsPanel.tsx
│       └── TreeItem.tsx
└── README.md
```

## Prerequisites

- Node.js 18+
- npm 9+

## Quick start

```bash
git clone https://github.com/your-username/dc-simulator.git
cd dc-simulator
npm install
npm run dev
```

## Testing

```bash
# Install the Chromium browser once for Playwright
npm run test:e2e:install

# Unit and pure-model coverage
npm test

# Production-like browser regression run
npm run test:e2e

# Full release gate
npm run test:all
```

`npm run test:all` is the repo's "all tests passed" command. It runs the Vitest suite, validates a production build, then launches the built app and executes the browser regression suite against the core UI flows and high-range scenarios.

## Data center parameters

| Category | Parameter | Unit | Description |
|---|---|---|---|
| Facility | Critical IT Load | MW | Total IT equipment power |
| Facility | Whitespace Area | sq ft | IT whitespace footprint |
| Facility | Data Halls | count | Number of halls |
| Facility | Whitespace Ratio | % | Whitespace-to-total footprint ratio |
| IT Equipment | Avg. Rack Density | kW/rack | Average rack load |
| IT Equipment | Power Redundancy | N / N+1 / 2N | Infrastructure redundancy model |
| MEP Systems | Target PUE | ratio | Energy efficiency target |
| MEP Systems | Cooling Type | Air-Cooled / DLC / Hybrid | Primary cooling method |
| MEP Systems | Containment | None / Hot Aisle / Cold Aisle / Full Enclosure | Airflow strategy |

## Documentation map

- `docs/project/roadmap.md`: ordered implementation prompts and execution status tags.
- `docs/project/errors.md`: known issues, fixes, and lessons learned by category.
- `AGENTS.md`: contributor/agent rules for architecture, style, and deployability.
- `docs/policies/POLICY_INDEX.md`: security policy entrypoint for humans and AI agents.
- Root policy stub files (`SECURITY.md`, `AUTH.md`, `API.md`, and related companions): compatibility shims for `secure-repo`; the canonical policy content stays under `docs/policies/`.
- `docs/policies/SECURITY.md`: core repo security rules and merge checks.
- `docs/policies/AUTH.md`, `docs/policies/API.md`, `docs/policies/DATABASE.md`: requirements for introducing server trust boundaries.
- `docs/policies/ENV_VARIABLES.md`, `.env.example`, `docs/policies/DEPLOYMENT.md`: rules for configuration and production rollout.
- `docs/policies/INCIDENT_RESPONSE.md`: containment and recovery workflow for security events.
- `docs/reports/security_best_practices_report.md`: current security audit summary and remediation status.

## Security baseline

- ShipSecure-style policy files live under `docs/policies/` and should be updated with any new security-sensitive surface area.
- Root-level policy stub files exist only for audit-tool compatibility; `docs/policies/` remains the source of truth.
- The security policy set is supplementary to `AGENTS.md`; it is meant to constrain unsafe implementation choices, not to change the app's product goal or repo conventions.
- The current app has no auth layer, no API routes, no database, and no required environment variables.
- Production responses include baseline browser hardening headers via [`next.config.js`](next.config.js): `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, and a conservative CSP with `frame-ancestors 'none'`.
- The production dependency line is now on `next@15.5.13`, which clears the previously reported high-severity advisory on the old 14.x range.
- If a PR adds auth, APIs, persistence, or secrets, update the relevant policy docs in the same change.
- Run `npx secure-repo audit` before shipping security-sensitive changes.

## Roadmap status

- Executed: Prompts 01-18.
- Pending/untagged: Prompts 19-31.

## License

License file has not been added yet.

## Star tracker

[![Star History Chart](https://api.star-history.com/svg?repos=lordSauron1710/dc-simulator&type=Date)](https://star-history.com/#lordSauron1710/dc-simulator&Date)
