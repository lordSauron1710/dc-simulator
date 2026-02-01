# DC Simulator

A parameter-driven 3D data center visualization sandbox. Model, configure, and explore hyperscale and enterprise data center infrastructure through an interactive web experience.

<!-- 
📸 Screenshot placeholder — replace with actual screenshot after major UI updates
Add screenshots to docs/screenshots/ and reference the latest one here
-->
![DC Simulator Screenshot](docs/screenshots/dc-simulator-ui.png)

---

## Features

- **Interactive 3D Visualization** — Explore a procedurally generated data center with racks, data halls, and MEP systems
- **Parameter-Driven Design** — Adjust critical IT load, whitespace, rack density, cooling topology, and more in real-time
- **Industry-Standard Terminology** — Uses data center engineering conventions (PUE, N+1/2N redundancy, containment strategies)
- **Glass Morphism UI** — Modern, polished interface with smooth animations
- **Collapsible Parameter Drawer** — Fine-tune all facility parameters with debounced sliders and dropdowns
- **Selection System** — Click to inspect buildings, data halls, and individual racks
- **Responsive Layout** — Three-panel design with explorer, 3D viewport, and specs panel

### Parameters

| Category | Parameter | Unit | Description |
|----------|-----------|------|-------------|
| **Facility** | Critical IT Load | MW | Total power consumed by IT equipment |
| | Whitespace Area | sq ft | Raised floor area for IT equipment |
| | Data Halls | count | Number of discrete computer rooms |
| | Whitespace Ratio | % | Ratio of IT space to total footprint |
| **IT Equipment** | Avg. Rack Density | kW/rack | Average power per rack |
| | Power Redundancy | N / N+1 / 2N | Infrastructure redundancy topology |
| **MEP Systems** | Target PUE | ratio | Power Usage Effectiveness target |
| | Cooling Type | — | Air-Cooled / DLC / Hybrid |
| | Containment | — | Hot Aisle / Cold Aisle / Full Enclosure

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [Next.js 14](https://nextjs.org/) (App Router) |
| Language | [TypeScript](https://www.typescriptlang.org/) (strict mode) |
| UI | [React 18](https://react.dev/) |
| Styling | CSS with design tokens (variables) |
| 3D | [Three.js](https://threejs.org/) (planned) |
| State | React Context + useReducer |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18.x or later
- npm 9.x or later (comes with Node.js)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/dc-simulator.git
cd dc-simulator

# Install dependencies
npm install
```

### Development

```bash
# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
# Create optimized production build
npm run build

# Start production server
npm run start
```

---

## Project Structure

```
dc-simulator/
├── app/                    # Next.js App Router
│   ├── globals.css         # Global styles and CSS variables
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Main sandbox page
│   └── Providers.tsx       # Context providers wrapper
│
├── src/
│   ├── model/              # Pure functions for data center calculations
│   │
│   ├── scene/              # 3D rendering (Three.js)
│   │   └── Viewport.tsx    # 3D viewport component
│   │
│   ├── state/              # Global state management
│   │   ├── actions.ts      # Action creators
│   │   ├── index.ts        # Public exports
│   │   ├── reducer.ts      # State reducer
│   │   ├── store.tsx       # Store provider and hook
│   │   └── types.ts        # TypeScript types
│   │
│   └── ui/                 # UI components
│       ├── BottomControls.tsx
│       ├── Dropdown.tsx
│       ├── ExplorerTree.tsx
│       ├── IconButton.tsx
│       ├── InputField.tsx
│       ├── ParamDrawer.tsx
│       ├── Slider.tsx
│       ├── SpecsPanel.tsx
│       └── TreeItem.tsx
│
├── docs/
│   └── screenshots/        # UI screenshots for documentation
│
├── AGENTS.md               # AI agent instructions
├── errors.md               # Error log and lessons learned
├── roadmap.md              # Development roadmap and prompts
└── README.md               # This file
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Create optimized production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint for code quality |

---

## Roadmap

Development is tracked in [`roadmap.md`](roadmap.md). Current progress:

- [x] Project scaffold + routes
- [x] UI shell (explorer, spec panel, controls)
- [x] Global state store
- [x] Parameter drawer with sliders/dropdowns
- [ ] DataCenterModel (core logic)
- [ ] 3D renderer foundation
- [ ] Building + halls geometry
- [ ] Procedural racks (InstancedMesh)
- [ ] Systems overlays
- [ ] Cooling + heat overlay
- [ ] Scroll-driven camera tour
- [ ] Spec panel binding
- [ ] Interaction controls
- [ ] Performance optimization
- [ ] Polish (cutaway, presets, URL sharing)

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Check existing issues** before creating new ones
2. **Follow the code style** — TypeScript strict mode, CSS variables, small focused components
3. **Update documentation** — Keep README and comments accurate
4. **Test your changes** — Ensure `npm run build` succeeds

### For AI Agents

If you're an AI agent working on this project, please read [`AGENTS.md`](AGENTS.md) for specific instructions on code style, error handling, and documentation requirements.

---

## Design Tokens

The UI uses CSS variables defined in `app/globals.css`:

```css
/* Colors */
--bg-canvas: #1E1E1E
--bg-panel-glass: rgba(44, 44, 44, 0.90)
--bg-active: #18A0FB
--text-primary: #FFFFFF
--text-secondary: #A1A1A1

/* Spacing */
--space-xs: 4px
--space-sm: 8px
--space-md: 12px
--space-lg: 16px

/* Radii */
--radius-sm: 2px
--radius-md: 4px
--radius-lg: 6px
```

---

## Glossary

| Term | Definition |
|------|------------|
| **Critical IT Load** | Total electrical power consumed by IT equipment (servers, storage, networking) |
| **Whitespace** | Raised floor area dedicated to IT equipment, excluding support spaces |
| **Data Hall** | A discrete room within a data center containing IT equipment |
| **PUE** | Power Usage Effectiveness — Total Facility Power ÷ IT Equipment Power (1.0 = perfect efficiency) |
| **N / N+1 / 2N** | Redundancy configurations: N = no redundancy, N+1 = one backup, 2N = fully duplicated |
| **DLC** | Direct Liquid Cooling — cooling method where liquid contacts or closely approaches heat sources |
| **Containment** | Physical barriers separating hot and cold air streams to improve cooling efficiency |
| **MEP** | Mechanical, Electrical, and Plumbing — the core infrastructure systems |

---

## License

This project is open source. See [LICENSE](LICENSE) for details.

---

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI inspired by modern design tools (Figma, Linear)
- 3D powered by [Three.js](https://threejs.org/)
