/**
 * Global store types for DC Simulator (Prompt 03).
 * params: data-center inputs; selection: current focus; viewMode: camera; ui: overlay state.
 * v1 adds a typed campus hierarchy to support campus-scale authoring and simulation.
 *
 * Industry terminology:
 * - Critical IT Load: Total power consumed by IT equipment (servers, storage, network)
 * - Whitespace: Raised floor area dedicated to IT equipment (excludes support spaces)
 * - Data Hall: A discrete room containing IT equipment within a data center
 * - PUE: Power Usage Effectiveness = Total Facility Power / IT Equipment Power
 * - N/N+1/2N: Redundancy configurations for critical infrastructure
 */
import {
  buildDefaultCampusFromParams,
  type Campus,
  type Zone,
  type Hall,
  type Rack,
  type EntityMetadata,
} from "@/model";

/** Power redundancy topology per Uptime Institute tiers */
export type Redundancy = "N" | "N+1" | "2N";

/** Primary cooling methodology */
export type CoolingType = "Air-Cooled" | "DLC" | "Hybrid";

/** Airflow containment strategy */
export type ContainmentType = "None" | "Hot Aisle" | "Cold Aisle" | "Full Enclosure";

export interface Params {
  /** Critical IT load in megawatts (MW) */
  criticalLoadMW: number;
  /** Whitespace area in square feet (sq ft) */
  whitespaceAreaSqFt: number;
  /** Number of data halls */
  dataHalls: number;
  /** Ratio of whitespace to total facility footprint (0.0–1.0) */
  whitespaceRatio: number;
  /** Average power density per rack in kilowatts (kW/rack) */
  rackPowerDensity: number;
  /** Power redundancy configuration */
  redundancy: Redundancy;
  /** Power Usage Effectiveness target */
  pue: number;
  /** Primary cooling methodology */
  coolingType: CoolingType;
  /** Airflow containment strategy */
  containment: ContainmentType;
}

export type SelectionType = "building" | "hall" | "rack" | null;

export interface Selection {
  id: string;
  type: SelectionType;
}

export type ViewMode = "orbit" | "pan";

export interface UIState {
  drawerOpen: boolean;
  cameraResetNonce: number;
  scrollFlowEnabled: boolean;
  cutawayEnabled: boolean;
}

export interface AppState {
  params: Params;
  campus: Campus;
  selection: Selection;
  viewMode: ViewMode;
  ui: UIState;
}

/**
 * Default preset: Enterprise colocation profile
 * - 2 MW critical load (mid-size enterprise)
 * - 20,000 sq ft whitespace (~1,860 m²)
 * - 2 data halls for redundancy
 * - 40% whitespace ratio (typical for Tier III)
 * - 8 kW/rack average density (moderate)
 * - N+1 redundancy (Tier III standard)
 * - 1.4 PUE (industry average)
 * - Air-cooled (most common)
 * - Hot aisle containment (best practice)
 */
export const DEFAULT_PARAMS: Params = {
  criticalLoadMW: 2,
  whitespaceAreaSqFt: 20000,
  dataHalls: 2,
  whitespaceRatio: 0.4,
  rackPowerDensity: 8,
  redundancy: "N+1",
  pue: 1.4,
  coolingType: "Air-Cooled",
  containment: "Hot Aisle",
};

export const DEFAULT_SELECTION: Selection = {
  id: "R-104",
  type: "rack",
};

export const DEFAULT_UI: UIState = {
  drawerOpen: true,
  cameraResetNonce: 0,
  scrollFlowEnabled: false,
  cutawayEnabled: false,
};

export const DEFAULT_CAMPUS: Campus = buildDefaultCampusFromParams(DEFAULT_PARAMS);

export const DEFAULT_STATE: AppState = {
  params: DEFAULT_PARAMS,
  campus: DEFAULT_CAMPUS,
  selection: DEFAULT_SELECTION,
  viewMode: "orbit",
  ui: DEFAULT_UI,
};

export type {
  Campus,
  Zone,
  Hall,
  Rack,
  EntityMetadata,
};
