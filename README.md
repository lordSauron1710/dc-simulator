# DC Simulator

Parameter-driven data center visualization sandbox with a Next.js dashboard, typed global state, and an interactive viewport.

> **Current state:** Prompts 01-09 in `roadmap.md` are executed (project scaffold, UI shell, global store, parameter drawer, data model, Three.js foundation, hall geometry, procedural instanced racks, systems overlays).

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](https://www.typescriptlang.org/)
[![Roadmap](https://img.shields.io/badge/Roadmap-01--09%20executed-blue)](roadmap.md)

![DC Simulator UI](docs/screenshots/dc-simulator-ui.png)

## What it does

- Provides a dark-canvas sandbox UI for exploring data center entities and rack-level selection.
- Exposes key facility, IT, and MEP parameters through sliders/dropdowns with immediate state updates.
- Uses industry-aligned data center terminology (critical load, PUE, redundancy, containment).
- Keeps model-facing inputs typed and centralized via a React Context + reducer store.
- Maintains a deployment-friendly Next.js setup with standard build/start commands.

## Architecture

```text
Next.js App Router page (/)
  -> StoreProvider (typed app state)
  -> ExplorerTree + ParamDrawer + SpecsPanel + BottomControls
  -> Viewport (Three.js procedural building, halls, instanced racks, and systems overlays)
```

## Repository subway map

```mermaid
flowchart LR
  root["dc-simulator/"]

  root --> app["App line: app/"]
  root --> src["Core line: src/"]
  root --> docs["Docs line: docs/"]

  app --> a1["page.tsx (sandbox shell)"]
  app --> a2["Providers.tsx (state provider)"]
  app --> a3["globals.css (tokens + layout)"]

  src --> s1["ui/ (explorer, drawers, panels, controls)"]
  src --> s2["state/ (types, reducer, actions, store)"]
  src --> s3["scene/Viewport.tsx (viewport component)"]
  src --> s4["model/ (planned pure model functions)"]

  docs --> d1["screenshots/"]
  root --> r1["roadmap.md (prompt execution tracking)"]
  root --> r2["errors.md (bug log + lessons)"]
  root --> r3["AGENTS.md (agent rules)"]
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
│   ├── scene/
│   │   └── Viewport.tsx
│   ├── state/
│   │   ├── actions.ts
│   │   ├── index.ts
│   │   ├── reducer.ts
│   │   ├── store.tsx
│   │   └── types.ts
│   └── ui/
│       ├── BottomControls.tsx
│       ├── Dropdown.tsx
│       ├── ExplorerTree.tsx
│       ├── IconButton.tsx
│       ├── InputField.tsx
│       ├── ParamDrawer.tsx
│       ├── Slider.tsx
│       ├── SpecsPanel.tsx
│       └── TreeItem.tsx
├── AGENTS.md
├── errors.md
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

Local URL:

- App: `http://127.0.0.1:3000`

## Production build and run

```bash
npm run build
npm run start
```

This project uses the default Next.js server output and standard commands, so it is compatible with typical Vercel, Netlify, and Cloud Run deployment flows.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Build optimized production bundle |
| `npm run start` | Run production server |
| `npm run lint` | Run ESLint |

## Environment variables

No project-specific environment variables are currently required.

| Variable | Scope | Default | Notes |
|---|---|---|---|
| `NODE_ENV` | Runtime/build | managed by Next.js | Standard framework mode flag |
| `NEXT_PUBLIC_*` | Client | unset | Reserved for future client-safe config |

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

## Roadmap status

- Executed: Prompts 01-09.
- Pending: Prompts 10-15 (thermal overlay, camera tour, controls, performance pass, polish).

## License

License file has not been added yet.

## Star tracker

[![Star History Chart](https://api.star-history.com/svg?repos=lordSauron1710/dc-simulator&type=Date)](https://star-history.com/#lordSauron1710/dc-simulator&Date)
