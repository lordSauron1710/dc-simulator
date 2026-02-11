import type { Params, Selection } from "./types";

export type PresetId =
  | "enterprise-colo"
  | "hyperscale-cloud"
  | "edge-module"
  | "ai-liquid";

export interface DataCenterPreset {
  id: PresetId;
  label: string;
  description: string;
  params: Params;
  selection: Selection;
}

export const DATA_CENTER_PRESETS: DataCenterPreset[] = [
  {
    id: "enterprise-colo",
    label: "Enterprise Colocation",
    description: "Balanced Tier III profile with moderate density and N+1 redundancy.",
    params: {
      criticalLoadMW: 2,
      whitespaceAreaSqFt: 20000,
      dataHalls: 2,
      whitespaceRatio: 0.4,
      rackPowerDensity: 8,
      redundancy: "N+1",
      pue: 1.4,
      coolingType: "Air-Cooled",
      containment: "Hot Aisle",
    },
    selection: { type: "building", id: "B-01" },
  },
  {
    id: "hyperscale-cloud",
    label: "Hyperscale Cloud",
    description: "Large campus layout with many halls and efficient air cooling.",
    params: {
      criticalLoadMW: 180,
      whitespaceAreaSqFt: 650000,
      dataHalls: 18,
      whitespaceRatio: 0.56,
      rackPowerDensity: 16,
      redundancy: "2N",
      pue: 1.22,
      coolingType: "Air-Cooled",
      containment: "Cold Aisle",
    },
    selection: { type: "hall", id: "H-01" },
  },
  {
    id: "edge-module",
    label: "Edge Module",
    description: "Compact edge footprint tuned for fast deployment and resilience.",
    params: {
      criticalLoadMW: 8,
      whitespaceAreaSqFt: 65000,
      dataHalls: 4,
      whitespaceRatio: 0.36,
      rackPowerDensity: 14,
      redundancy: "N+1",
      pue: 1.34,
      coolingType: "Hybrid",
      containment: "Hot Aisle",
    },
    selection: { type: "hall", id: "H-01" },
  },
  {
    id: "ai-liquid",
    label: "AI Liquid Cluster",
    description: "High-density liquid-cooled profile for accelerated compute loads.",
    params: {
      criticalLoadMW: 120,
      whitespaceAreaSqFt: 300000,
      dataHalls: 8,
      whitespaceRatio: 0.52,
      rackPowerDensity: 42,
      redundancy: "2N",
      pue: 1.14,
      coolingType: "DLC",
      containment: "Full Enclosure",
    },
    selection: { type: "hall", id: "H-01" },
  },
];

const PARAM_KEYS: Array<keyof Params> = [
  "criticalLoadMW",
  "whitespaceAreaSqFt",
  "dataHalls",
  "whitespaceRatio",
  "rackPowerDensity",
  "redundancy",
  "pue",
  "coolingType",
  "containment",
];

function paramsEqual(left: Params, right: Params): boolean {
  return PARAM_KEYS.every((key) => {
    const leftValue = left[key];
    const rightValue = right[key];

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return Math.abs(leftValue - rightValue) < 0.0001;
    }

    return leftValue === rightValue;
  });
}

export function getPresetById(id: PresetId): DataCenterPreset | null {
  return DATA_CENTER_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function detectPresetId(params: Params): PresetId | null {
  const matched = DATA_CENTER_PRESETS.find((preset) => paramsEqual(preset.params, params));
  return matched?.id ?? null;
}
