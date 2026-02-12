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
<!-- EXECUTED -->

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
<!-- EXECUTED -->

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
<!-- EXECUTED -->

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
<!-- EXECUTED -->

**Prompt**  
Implement orbit, pan, reset, and quality toggles.

**Expected output**
- Controls match reference behavior

**Acceptance criteria**
- Camera modes function correctly
- Reset respects current section

---

## Prompt 14 — Performance pass
<!-- EXECUTED -->

**Prompt**  
Optimize instancing, memoization, debouncing, and LOD.

**Expected output**
- Stable performance at scale

**Acceptance criteria**
- ~60 fps on default preset
- Graceful behavior at high rack counts

---

## Prompt 15 — Polish
<!-- EXECUTED -->

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
<!-- EXECUTED: V0 COMPLETE -->

- Fully procedural, no external assets
- Parameter-driven 3D data center visualization
- Scroll-based spatial walkthrough
- UI matches reference layout and tone
- Selection-driven spec panel updates

---

# roadmap.md — Hypothetical Data Center Sandbox (v1)

This v1 roadmap extends the shipped v0 sandbox into a full campus authoring and runtime simulation product.  
Core focus: hierarchical campus editing, selection-aware scene scoping, animated operational playback, and parametrically controlled environment systems.

---

## Prompt 16 — Campus domain model upgrade

**Prompt**  
Introduce a typed hierarchical data model for the whole site:
- Campus -> Zones -> Halls -> Racks
- Stable IDs for all entities
- Metadata fields (names, notes, capacity targets, optional tags)
- Backward-compatible mapping from v0 params into a default campus

**Expected output**
- New state/model types for `Campus`, `Zone`, `Hall`, `Rack`
- Migration utilities that can hydrate v1 state from existing v0 URL/share state
- Default v1 campus generated from current v0 preset values

**Acceptance criteria**
- Existing v0 share links still load without runtime errors
- v1 default campus visually matches current baseline behavior
- TypeScript strict mode passes with no `any` regressions

---

## Prompt 17 — Explorer tree as live campus editor

**Prompt**  
Replace static explorer entries with data-driven campus hierarchy:
- Render campus, zones, halls, and racks from state
- Add actions for add/rename/delete/duplicate on zones/halls/racks
- Context actions keep parent-child integrity intact
- Inline validation for names and counts

**Expected output**
- Explorer shows full expandable hierarchy from live state
- Users can create and manage new zones and racks through explorer controls
- Safe delete behavior with confirmation for destructive actions

**Acceptance criteria**
- Any explorer CRUD action updates state and viewport within 100 ms
- Tree remains consistent after chained operations (add -> rename -> move/delete)
- No orphan halls/racks can exist after edits

---

## Prompt 18 — Campus builder panel (structured authoring UX)

**Prompt**  
Add a comprehensive campus builder panel:
- Edit campus name and top-level properties
- Add/edit zones with hall defaults and rack rules
- Add/edit halls with density, redundancy, containment, and cooling overrides
- Add/edit rack groups or rack counts per hall
- Form-first UX with clear constraints and helper text

**Expected output**
- New panel integrated with existing shell layout and glass UI style
- Typed forms and controlled inputs for all campus entities
- Validation summaries and actionable error messages

**Acceptance criteria**
- Invalid configurations are blocked with clear reasons
- Builder edits immediately propagate to scene and specs panel
- Panel remains usable on both desktop and small laptop breakpoints

---

## Prompt 19 — Comprehensive campus synthesis logic

**Prompt**  
Implement pure model logic to build the entire campus scene description:
- Aggregate load/power/cooling/area totals per hall, zone, and campus
- Rack allocation and packing derived from hall constraints
- Support mixed zone profiles across one campus
- Deterministic geometry-ready output for rendering

**Expected output**
- `computeCampusModel(campusConfig)` (or equivalent) in `src/model/`
- Derived summary objects for explorer/spec panel/runtime layers
- Caching/memoization strategy for large campuses

**Acceptance criteria**
- Same inputs always produce identical output shape and IDs
- Campus totals equal sum of child entities with no drift
- High-entity scenarios remain interactive with memoized recomputation

---

## Prompt 20 — Selection scope logic (rack, zone, campus)

**Prompt**  
Implement strict selection-driven visibility behavior:
- Selecting a rack isolates the selected rack in viewport
- Selecting a zone shows all racks/halls in that zone
- Selecting campus shows all zones and all racks
- Add optional focus mode (dim non-selected entities) as a toggle

**Expected output**
- Selection scope resolver for visibility and highlight rules
- UI toggle between `isolate` and `focus` behavior
- Updated spec panel context for each scope

**Acceptance criteria**
- Rack selection can render single-rack isolate view reliably
- Zone selection never leaks entities from other zones in isolate mode
- Campus selection restores full multi-zone view in one action

---

## Prompt 21 — Preset system v1 (system + user-defined campus presets)

**Prompt**  
Upgrade presets to store full campus definitions:
- Keep built-in presets
- Add user preset create/update/delete
- Include campus name, hierarchy, overrides, and selection scope
- Allow saving current campus state as a named preset

**Expected output**
- Preset schema v1 with full campus payload
- Preset management UI integrated with existing presets panel
- Import current edited campus into preset with one action

**Acceptance criteria**
- Applying any preset fully restores hierarchy and viewport scope
- Built-in and user presets can coexist without conflict
- Preset operations do not mutate built-in presets

---

## Prompt 22 — Persistence and sharing (URL + local draft storage)

**Prompt**  
Implement robust persistence for editable campus state:
- URL-serializable state for shareable scenarios
- Local draft persistence for large payloads and in-progress edits
- Versioned schema parse/serialize layer
- Compatibility with existing v0 search params

**Expected output**
- URL state v1 parser/serializer with migration handling
- LocalStorage draft management with safe recovery
- User feedback when payload exceeds practical URL size

**Acceptance criteria**
- Refresh restores in-progress campus edits from local draft
- Shared links recreate matching state when payload fits URL budget
- Corrupted/local stale state fails safely and falls back to defaults

---

## Prompt 23 — Run engine foundation (play/pause/resume/stop)

**Prompt**  
Add a global run system for dynamic operational playback:
- `Run`, `Pause`, `Resume`, and `Stop` controls
- Shared timeline clock used by all animations/effects
- Speed control (for example 0.5x, 1x, 2x)
- Deterministic behavior for repeatable demonstrations

**Expected output**
- Run state in global store with typed actions
- Bottom control extensions for runtime controls
- Viewport loop subscribed to run timeline state

**Acceptance criteria**
- Pause freezes all run-driven animations immediately
- Resume continues from previous frame/time state
- Stop resets run-driven visuals to baseline state

---

## Prompt 24 — Animated operational overlays

**Prompt**  
Build visual runtime effects for operations mode:
- Rack sparkle/twinkle effects (green/red server activity)
- Cooling pipe flow animation with direction/intensity
- Heatflow/exhaust motion overlays
- Wind turbine motion and linked utility visuals

**Expected output**
- Instanced or batched effect layers with low-overhead animation
- Parameter-linked effect intensity (load, cooling type, containment)
- Unified pause/play behavior through run engine

**Acceptance criteria**
- Rack and pipe animations are synchronized to run state
- Effects degrade gracefully under lower quality tiers
- No major frame pacing regressions from baseline v0 performance

---

## Prompt 25 — Runtime simulation KPIs

**Prompt**  
Add lightweight simulation dynamics tied to run timeline:
- KPI drift over simulated time (thermal index, overhead trend, risk flags)
- Cooling type and containment influence trend behavior
- Spec panel updates with live runtime stats
- Reset behavior on `Stop`

**Expected output**
- Pure simulation step functions separate from rendering code
- Runtime KPI widgets in specs panel
- Alert thresholds for hotspot or efficiency warnings

**Acceptance criteria**
- KPI trends are deterministic for same seed + same inputs
- Stop returns KPIs to baseline snapshot
- KPI updates remain responsive without UI stutter

---

## Prompt 26 — Scenario timeline authoring

**Prompt**  
Add timeline scenario capabilities:
- Create multi-step run sequences (state checkpoints)
- Scrub timeline position
- Play/pause per scenario
- Save scenario with preset context

**Expected output**
- Scenario model and editing controls
- Timeline UI with step markers and active-state visualization
- Scenario playback integrated with run engine and KPI simulation

**Acceptance criteria**
- Scrubbing updates scene and KPI state correctly
- Scenario playback is reversible and repeatable
- Saving/loading scenarios preserves all step definitions

---

## Prompt 27 — Environment system foundation

**Prompt**  
Add an optional environment layer around the campus:
- Procedural terrain
- Grass field generation
- Tree clusters
- Wind vector system for environment motion

**Expected output**
- Environment renderer module under `src/scene/`
- Parametric generation controls (density, spread, height variance)
- Toggle to enable/disable environment visibility

**Acceptance criteria**
- Environment can be switched on/off without rebuilding the page
- Terrain, grass, and trees scale with campus footprint
- Wind animation visibly affects grass movement

---

## Prompt 28 — Environment and lighting controls

**Prompt**  
Expose environment and lighting controls in UI:
- Terrain roughness/intensity
- Grass density and wind strength
- Tree density and variation
- Lighting controls (ambient intensity, directional light angle, fog strength)
- Global environment toggle in controls

**Expected output**
- New parameter section for environment/lighting
- Real-time update binding from controls to scene
- Quality-tier aware defaults

**Acceptance criteria**
- Control changes apply in real time without UI lockups
- Environment defaults to enabled with quality-aware fallback
- Performance mode reduces environment detail automatically

---

## Prompt 29 — Performance and stability hardening for v1 scale

**Prompt**  
Perform a v1 stability and performance pass:
- Cap effect counts based on quality tier and entity count
- Optimize raycasting targets and update loops
- Maintain disposal/cleanup discipline for all new scene resources
- Add instrumentation hooks for frame-time debugging

**Expected output**
- Updated LOD/detail-tier rules for racks, effects, and environment
- Memory-safe cleanup paths for run/environment systems
- Documented performance guardrails in code comments

**Acceptance criteria**
- Default preset remains smooth on standard developer hardware
- Heavy campus scenes remain usable in performance mode
- No new leak patterns after repeated play/pause and preset switching

---

## Prompt 30 — Product quality additions and documentation

**Prompt**  
Add high-impact UX improvements and finish documentation:
- Undo/redo for campus edits
- Constraint warnings and conflict hints
- Scenario/preset compare mode (A/B KPIs)
- JSON export/import for user presets and scenarios
- Update README screenshots and architecture sections for v1

**Expected output**
- Editor history stack with deterministic replay
- Conflict/warning surfaces in builder and specs panel
- Basic compare workflow for decision support
- Updated documentation and screenshots under `docs/screenshots/`

**Acceptance criteria**
- Undo/redo works across core CRUD and parameter edits
- Exported JSON can be imported into a fresh session
- README reflects current v1 architecture and controls

---

## Definition of Done (v1)

- Full campus authoring with hierarchical explorer and builder UI
- Selection scope works at rack, zone, hall, and campus levels
- Runtime playback supports animation, pause/resume, and KPI simulation
- Environment system supports terrain, vegetation, wind, and toggles
- Presets, scenarios, and persistence are shareable and recoverable
- Performance and deployability remain production-ready
