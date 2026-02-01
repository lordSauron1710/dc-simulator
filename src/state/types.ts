/**
 * Global store types for DC Simulator (Prompt 03).
 * params: data-center inputs; selection: current focus; viewMode: camera; ui: overlay state.
 */

export type Redundancy = "N" | "N+1" | "2N";
export type Cooling = "air" | "liquid" | "hybrid";
export type Containment = "none" | "hot" | "cold" | "full";

export interface Params {
  itLoadMW: number;
  areaSqm: number;
  halls: number;
  whiteSpaceRatio: number;
  rackDensity: number;
  redundancy: Redundancy;
  pue: number;
  cooling: Cooling;
  containment: Containment;
}

export type SelectionType = "building" | "hall" | "rack" | null;

export interface Selection {
  id: string;
  type: SelectionType;
}

export type ViewMode = "orbit" | "pan";

export interface UIState {
  drawerOpen: boolean;
}

export interface AppState {
  params: Params;
  selection: Selection;
  viewMode: ViewMode;
  ui: UIState;
}

/** Default preset: single hall, moderate density, N+1, air cooling. */
export const DEFAULT_PARAMS: Params = {
  itLoadMW: 2,
  areaSqm: 2000,
  halls: 2,
  whiteSpaceRatio: 0.4,
  rackDensity: 8,
  redundancy: "N+1",
  pue: 1.4,
  cooling: "air",
  containment: "hot",
};

export const DEFAULT_SELECTION: Selection = {
  id: "R-104",
  type: "rack",
};

export const DEFAULT_UI: UIState = {
  drawerOpen: true,
};

export const DEFAULT_STATE: AppState = {
  params: DEFAULT_PARAMS,
  selection: DEFAULT_SELECTION,
  viewMode: "orbit",
  ui: DEFAULT_UI,
};
