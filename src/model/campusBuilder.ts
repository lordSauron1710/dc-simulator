import {
  computeDataCenter,
  type AreaSummary,
  type DataCenterModel,
  type FacilityLoadSummary,
  type HallRow,
} from "./dataCenter";
import {
  buildRackRange,
  formatHallId,
  type Campus,
  type ContainmentProfile,
  type CoolingProfile,
  type Hall,
  type RackGroup,
  type RedundancyProfile,
  type Zone,
  type ZoneRackRules,
} from "./campus";
import type { Params } from "@/state/types";

export interface CampusValidationIssue {
  path: string;
  message: string;
  recommendation: string;
}

export const CAMPUS_PARAM_LIMITS = {
  criticalLoadMW: { min: 0.5, max: 1000 },
  whitespaceAreaSqFt: { min: 5000, max: 1000000 },
  dataHalls: { min: 1, max: 100 },
  whitespaceRatio: { min: 0.25, max: 0.65 },
  rackPowerDensity: { min: 3, max: 80 },
  pue: { min: 1.05, max: 2 },
} as const;

const DEFAULT_RACKS_PER_ROW = 18;
const CAMPUS_MODEL_CACHE_PER_CAMPUS_LIMIT = 6;
const campusModelCache = new WeakMap<Campus, Map<string, CampusModel>>();

const REDUNDANCY_ORDER: readonly RedundancyProfile[] = ["N", "N+1", "2N"];
const COOLING_ORDER: readonly CoolingProfile[] = ["Air-Cooled", "DLC", "Hybrid"];
const CONTAINMENT_ORDER: readonly ContainmentProfile[] = ["None", "Hot Aisle", "Cold Aisle", "Full Enclosure"];

export type ParameterScopeLevel = "campus" | "zone" | "hall";

export interface CampusParameterScope {
  level: ParameterScopeLevel;
  zoneId?: string | null;
  hallId?: string | null;
}

export interface RackProfilePatch {
  rackDensityKW?: number;
  redundancy?: RedundancyProfile;
  containment?: ContainmentProfile;
  coolingType?: CoolingProfile;
}

export interface CampusPropertyPatch {
  targetPUE?: number;
  whitespaceRatio?: number;
}

export interface ProfileMixEntry<T extends string> {
  profile: T;
  hallCount: number;
  rackCount: number;
}

export interface ProfileMixSummary<T extends string> {
  dominantProfile: T;
  entries: ProfileMixEntry<T>[];
}

export interface HallAggregateSummary {
  id: string;
  hallIndex: number;
  zoneId: string;
  zoneIndex: number;
  name: string;
  rackCount: number;
  capacity: number;
  rackCapacityBySpace: number;
  rackDensityKW: number;
  utilization: number;
  rackStartIndex: number;
  rackEndIndex: number;
  facilityLoad: FacilityLoadSummary;
  area: {
    whitespaceSqFt: number;
    grossSqFt: number;
  };
  profiles: {
    redundancy: RedundancyProfile;
    coolingType: CoolingProfile;
    containment: ContainmentProfile;
  };
  dimensionsFt: {
    width: number;
    length: number;
  };
  packing: {
    rowCount: number;
    maxRows: number;
    targetRacksPerRow: number;
    maxRacksPerRow: number;
  };
  rows: HallRow[];
  geometry: {
    dimensionsFt: {
      width: number;
      length: number;
    };
    packing: {
      rowCount: number;
      maxRows: number;
      targetRacksPerRow: number;
      maxRacksPerRow: number;
    };
    rows: HallRow[];
  };
}

export interface ZoneAggregateSummary {
  id: string;
  zoneIndex: number;
  name: string;
  hallCount: number;
  rackCount: number;
  rackCapacityBySpace: number;
  utilization: number;
  rackCountFromPower: number;
  facilityLoad: FacilityLoadSummary;
  area: {
    whitespaceSqFt: number;
    grossSqFt: number;
  };
  profiles: {
    redundancy: ProfileMixSummary<RedundancyProfile>;
    coolingType: ProfileMixSummary<CoolingProfile>;
    containment: ProfileMixSummary<ContainmentProfile>;
  };
  halls: HallAggregateSummary[];
}

export interface CampusAggregateSummary {
  id: string;
  name: string;
  zoneCount: number;
  hallCount: number;
  rackCount: number;
  rackCapacityBySpace: number;
  utilization: number;
  rackCountFromPower: number;
  facilityLoad: FacilityLoadSummary;
  area: AreaSummary;
  profiles: {
    redundancy: ProfileMixSummary<RedundancyProfile>;
    coolingType: ProfileMixSummary<CoolingProfile>;
    containment: ProfileMixSummary<ContainmentProfile>;
  };
}

export interface ExplorerHallSummary {
  id: string;
  name: string;
  hallIndex: number;
  rackCount: number;
  rackCapacityBySpace: number;
  utilization: number;
}

export interface ExplorerZoneSummary {
  id: string;
  name: string;
  zoneIndex: number;
  hallCount: number;
  rackCount: number;
  halls: ExplorerHallSummary[];
}

export interface CampusExplorerSummary {
  campusId: string;
  campusName: string;
  zoneCount: number;
  hallCount: number;
  rackCount: number;
  zones: ExplorerZoneSummary[];
}

export interface CampusSpecsSummary {
  campus: CampusAggregateSummary;
  zonesById: Record<string, ZoneAggregateSummary>;
  hallsById: Record<string, HallAggregateSummary>;
}

export interface CampusRuntimeSummary {
  dataCenter: DataCenterModel;
  zoneOrder: string[];
  hallOrder: string[];
  hallToZone: Record<string, string>;
}

export interface CampusModel {
  params: Params;
  campus: CampusAggregateSummary;
  zones: ZoneAggregateSummary[];
  halls: HallAggregateSummary[];
  explorer: CampusExplorerSummary;
  specs: CampusSpecsSummary;
  runtime: CampusRuntimeSummary;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function toPositiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.round(value));
}

function sanitizeRackRules(rules: ZoneRackRules): ZoneRackRules {
  const minRackCount = toPositiveInteger(rules.minRackCount, 1);
  const maxRackCount = Math.max(minRackCount, toPositiveInteger(rules.maxRackCount, minRackCount));
  const step = toPositiveInteger(rules.step, 1);
  const defaultRackCount = clamp(toPositiveInteger(rules.defaultRackCount, minRackCount), minRackCount, maxRackCount);
  return { minRackCount, maxRackCount, defaultRackCount, step };
}

function normalizeRackGroups(groups: RackGroup[], hallId: string): RackGroup[] {
  if (groups.length === 0) {
    return [];
  }

  return groups.map((group, index) => ({
    id: group.id || `${hallId}-G-${String(index + 1).padStart(2, "0")}`,
    name: group.name.trim() || `Group ${index + 1}`,
    rackCount: toPositiveInteger(group.rackCount, 1),
  }));
}

function alignGroupCounts(groups: RackGroup[], targetRackCount: number): RackGroup[] {
  if (groups.length === 0) {
    return groups;
  }

  const nextGroups = groups.map((group) => ({ ...group }));
  let currentTotal = nextGroups.reduce((sum, group) => sum + group.rackCount, 0);

  if (currentTotal === targetRackCount) {
    return nextGroups;
  }

  if (currentTotal < targetRackCount) {
    nextGroups[0].rackCount += targetRackCount - currentTotal;
    return nextGroups;
  }

  for (let index = nextGroups.length - 1; index >= 0 && currentTotal > targetRackCount; index -= 1) {
    const removable = Math.min(currentTotal - targetRackCount, Math.max(0, nextGroups[index].rackCount - 1));
    nextGroups[index].rackCount -= removable;
    currentTotal -= removable;
  }

  if (currentTotal > targetRackCount) {
    nextGroups[0].rackCount = Math.max(1, nextGroups[0].rackCount - (currentTotal - targetRackCount));
  }

  return nextGroups;
}

function resolveHallRackCount(hall: Hall): number {
  if (hall.rackGroups.length > 0) {
    return hall.rackGroups.reduce((sum, group) => sum + group.rackCount, 0);
  }
  return toPositiveInteger(hall.rackCount, 1);
}

function resolveModeFromCounts<T extends string>(counts: Map<T, number>, fallback: T): T {
  if (counts.size === 0) {
    return fallback;
  }

  let bestValue = fallback;
  let bestCount = -1;
  counts.forEach((count, value) => {
    if (count > bestCount) {
      bestValue = value;
      bestCount = count;
    }
  });

  return bestValue;
}

function incrementModeCount<T extends string>(counts: Map<T, number>, value: T): void {
  counts.set(value, (counts.get(value) ?? 0) + 1);
}

function createParamsCacheKey(params: Params): string {
  return [
    params.criticalLoadMW.toFixed(4),
    Math.round(params.whitespaceAreaSqFt).toString(),
    Math.round(params.dataHalls).toString(),
    params.whitespaceRatio.toFixed(4),
    params.rackPowerDensity.toFixed(4),
    params.redundancy,
    params.pue.toFixed(4),
    params.coolingType,
    params.containment,
  ].join("|");
}

function cacheCampusModel(campus: Campus, cacheKey: string, model: CampusModel): void {
  let cacheForCampus = campusModelCache.get(campus);
  if (!cacheForCampus) {
    cacheForCampus = new Map<string, CampusModel>();
    campusModelCache.set(campus, cacheForCampus);
  }
  if (cacheForCampus.size >= CAMPUS_MODEL_CACHE_PER_CAMPUS_LIMIT && !cacheForCampus.has(cacheKey)) {
    const oldestKey = cacheForCampus.keys().next().value;
    if (typeof oldestKey === "string") {
      cacheForCampus.delete(oldestKey);
    }
  }
  cacheForCampus.set(cacheKey, model);
}

function incrementProfileMix<T extends string>(counts: Map<T, { hallCount: number; rackCount: number }>, profile: T, rackCount: number): void {
  const next = counts.get(profile) ?? { hallCount: 0, rackCount: 0 };
  next.hallCount += 1;
  next.rackCount += rackCount;
  counts.set(profile, next);
}

function resolveDominantProfile<T extends string>(
  counts: Map<T, { hallCount: number; rackCount: number }>,
  fallback: T,
  orderedValues: readonly T[]
): T {
  let dominant = fallback;
  let bestCount = counts.get(fallback)?.hallCount ?? -1;

  orderedValues.forEach((value) => {
    const hallCount = counts.get(value)?.hallCount ?? 0;
    if (hallCount > bestCount) {
      dominant = value;
      bestCount = hallCount;
    }
  });

  return dominant;
}

function buildProfileMixSummary<T extends string>(
  counts: Map<T, { hallCount: number; rackCount: number }>,
  fallback: T,
  orderedValues: readonly T[]
): ProfileMixSummary<T> {
  const entries = orderedValues
    .map((profile) => {
      const count = counts.get(profile);
      if (!count || count.hallCount <= 0) {
        return null;
      }
      return {
        profile,
        hallCount: count.hallCount,
        rackCount: count.rackCount,
      };
    })
    .filter((entry): entry is ProfileMixEntry<T> => entry !== null);

  const dominantProfile = resolveDominantProfile(counts, fallback, orderedValues);
  if (entries.length === 0) {
    return {
      dominantProfile,
      entries: [{ profile: dominantProfile, hallCount: 0, rackCount: 0 }],
    };
  }

  return {
    dominantProfile,
    entries,
  };
}

function normalizeRackProfilePatch(patch: RackProfilePatch): RackProfilePatch {
  const nextPatch: RackProfilePatch = {};

  if (patch.rackDensityKW !== undefined && Number.isFinite(patch.rackDensityKW)) {
    nextPatch.rackDensityKW = roundTo(
      clamp(patch.rackDensityKW, CAMPUS_PARAM_LIMITS.rackPowerDensity.min, CAMPUS_PARAM_LIMITS.rackPowerDensity.max),
      2
    );
  }
  if (patch.redundancy) {
    nextPatch.redundancy = patch.redundancy;
  }
  if (patch.containment) {
    nextPatch.containment = patch.containment;
  }
  if (patch.coolingType) {
    nextPatch.coolingType = patch.coolingType;
  }

  return nextPatch;
}

function hasRackProfilePatch(patch: RackProfilePatch): boolean {
  return (
    patch.rackDensityKW !== undefined
    || patch.redundancy !== undefined
    || patch.containment !== undefined
    || patch.coolingType !== undefined
  );
}

function resolveScopeZone(campus: Campus, zoneId: string | null | undefined): Zone | null {
  if (campus.zones.length === 0) {
    return null;
  }
  if (!zoneId) {
    return campus.zones[0];
  }
  return campus.zones.find((zone) => zone.id === zoneId) ?? null;
}

function resolveScopeHall(campus: Campus, hallId: string | null | undefined, zoneId: string | null | undefined): { zone: Zone; hall: Hall } | null {
  if (hallId) {
    for (const zone of campus.zones) {
      const hall = zone.halls.find((entry) => entry.id === hallId);
      if (hall) {
        return { zone, hall };
      }
    }
  }

  const zone = resolveScopeZone(campus, zoneId);
  if (!zone || zone.halls.length === 0) {
    return null;
  }
  return { zone, hall: zone.halls[0] };
}

function applyPatchToHallProfile(hall: Hall, patch: RackProfilePatch): Hall {
  return {
    ...hall,
    profile: {
      ...hall.profile,
      ...(patch.rackDensityKW !== undefined ? { rackDensityKW: patch.rackDensityKW } : {}),
      ...(patch.redundancy ? { redundancy: patch.redundancy } : {}),
      ...(patch.containment ? { containment: patch.containment } : {}),
      ...(patch.coolingType ? { coolingType: patch.coolingType } : {}),
    },
  };
}

export function applyRackProfilePatchByScope(campus: Campus, scope: CampusParameterScope, patch: RackProfilePatch): Campus {
  const normalizedPatch = normalizeRackProfilePatch(patch);
  if (!hasRackProfilePatch(normalizedPatch)) {
    return campus;
  }

  const targetHallIds = new Set<string>();
  const targetZoneIdsForDefaults = new Set<string>();

  if (scope.level === "campus") {
    campus.zones.forEach((zone) => {
      targetZoneIdsForDefaults.add(zone.id);
      zone.halls.forEach((hall) => targetHallIds.add(hall.id));
    });
  } else if (scope.level === "zone") {
    const zone = resolveScopeZone(campus, scope.zoneId);
    if (!zone) {
      return campus;
    }
    targetZoneIdsForDefaults.add(zone.id);
    zone.halls.forEach((hall) => targetHallIds.add(hall.id));
  } else {
    const target = resolveScopeHall(campus, scope.hallId, scope.zoneId);
    if (!target) {
      return campus;
    }
    targetHallIds.add(target.hall.id);
  }

  return {
    ...campus,
    zones: campus.zones.map((zone) => ({
      ...zone,
      hallDefaults: targetZoneIdsForDefaults.has(zone.id)
        ? {
          ...zone.hallDefaults,
          ...(normalizedPatch.rackDensityKW !== undefined ? { rackDensityKW: normalizedPatch.rackDensityKW } : {}),
          ...(normalizedPatch.redundancy ? { redundancy: normalizedPatch.redundancy } : {}),
          ...(normalizedPatch.containment ? { containment: normalizedPatch.containment } : {}),
          ...(normalizedPatch.coolingType ? { coolingType: normalizedPatch.coolingType } : {}),
        }
        : zone.hallDefaults,
      halls: zone.halls.map((hall) => (
        targetHallIds.has(hall.id) ? applyPatchToHallProfile(hall, normalizedPatch) : hall
      )),
    })),
  };
}

export function applyCampusPropertyPatch(campus: Campus, patch: CampusPropertyPatch): Campus {
  const nextTargetPUE = patch.targetPUE !== undefined && Number.isFinite(patch.targetPUE)
    ? roundTo(clamp(patch.targetPUE, CAMPUS_PARAM_LIMITS.pue.min, CAMPUS_PARAM_LIMITS.pue.max), 2)
    : campus.properties.targetPUE;
  const nextWhitespaceRatio = patch.whitespaceRatio !== undefined && Number.isFinite(patch.whitespaceRatio)
    ? roundTo(
      clamp(patch.whitespaceRatio, CAMPUS_PARAM_LIMITS.whitespaceRatio.min, CAMPUS_PARAM_LIMITS.whitespaceRatio.max),
      2
    )
    : campus.properties.whitespaceRatio;

  if (
    nextTargetPUE === campus.properties.targetPUE
    && nextWhitespaceRatio === campus.properties.whitespaceRatio
  ) {
    return campus;
  }

  return {
    ...campus,
    properties: {
      ...campus.properties,
      targetPUE: nextTargetPUE,
      whitespaceRatio: nextWhitespaceRatio,
    },
  };
}

export function reconcileCampus(campus: Campus): Campus {
  let rackCursor = 1;
  let hallCursor = 1;

  const zones: Zone[] = campus.zones.map((zone, zoneIndex) => {
    const rackRules = sanitizeRackRules(zone.rackRules);

    const halls: Hall[] = zone.halls.map((hall) => {
      const normalizedGroups = normalizeRackGroups(hall.rackGroups, hall.id);
      const requestedRackCount = normalizedGroups.length > 0
        ? normalizedGroups.reduce((sum, group) => sum + group.rackCount, 0)
        : resolveHallRackCount(hall);
      const clampedRackCount = clamp(requestedRackCount, rackRules.minRackCount, rackRules.maxRackCount);
      const rackGroups = alignGroupCounts(normalizedGroups, clampedRackCount);
      const rackDensityKW = roundTo(
        clamp(hall.profile.rackDensityKW, CAMPUS_PARAM_LIMITS.rackPowerDensity.min, CAMPUS_PARAM_LIMITS.rackPowerDensity.max),
        2
      );

      const rackStartIndex = clampedRackCount > 0 ? rackCursor : 0;
      const rackEndIndex = clampedRackCount > 0 ? rackCursor + clampedRackCount - 1 : 0;
      if (clampedRackCount > 0) {
        rackCursor = rackEndIndex + 1;
      }

      const hallIndex = hallCursor;
      hallCursor += 1;

      return {
        ...hall,
        id: hall.id || formatHallId(hallIndex),
        hallIndex,
        rackCount: clampedRackCount,
        rackStartIndex,
        rackEndIndex,
        rackGroups,
        profile: {
          ...hall.profile,
          rackDensityKW,
        },
        racks: buildRackRange(rackStartIndex, rackEndIndex, rackDensityKW),
      };
    });

    return {
      ...zone,
      zoneIndex: zoneIndex + 1,
      rackRules,
      halls,
    };
  });

  return {
    ...campus,
    properties: {
      targetPUE: roundTo(clamp(campus.properties.targetPUE, CAMPUS_PARAM_LIMITS.pue.min, CAMPUS_PARAM_LIMITS.pue.max), 2),
      whitespaceRatio: roundTo(clamp(campus.properties.whitespaceRatio, CAMPUS_PARAM_LIMITS.whitespaceRatio.min, CAMPUS_PARAM_LIMITS.whitespaceRatio.max), 2),
    },
    zones,
  };
}

export function deriveParamsFromReconciledCampus(normalized: Campus, fallback: Params): Params {
  let hallCount = 0;
  let totalRacks = 0;
  let criticalKw = 0;
  const redundancyCounts = new Map<RedundancyProfile, number>();
  const coolingCounts = new Map<CoolingProfile, number>();
  const containmentCounts = new Map<ContainmentProfile, number>();

  for (const zone of normalized.zones) {
    for (const hall of zone.halls) {
      hallCount += 1;
      totalRacks += hall.rackCount;
      criticalKw += hall.rackCount * hall.profile.rackDensityKW;
      incrementModeCount(redundancyCounts, hall.profile.redundancy);
      incrementModeCount(coolingCounts, hall.profile.coolingType);
      incrementModeCount(containmentCounts, hall.profile.containment);
    }
  }

  const clampedHallCount = Math.max(1, hallCount);
  const averageDensity = totalRacks > 0 ? criticalKw / totalRacks : fallback.rackPowerDensity;
  const criticalLoadMW = criticalKw / 1000;

  const redundancy = resolveModeFromCounts<RedundancyProfile>(redundancyCounts, fallback.redundancy);
  const coolingType = resolveModeFromCounts<CoolingProfile>(coolingCounts, fallback.coolingType);
  const containment = resolveModeFromCounts<ContainmentProfile>(containmentCounts, fallback.containment);

  const whitespaceRatio = clamp(
    normalized.properties.whitespaceRatio,
    CAMPUS_PARAM_LIMITS.whitespaceRatio.min,
    CAMPUS_PARAM_LIMITS.whitespaceRatio.max
  );
  const whitespaceAreaSqFt = clamp(
    Math.round(totalRacks * 36),
    CAMPUS_PARAM_LIMITS.whitespaceAreaSqFt.min,
    CAMPUS_PARAM_LIMITS.whitespaceAreaSqFt.max
  );

  return {
    criticalLoadMW: roundTo(clamp(criticalLoadMW, CAMPUS_PARAM_LIMITS.criticalLoadMW.min, CAMPUS_PARAM_LIMITS.criticalLoadMW.max), 2),
    whitespaceAreaSqFt,
    dataHalls: clamp(clampedHallCount, CAMPUS_PARAM_LIMITS.dataHalls.min, CAMPUS_PARAM_LIMITS.dataHalls.max),
    whitespaceRatio: roundTo(whitespaceRatio, 2),
    rackPowerDensity: roundTo(clamp(averageDensity, CAMPUS_PARAM_LIMITS.rackPowerDensity.min, CAMPUS_PARAM_LIMITS.rackPowerDensity.max), 2),
    redundancy,
    pue: roundTo(
      clamp(normalized.properties.targetPUE, CAMPUS_PARAM_LIMITS.pue.min, CAMPUS_PARAM_LIMITS.pue.max),
      2
    ),
    coolingType,
    containment,
  };
}

export function deriveParamsFromCampus(campus: Campus, fallback: Params): Params {
  return deriveParamsFromReconciledCampus(reconcileCampus(campus), fallback);
}

function buildRows(hallIndex: number, rackCount: number, maxRows: number, maxRacksPerRow: number): { rows: HallRow[]; rowCount: number } {
  if (rackCount <= 0) {
    return { rows: [], rowCount: 0 };
  }

  const safeRows = Math.max(1, maxRows);
  const safeRacksPerRow = Math.max(1, maxRacksPerRow);
  const rowCount = Math.min(safeRows, Math.max(1, Math.ceil(rackCount / safeRacksPerRow)));
  const baseRacksPerRow = Math.floor(rackCount / rowCount);
  let remainder = rackCount % rowCount;

  const rows: HallRow[] = [];
  for (let row = 1; row <= rowCount; row += 1) {
    const rowRackCount = baseRacksPerRow + (remainder > 0 ? 1 : 0);
    if (remainder > 0) {
      remainder -= 1;
    }
    rows.push({
      id: `H${String(hallIndex).padStart(2, "0")}-ROW-${String(row).padStart(2, "0")}`,
      rowNumber: row,
      rackCount: rowRackCount,
    });
  }

  return { rows, rowCount };
}

function buildFacilityLoad(criticalKw: number, pue: number): FacilityLoadSummary {
  const criticalITMW = roundTo(criticalKw / 1000, 2);
  const totalFacilityMW = roundTo(criticalITMW * pue, 2);
  const nonITOverheadMW = roundTo(Math.max(0, totalFacilityMW - criticalITMW), 2);
  return { criticalITMW, totalFacilityMW, nonITOverheadMW };
}

interface MutableZoneSummary {
  id: string;
  zoneIndex: number;
  name: string;
  defaultRedundancy: RedundancyProfile;
  defaultCoolingType: CoolingProfile;
  defaultContainment: ContainmentProfile;
  hallCount: number;
  rackCount: number;
  rackCapacityBySpace: number;
  criticalKw: number;
  criticalITMW: number;
  totalFacilityMW: number;
  nonITOverheadMW: number;
  whitespaceSqFt: number;
  grossSqFt: number;
  redundancyMix: Map<RedundancyProfile, { hallCount: number; rackCount: number }>;
  coolingMix: Map<CoolingProfile, { hallCount: number; rackCount: number }>;
  containmentMix: Map<ContainmentProfile, { hallCount: number; rackCount: number }>;
  halls: HallAggregateSummary[];
}

export function computeCampusModel(campus: Campus, fallback: Params): CampusModel {
  // Assumes immutable campus objects from store updates; repeated calls with the same campus reference
  // are frequent (Specs + Viewport), so cache by object identity for cheap reuse.
  const fallbackKey = createParamsCacheKey(fallback);
  const cachedForCampus = campusModelCache.get(campus)?.get(fallbackKey);
  if (cachedForCampus) {
    return cachedForCampus;
  }

  const normalized = reconcileCampus(campus);
  const params = deriveParamsFromReconciledCampus(normalized, fallback);
  const base = computeDataCenter(params);

  const halls: DataCenterModel["halls"] = [];
  const hallSummaries: HallAggregateSummary[] = [];
  const hallRackDistribution: number[] = [];
  const zoneSummariesById = new Map<string, MutableZoneSummary>();
  const zoneOrder: string[] = [];
  const hallOrder: string[] = [];
  const hallToZone: Record<string, string> = {};

  const campusRedundancyMix = new Map<RedundancyProfile, { hallCount: number; rackCount: number }>();
  const campusCoolingMix = new Map<CoolingProfile, { hallCount: number; rackCount: number }>();
  const campusContainmentMix = new Map<ContainmentProfile, { hallCount: number; rackCount: number }>();

  let rackCursor = 1;
  let rackCount = 0;
  let rackCapacityBySpace = 0;
  let criticalKw = 0;
  let criticalITMW = 0;
  let totalFacilityMW = 0;
  let nonITOverheadMW = 0;
  let whitespaceSqFt = 0;
  let grossSqFt = 0;
  let baseHallIndex = 0;

  for (const zone of normalized.zones) {
    const zoneSummary: MutableZoneSummary = {
      id: zone.id,
      zoneIndex: zone.zoneIndex,
      name: zone.metadata.name || zone.id,
      defaultRedundancy: zone.hallDefaults.redundancy,
      defaultCoolingType: zone.hallDefaults.coolingType,
      defaultContainment: zone.hallDefaults.containment,
      hallCount: 0,
      rackCount: 0,
      rackCapacityBySpace: 0,
      criticalKw: 0,
      criticalITMW: 0,
      totalFacilityMW: 0,
      nonITOverheadMW: 0,
      whitespaceSqFt: 0,
      grossSqFt: 0,
      redundancyMix: new Map(),
      coolingMix: new Map(),
      containmentMix: new Map(),
      halls: [],
    };
    zoneSummariesById.set(zone.id, zoneSummary);
    zoneOrder.push(zone.id);

    for (const hall of zone.halls) {
      const baseHall = base.halls[baseHallIndex];
      baseHallIndex += 1;

      const capacity = baseHall ? baseHall.capacity : hall.rackCount;
      const assignedRackCount = Math.min(hall.rackCount, capacity);
      const rackStartIndex = assignedRackCount > 0 ? rackCursor : 0;
      const rackEndIndex = assignedRackCount > 0 ? rackCursor + assignedRackCount - 1 : 0;
      if (assignedRackCount > 0) {
        rackCursor = rackEndIndex + 1;
      }

      const maxRows = baseHall?.packing.maxRows ?? Math.max(1, Math.ceil(assignedRackCount / DEFAULT_RACKS_PER_ROW));
      const maxRacksPerRow = baseHall?.packing.maxRacksPerRow ?? DEFAULT_RACKS_PER_ROW;
      const packed = buildRows(hall.hallIndex, assignedRackCount, maxRows, maxRacksPerRow);
      const hallWhitespaceSqFt = roundTo(baseHall?.whitespaceSqFt ?? 0, 2);
      const hallGrossSqFt = roundTo(baseHall?.grossSqFt ?? 0, 2);
      const hallCriticalKw = assignedRackCount * hall.profile.rackDensityKW;
      const hallFacilityLoad = buildFacilityLoad(hallCriticalKw, params.pue);
      const hallUtilization = capacity > 0 ? roundTo(assignedRackCount / capacity, 4) : 0;

      halls.push({
        id: hall.id,
        hallIndex: hall.hallIndex,
        rackCount: assignedRackCount,
        rackStartIndex,
        rackEndIndex,
        whitespaceSqFt: hallWhitespaceSqFt,
        grossSqFt: hallGrossSqFt,
        capacity,
        dimensionsFt: baseHall?.dimensionsFt ?? { width: 0, length: 0 },
        packing: {
          rowCount: packed.rowCount,
          maxRows,
          targetRacksPerRow: DEFAULT_RACKS_PER_ROW,
          maxRacksPerRow,
        },
        rows: packed.rows,
      });

      const hallSummary: HallAggregateSummary = {
        id: hall.id,
        hallIndex: hall.hallIndex,
        zoneId: zone.id,
        zoneIndex: zone.zoneIndex,
        name: hall.metadata.name || hall.id,
        rackCount: assignedRackCount,
        capacity,
        rackCapacityBySpace: capacity,
        rackDensityKW: hall.profile.rackDensityKW,
        utilization: hallUtilization,
        rackStartIndex,
        rackEndIndex,
        facilityLoad: hallFacilityLoad,
        area: {
          whitespaceSqFt: hallWhitespaceSqFt,
          grossSqFt: hallGrossSqFt,
        },
        profiles: {
          redundancy: hall.profile.redundancy,
          coolingType: hall.profile.coolingType,
          containment: hall.profile.containment,
        },
        dimensionsFt: baseHall?.dimensionsFt ?? { width: 0, length: 0 },
        packing: {
          rowCount: packed.rowCount,
          maxRows,
          targetRacksPerRow: DEFAULT_RACKS_PER_ROW,
          maxRacksPerRow,
        },
        rows: packed.rows,
        geometry: {
          dimensionsFt: baseHall?.dimensionsFt ?? { width: 0, length: 0 },
          packing: {
            rowCount: packed.rowCount,
            maxRows,
            targetRacksPerRow: DEFAULT_RACKS_PER_ROW,
            maxRacksPerRow,
          },
          rows: packed.rows,
        },
      };

      hallSummaries.push(hallSummary);
      zoneSummary.halls.push(hallSummary);

      hallOrder.push(hall.id);
      hallToZone[hall.id] = zone.id;
      hallRackDistribution.push(assignedRackCount);

      rackCount += assignedRackCount;
      rackCapacityBySpace += capacity;
      criticalKw += hallCriticalKw;
      criticalITMW += hallFacilityLoad.criticalITMW;
      totalFacilityMW += hallFacilityLoad.totalFacilityMW;
      nonITOverheadMW += hallFacilityLoad.nonITOverheadMW;
      whitespaceSqFt += hallWhitespaceSqFt;
      grossSqFt += hallGrossSqFt;

      zoneSummary.hallCount += 1;
      zoneSummary.rackCount += assignedRackCount;
      zoneSummary.rackCapacityBySpace += capacity;
      zoneSummary.criticalKw += hallCriticalKw;
      zoneSummary.criticalITMW += hallFacilityLoad.criticalITMW;
      zoneSummary.totalFacilityMW += hallFacilityLoad.totalFacilityMW;
      zoneSummary.nonITOverheadMW += hallFacilityLoad.nonITOverheadMW;
      zoneSummary.whitespaceSqFt += hallWhitespaceSqFt;
      zoneSummary.grossSqFt += hallGrossSqFt;

      incrementProfileMix(zoneSummary.redundancyMix, hall.profile.redundancy, assignedRackCount);
      incrementProfileMix(zoneSummary.coolingMix, hall.profile.coolingType, assignedRackCount);
      incrementProfileMix(zoneSummary.containmentMix, hall.profile.containment, assignedRackCount);

      incrementProfileMix(campusRedundancyMix, hall.profile.redundancy, assignedRackCount);
      incrementProfileMix(campusCoolingMix, hall.profile.coolingType, assignedRackCount);
      incrementProfileMix(campusContainmentMix, hall.profile.containment, assignedRackCount);
    }
  }

  const averageDensity = rackCount > 0 ? criticalKw / rackCount : params.rackPowerDensity;
  const rackCountFromPower = rackCount > 0
    ? Math.max(1, Math.round((criticalKw / Math.max(averageDensity, 0.1))))
    : 0;
  const campusFacilityLoad: FacilityLoadSummary = {
    criticalITMW: roundTo(criticalITMW, 2),
    totalFacilityMW: roundTo(totalFacilityMW, 2),
    nonITOverheadMW: roundTo(nonITOverheadMW, 2),
  };
  const area: AreaSummary = {
    whitespaceSqFt: roundTo(whitespaceSqFt, 2),
    grossFacilitySqFt: roundTo(grossSqFt, 2),
    hallWhitespaceSqFt: halls.length > 0 ? roundTo(whitespaceSqFt / halls.length, 2) : 0,
    hallGrossSqFt: halls.length > 0 ? roundTo(grossSqFt / halls.length, 2) : 0,
  };

  const dataCenterModel: DataCenterModel = {
    facilityLoad: campusFacilityLoad,
    area,
    rackCount,
    rackCountFromPower,
    rackCapacityBySpace,
    hallRackDistribution,
    halls,
  };

  const zoneSummaries: ZoneAggregateSummary[] = zoneOrder
    .map((zoneId) => zoneSummariesById.get(zoneId))
    .filter((entry): entry is MutableZoneSummary => entry !== undefined)
    .map((zoneSummary) => {
      const zoneAverageDensity = zoneSummary.rackCount > 0
        ? zoneSummary.criticalKw / zoneSummary.rackCount
        : params.rackPowerDensity;
      const zoneRackCountFromPower = zoneSummary.rackCount > 0
        ? Math.max(1, Math.round(zoneSummary.criticalKw / Math.max(zoneAverageDensity, 0.1)))
        : 0;
      const zoneRedundancyFallback = zoneSummary.halls[0]?.profiles.redundancy ?? zoneSummary.defaultRedundancy;
      const zoneCoolingFallback = zoneSummary.halls[0]?.profiles.coolingType ?? zoneSummary.defaultCoolingType;
      const zoneContainmentFallback = zoneSummary.halls[0]?.profiles.containment ?? zoneSummary.defaultContainment;

      return {
        id: zoneSummary.id,
        zoneIndex: zoneSummary.zoneIndex,
        name: zoneSummary.name,
        hallCount: zoneSummary.hallCount,
        rackCount: zoneSummary.rackCount,
        rackCapacityBySpace: zoneSummary.rackCapacityBySpace,
        utilization: zoneSummary.rackCapacityBySpace > 0
          ? roundTo(zoneSummary.rackCount / zoneSummary.rackCapacityBySpace, 4)
          : 0,
        rackCountFromPower: zoneRackCountFromPower,
        facilityLoad: {
          criticalITMW: roundTo(zoneSummary.criticalITMW, 2),
          totalFacilityMW: roundTo(zoneSummary.totalFacilityMW, 2),
          nonITOverheadMW: roundTo(zoneSummary.nonITOverheadMW, 2),
        },
        area: {
          whitespaceSqFt: roundTo(zoneSummary.whitespaceSqFt, 2),
          grossSqFt: roundTo(zoneSummary.grossSqFt, 2),
        },
        profiles: {
          redundancy: buildProfileMixSummary(
            zoneSummary.redundancyMix,
            zoneRedundancyFallback,
            REDUNDANCY_ORDER
          ),
          coolingType: buildProfileMixSummary(
            zoneSummary.coolingMix,
            zoneCoolingFallback,
            COOLING_ORDER
          ),
          containment: buildProfileMixSummary(
            zoneSummary.containmentMix,
            zoneContainmentFallback,
            CONTAINMENT_ORDER
          ),
        },
        halls: zoneSummary.halls,
      };
    });

  const zonesById: Record<string, ZoneAggregateSummary> = {};
  zoneSummaries.forEach((zoneSummary) => {
    zonesById[zoneSummary.id] = zoneSummary;
  });

  const hallsById: Record<string, HallAggregateSummary> = {};
  hallSummaries.forEach((hallSummary) => {
    hallsById[hallSummary.id] = hallSummary;
  });

  const campusSummary: CampusAggregateSummary = {
    id: normalized.id,
    name: normalized.metadata.name || normalized.id,
    zoneCount: zoneSummaries.length,
    hallCount: halls.length,
    rackCount,
    rackCapacityBySpace,
    utilization: rackCapacityBySpace > 0 ? roundTo(rackCount / rackCapacityBySpace, 4) : 0,
    rackCountFromPower,
    facilityLoad: campusFacilityLoad,
    area,
    profiles: {
      redundancy: buildProfileMixSummary(campusRedundancyMix, params.redundancy, REDUNDANCY_ORDER),
      coolingType: buildProfileMixSummary(campusCoolingMix, params.coolingType, COOLING_ORDER),
      containment: buildProfileMixSummary(campusContainmentMix, params.containment, CONTAINMENT_ORDER),
    },
  };

  const explorer: CampusExplorerSummary = {
    campusId: campusSummary.id,
    campusName: campusSummary.name,
    zoneCount: campusSummary.zoneCount,
    hallCount: campusSummary.hallCount,
    rackCount: campusSummary.rackCount,
    zones: zoneSummaries.map((zoneSummary) => ({
      id: zoneSummary.id,
      name: zoneSummary.name,
      zoneIndex: zoneSummary.zoneIndex,
      hallCount: zoneSummary.hallCount,
      rackCount: zoneSummary.rackCount,
      halls: zoneSummary.halls.map((hallSummary) => ({
        id: hallSummary.id,
        name: hallSummary.name,
        hallIndex: hallSummary.hallIndex,
        rackCount: hallSummary.rackCount,
        rackCapacityBySpace: hallSummary.rackCapacityBySpace,
        utilization: hallSummary.utilization,
      })),
    })),
  };

  const model: CampusModel = {
    params,
    campus: campusSummary,
    zones: zoneSummaries,
    halls: hallSummaries,
    explorer,
    specs: {
      campus: campusSummary,
      zonesById,
      hallsById,
    },
    runtime: {
      dataCenter: dataCenterModel,
      zoneOrder,
      hallOrder,
      hallToZone,
    },
  };

  cacheCampusModel(campus, fallbackKey, model);
  return model;
}

export function computeDataCenterFromCampus(campus: Campus, fallback: Params): DataCenterModel {
  return computeCampusModel(campus, fallback).runtime.dataCenter;
}

export function validateCampus(campus: Campus): CampusValidationIssue[] {
  const issues: CampusValidationIssue[] = [];

  if (!campus.metadata.name.trim()) {
    issues.push({
      path: "Campus name",
      message: "Campus name is required.",
      recommendation: "Enter a short, descriptive campus name.",
    });
  }

  if (campus.properties.targetPUE < CAMPUS_PARAM_LIMITS.pue.min || campus.properties.targetPUE > CAMPUS_PARAM_LIMITS.pue.max) {
    issues.push({
      path: "Campus target PUE",
      message: `Target PUE must stay between ${CAMPUS_PARAM_LIMITS.pue.min} and ${CAMPUS_PARAM_LIMITS.pue.max}.`,
      recommendation: "Adjust the PUE field to a supported range.",
    });
  }

  if (
    campus.properties.whitespaceRatio < CAMPUS_PARAM_LIMITS.whitespaceRatio.min
    || campus.properties.whitespaceRatio > CAMPUS_PARAM_LIMITS.whitespaceRatio.max
  ) {
    issues.push({
      path: "Campus whitespace ratio",
      message: `Whitespace ratio must stay between ${CAMPUS_PARAM_LIMITS.whitespaceRatio.min} and ${CAMPUS_PARAM_LIMITS.whitespaceRatio.max}.`,
      recommendation: "Update whitespace ratio before applying changes.",
    });
  }

  if (campus.zones.length === 0) {
    issues.push({
      path: "Zones",
      message: "At least one zone is required.",
      recommendation: "Add a zone before saving.",
    });
  }

  campus.zones.forEach((zone, zoneIndex) => {
    if (!zone.metadata.name.trim()) {
      issues.push({
        path: `Zone ${zoneIndex + 1}`,
        message: "Zone name is required.",
        recommendation: "Provide a zone name such as Zone A or East Hall Cluster.",
      });
    }

    if (zone.halls.length === 0) {
      issues.push({
        path: zone.metadata.name || `Zone ${zoneIndex + 1}`,
        message: "Each zone must contain at least one hall.",
        recommendation: "Add a hall to this zone.",
      });
    }

    if (zone.rackRules.minRackCount > zone.rackRules.maxRackCount) {
      issues.push({
        path: `${zone.metadata.name || `Zone ${zoneIndex + 1}`} rack rules`,
        message: "Rack rule minimum cannot exceed maximum.",
        recommendation: "Set min <= max in zone rack rules.",
      });
    }

    if (zone.rackRules.step <= 0) {
      issues.push({
        path: `${zone.metadata.name || `Zone ${zoneIndex + 1}`} rack rules`,
        message: "Rack step must be greater than 0.",
        recommendation: "Set rack step to at least 1.",
      });
    }

    zone.halls.forEach((hall, hallIndex) => {
      const hallRackCount = resolveHallRackCount(hall);

      if (!hall.metadata.name.trim()) {
        issues.push({
          path: `${zone.metadata.name || `Zone ${zoneIndex + 1}`} / Hall ${hallIndex + 1}`,
          message: "Hall name is required.",
          recommendation: "Provide a hall label such as Hall 1.",
        });
      }

      if (hallRackCount < zone.rackRules.minRackCount || hallRackCount > zone.rackRules.maxRackCount) {
        issues.push({
          path: `${hall.metadata.name || hall.id} rack count`,
          message: `Rack count must stay between ${zone.rackRules.minRackCount} and ${zone.rackRules.maxRackCount}.`,
          recommendation: "Adjust hall rack count or zone rack limits.",
        });
      }

      if (hall.profile.rackDensityKW < CAMPUS_PARAM_LIMITS.rackPowerDensity.min || hall.profile.rackDensityKW > CAMPUS_PARAM_LIMITS.rackPowerDensity.max) {
        issues.push({
          path: `${hall.metadata.name || hall.id} density`,
          message: `Rack density must stay between ${CAMPUS_PARAM_LIMITS.rackPowerDensity.min} and ${CAMPUS_PARAM_LIMITS.rackPowerDensity.max} kW/rack.`,
          recommendation: "Set a density within supported viewport limits.",
        });
      }

      if (hall.rackGroups.some((group) => !group.name.trim() || group.rackCount <= 0)) {
        issues.push({
          path: `${hall.metadata.name || hall.id} rack groups`,
          message: "Rack groups need a name and rack count above 0.",
          recommendation: "Fix group names/counts or switch to single rack count.",
        });
      }
    });
  });

  return issues;
}
