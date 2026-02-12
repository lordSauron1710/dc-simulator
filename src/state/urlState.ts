import type {
  AppState,
  CoolingType,
  ContainmentType,
  Params,
  Redundancy,
  Selection,
  SelectionType,
  ViewMode,
} from "./types";

const VALID_REDUNDANCY = new Set<Redundancy>(["N", "N+1", "2N"]);
const VALID_COOLING = new Set<CoolingType>(["Air-Cooled", "DLC", "Hybrid"]);
const VALID_CONTAINMENT = new Set<ContainmentType>([
  "None",
  "Hot Aisle",
  "Cold Aisle",
  "Full Enclosure",
]);
const VALID_VIEW_MODE = new Set<ViewMode>(["orbit", "pan"]);
const VALID_SELECTION_TYPE = new Set<SelectionType>(["building", "hall", "rack", null]);

interface ParamRange {
  min: number;
  max: number;
}

const PARAM_RANGES: Record<keyof Omit<Params, "redundancy" | "coolingType" | "containment">, ParamRange> = {
  criticalLoadMW: { min: 0.5, max: 1000 },
  whitespaceAreaSqFt: { min: 5000, max: 1000000 },
  dataHalls: { min: 1, max: 100 },
  whitespaceRatio: { min: 0.25, max: 0.65 },
  rackPowerDensity: { min: 3, max: 80 },
  pue: { min: 1.05, max: 2 },
};

function clamp(value: number, range: ParamRange): number {
  return Math.min(range.max, Math.max(range.min, value));
}

function parseNumber(raw: string | null): number | null {
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(raw: string | null): boolean | null {
  if (raw === null) {
    return null;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }

  return null;
}

function parseSelection(raw: string | null): Selection | null {
  if (!raw) {
    return null;
  }

  const separatorIndex = raw.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex >= raw.length - 1) {
    return null;
  }

  const typeValue = raw.slice(0, separatorIndex) as Exclude<SelectionType, null>;
  const idValue = raw.slice(separatorIndex + 1);
  if (!VALID_SELECTION_TYPE.has(typeValue) || !idValue) {
    return null;
  }

  return { type: typeValue, id: idValue };
}

export function parseStateFromSearch(search: string): Partial<AppState> | null {
  const normalized = search.startsWith("?") ? search.slice(1) : search;
  if (!normalized) {
    return null;
  }

  const query = new URLSearchParams(normalized);
  if (query.size === 0) {
    return null;
  }

  const paramsPatch: Partial<Params> = {};

  const criticalLoad = parseNumber(query.get("cl"));
  if (criticalLoad !== null) {
    paramsPatch.criticalLoadMW = clamp(criticalLoad, PARAM_RANGES.criticalLoadMW);
  }

  const whitespaceArea = parseNumber(query.get("wa"));
  if (whitespaceArea !== null) {
    paramsPatch.whitespaceAreaSqFt = Math.round(clamp(whitespaceArea, PARAM_RANGES.whitespaceAreaSqFt));
  }

  const dataHalls = parseNumber(query.get("dh"));
  if (dataHalls !== null) {
    paramsPatch.dataHalls = Math.round(clamp(dataHalls, PARAM_RANGES.dataHalls));
  }

  const whitespaceRatio = parseNumber(query.get("wr"));
  if (whitespaceRatio !== null) {
    paramsPatch.whitespaceRatio = Number(clamp(whitespaceRatio, PARAM_RANGES.whitespaceRatio).toFixed(2));
  }

  const rackDensity = parseNumber(query.get("rd"));
  if (rackDensity !== null) {
    paramsPatch.rackPowerDensity = Number(clamp(rackDensity, PARAM_RANGES.rackPowerDensity).toFixed(2));
  }

  const pue = parseNumber(query.get("pe"));
  if (pue !== null) {
    paramsPatch.pue = Number(clamp(pue, PARAM_RANGES.pue).toFixed(2));
  }

  const redundancy = query.get("re") as Redundancy | null;
  if (redundancy && VALID_REDUNDANCY.has(redundancy)) {
    paramsPatch.redundancy = redundancy;
  }

  const coolingType = query.get("ct") as CoolingType | null;
  if (coolingType && VALID_COOLING.has(coolingType)) {
    paramsPatch.coolingType = coolingType;
  }

  const containment = query.get("cn") as ContainmentType | null;
  if (containment && VALID_CONTAINMENT.has(containment)) {
    paramsPatch.containment = containment;
  }

  const selection = parseSelection(query.get("sel"));

  const viewModeCandidate = query.get("vm") as ViewMode | null;
  const viewMode = viewModeCandidate && VALID_VIEW_MODE.has(viewModeCandidate)
    ? viewModeCandidate
    : null;

  const scrollFlow = parseBoolean(query.get("sf"));
  const cutawayEnabled = parseBoolean(query.get("cw"));

  const nextState: Partial<AppState> = {};
  if (Object.keys(paramsPatch).length > 0) {
    nextState.params = paramsPatch as Params;
  }
  if (selection) {
    nextState.selection = selection;
  }
  if (viewMode) {
    nextState.viewMode = viewMode;
  }
  if (scrollFlow !== null || cutawayEnabled !== null) {
    nextState.ui = {
      ...(scrollFlow !== null ? { scrollFlowEnabled: scrollFlow } : {}),
      ...(cutawayEnabled !== null ? { cutawayEnabled } : {}),
    } as AppState["ui"];
  }

  return Object.keys(nextState).length > 0 ? nextState : null;
}

export function serializeStateToSearch(state: AppState): string {
  const query = new URLSearchParams();

  query.set("cl", state.params.criticalLoadMW.toString());
  query.set("wa", Math.round(state.params.whitespaceAreaSqFt).toString());
  query.set("dh", Math.round(state.params.dataHalls).toString());
  query.set("wr", state.params.whitespaceRatio.toString());
  query.set("rd", state.params.rackPowerDensity.toString());
  query.set("re", state.params.redundancy);
  query.set("pe", state.params.pue.toString());
  query.set("ct", state.params.coolingType);
  query.set("cn", state.params.containment);

  if (state.selection.type) {
    query.set("sel", `${state.selection.type}:${state.selection.id}`);
  }

  query.set("vm", state.viewMode);
  query.set("sf", state.ui.scrollFlowEnabled ? "1" : "0");
  query.set("cw", state.ui.cutawayEnabled ? "1" : "0");

  return query.toString();
}

export function buildShareUrl(state: AppState): string {
  if (typeof window === "undefined") {
    return "";
  }

  const url = new URL(window.location.href);
  const search = serializeStateToSearch(state);
  url.search = search ? `?${search}` : "";
  return url.toString();
}
