# roadmap.md — Hypothetical Data Center Sandbox (v0)

This roadmap splits the MVP into small, agent-friendly prompts.  
UI reference: `src/ui/`, `app/globals.css`, and `src/scene/Viewport.tsx` (dark canvas + glass spec panel + explorer + bottom controls).

---

## Prompt 01 — Project scaffold + routes
<!-- EXECUTED -->

**Prompt**  
Set up a Next.js + TypeScript app with a single route `/` hosting the sandbox. Add a clean file structure for `ui/`, `scene/`, `model/`, and `state/`.

**Expected output**
- Next.js app running locally
- Folder structure:
  - `src/ui/*`
  - `src/scene/*`
  - `src/model/*`
  - `src/state/*`

**Acceptance criteria**
- `npm run dev` loads `/`
- TypeScript strict mode enabled
- Layout placeholder visible

---

## Prompt 02 — UI shell cloned from reference (no 3D yet)
<!-- EXECUTED -->

**Prompt**  
Recreate the UI shell to match the in-repo reference (`src/ui/`, `app/globals.css`): dark canvas, left explorer, top-right glass spec panel, bottom-right control pills. Use shared CSS variables.

**Expected output**
- Layout visually matches reference
- Components: `ExplorerTree`, `SpecsPanel`, `BottomControls`

**Acceptance criteria**
- Glass blur and borders correct
- UI does not block render surface

---

## Prompt 03 — Global state store
<!-- EXECUTED -->

**Prompt**  
Implement a global store with:
- params: IT load, area, halls, white space ratio, rack density, redundancy, PUE, cooling, containment
- selection: id + type
- viewMode: orbit / pan
- ui: drawer open state

**Expected output**
- Typed store with actions
- Default preset values

**Acceptance criteria**
- Param updates propagate instantly
- Selection reflected in UI

---

## Prompt 04 — Parameter drawer
<!-- EXECUTED -->

**Prompt**  
Create a collapsible parameter drawer with sliders and dropdowns for all inputs.

**Expected output**
- `ParamDrawer` component
- Debounced slider updates

**Acceptance criteria**
- Smooth open/close
- Metric units shown (MW, m², kW)

---

## Prompt 05 — DataCenterModel (core logic)
<!-- EXECUTED -->

**Prompt**  
Implement pure functions converting params to a scene description:
- facility load
- rack count
- white space and hall areas
- rack distribution and row packing

**Expected output**
- `computeDataCenter(params)` function

**Acceptance criteria**
- Reasonable default output
- Rack count responds to IT load and density

---

## Prompt 06 — 3D renderer foundation
<!-- EXECUTED -->

**Prompt**  
Add a Three.js renderer with full-screen canvas, camera, lighting, resize handling.

**Expected output**
- Grid floor
- Placeholder building box

**Acceptance criteria**
- Stable ~60 fps
- No memory leaks on reload

---

## Prompt 07 — Building + halls geometry
<!-- EXECUTED -->

**Prompt**  
Generate translucent building shell and internal halls from the model.

**Expected output**
- Visible building and halls
- Hover and selection highlighting

**Acceptance criteria**
- Hall count reorganizes layout
- Spec panel updates on selection

---

## Prompt 08 — Procedural racks (InstancedMesh)
<!-- EXECUTED -->

**Prompt**  
Generate racks using instancing. Lay out rows and aisles per hall.

**Expected output**
- Dense rack rows
- Hover and selection via raycasting

**Acceptance criteria**
- Rack count updates correctly
- Instancing confirmed

---

## Prompt 09 — Systems overlays
<!-- EXECUTED -->

**Prompt**  
Add containment walls, cable trays, and power routing lines.

**Expected output**
- Assembly-style overlays
- Visible redundancy topology

**Acceptance criteria**
- N / N+1 / 2N visually distinct
- Containment toggles work

---

## Prompt 10 — Cooling + heat overlay

**Prompt**  
Add a thermal overlay driven by rack density and cooling mode.

**Expected output**
- Heat planes or rack tinting
- Cooling indicators

**Acceptance criteria**
- Density changes affect heat visually
- Cooling mode changes overlay style

---

## Prompt 11 — Scroll-driven camera tour

**Prompt**  
Implement a scroll-based camera walkthrough with multiple focus sections.

**Expected output**
- Smooth camera interpolation
- Section emphasis

**Acceptance criteria**
- Scroll works in both directions
- Orbit/pan remains usable

---

## Prompt 12 — Spec panel binding

**Prompt**  
Bind spec panel content to selection and KPIs.

**Expected output**
- Context-aware spec panel
- Always-visible KPIs

**Acceptance criteria**
- Updates within 100 ms
- Different views per selection type

---

## Prompt 13 — Interaction controls

**Prompt**  
Implement orbit, pan, reset, and quality toggles.

**Expected output**
- Controls match reference behavior

**Acceptance criteria**
- Camera modes function correctly
- Reset respects current section

---

## Prompt 14 — Performance pass

**Prompt**  
Optimize instancing, memoization, debouncing, and LOD.

**Expected output**
- Stable performance at scale

**Acceptance criteria**
- ~60 fps on default preset
- Graceful behavior at high rack counts

---

## Prompt 15 — Polish

**Prompt**  
Add cutaway mode, presets, and URL-shareable state.

**Expected output**
- Cutaway improves clarity
- Shareable links reproduce state

**Acceptance criteria**
- No interaction regressions
- Presets apply predictably

---

## Definition of Done (v0)

- Fully procedural, no external assets
- Parameter-driven 3D data center visualization
- Scroll-based spatial walkthrough
- UI matches reference layout and tone
- Selection-driven spec panel updates
