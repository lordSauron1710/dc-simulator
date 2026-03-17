# DC Simulator

Parameter-driven data center visualization sandbox with a Next.js dashboard, typed global state, and an interactive viewport.

Live deployment: [dc-simulator-omega.vercel.app](https://dc-simulator-omega.vercel.app)

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](https://www.typescriptlang.org/)
[![Roadmap](https://img.shields.io/badge/Roadmap-01--15%20executed-blue)](roadmap.md)

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
│   └── screenshots/
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
├── AGENTS.md
├── API.md
├── AUTH.md
├── ACCESSIBILITY.md
├── DATABASE.md
├── DEPLOYMENT.md
├── ENV_VARIABLES.md
├── errors.md
├── INCIDENT_RESPONSE.md
├── POLICY_INDEX.md
├── roadmap.md
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

- `roadmap.md`: ordered implementation prompts and execution status tags.
- `errors.md`: known issues, fixes, and lessons learned by category.
- `AGENTS.md`: contributor/agent rules for architecture, style, and deployability.
- `POLICY_INDEX.md`: security policy entrypoint for humans and AI agents.
- `SECURITY.md`: core repo security rules and merge checks.
- `AUTH.md`, `API.md`, `DATABASE.md`: requirements for introducing server trust boundaries.
- `ENV_VARIABLES.md`, `.env.example`, `DEPLOYMENT.md`: rules for configuration and production rollout.
- `INCIDENT_RESPONSE.md`: containment and recovery workflow for security events.
- `security_best_practices_report.md`: current security audit summary and remaining follow-up item.

## Security baseline

- ShipSecure-style policy files are committed at the repo root and should be updated with any new security-sensitive surface area.
- The security policy set is supplementary to `AGENTS.md`; it is meant to constrain unsafe implementation choices, not to change the app's product goal or repo conventions.
- The current app has no auth layer, no API routes, no database, and no required environment variables.
- If a PR adds auth, APIs, persistence, or secrets, update the relevant policy docs in the same change.
- Run `npx secure-repo audit` before shipping security-sensitive changes.

## Roadmap status

- Executed: Prompts 01-15.
- Pending: None in v0 roadmap.

## License

License file has not been added yet.

## Star tracker

[![Star History Chart](https://api.star-history.com/svg?repos=lordSauron1710/dc-simulator&type=Date)](https://star-history.com/#lordSauron1710/dc-simulator&Date)
