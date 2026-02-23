import { computeDataCenter, type DataCenterModel, type HallRow } from "./dataCenter";
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

function resolveMode<T extends string>(values: T[], fallback: T): T {
  if (values.length === 0) {
    return fallback;
  }

  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
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

export function deriveParamsFromCampus(campus: Campus, fallback: Params): Params {
  const normalized = reconcileCampus(campus);
  const halls = normalized.zones.flatMap((zone) => zone.halls);
  const hallCount = Math.max(1, halls.length);
  const totalRacks = halls.reduce((sum, hall) => sum + hall.rackCount, 0);
  const criticalKw = halls.reduce((sum, hall) => sum + hall.rackCount * hall.profile.rackDensityKW, 0);
  const averageDensity = totalRacks > 0 ? criticalKw / totalRacks : fallback.rackPowerDensity;
  const criticalLoadMW = criticalKw / 1000;

  const redundancy = resolveMode<RedundancyProfile>(
    halls.map((hall) => hall.profile.redundancy),
    fallback.redundancy
  );
  const coolingType = resolveMode<CoolingProfile>(
    halls.map((hall) => hall.profile.coolingType),
    fallback.coolingType
  );
  const containment = resolveMode<ContainmentProfile>(
    halls.map((hall) => hall.profile.containment),
    fallback.containment
  );

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
    dataHalls: clamp(hallCount, CAMPUS_PARAM_LIMITS.dataHalls.min, CAMPUS_PARAM_LIMITS.dataHalls.max),
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

export function computeDataCenterFromCampus(campus: Campus, fallback: Params): DataCenterModel {
  const normalized = reconcileCampus(campus);
  const params = deriveParamsFromCampus(normalized, fallback);
  const base = computeDataCenter(params);
  const configuredHalls = normalized.zones.flatMap((zone) => zone.halls);

  if (configuredHalls.length === 0) {
    return base;
  }

  let rackCursor = 1;
  const halls = configuredHalls.map((hall, index) => {
    const baseHall = base.halls[index];
    const capacity = baseHall ? baseHall.capacity : hall.rackCount;
    const rackCount = Math.min(hall.rackCount, capacity);
    const rackStartIndex = rackCount > 0 ? rackCursor : 0;
    const rackEndIndex = rackCount > 0 ? rackCursor + rackCount - 1 : 0;
    if (rackCount > 0) {
      rackCursor = rackEndIndex + 1;
    }

    const maxRows = baseHall?.packing.maxRows ?? Math.max(1, Math.ceil(rackCount / DEFAULT_RACKS_PER_ROW));
    const maxRacksPerRow = baseHall?.packing.maxRacksPerRow ?? DEFAULT_RACKS_PER_ROW;
    const packed = buildRows(hall.hallIndex, rackCount, maxRows, maxRacksPerRow);

    return {
      id: hall.id,
      hallIndex: hall.hallIndex,
      rackCount,
      rackStartIndex,
      rackEndIndex,
      whitespaceSqFt: baseHall?.whitespaceSqFt ?? 0,
      grossSqFt: baseHall?.grossSqFt ?? 0,
      capacity,
      dimensionsFt: baseHall?.dimensionsFt ?? { width: 0, length: 0 },
      packing: {
        rowCount: packed.rowCount,
        maxRows,
        targetRacksPerRow: DEFAULT_RACKS_PER_ROW,
        maxRacksPerRow,
      },
      rows: packed.rows,
    };
  });

  const hallRackDistribution = halls.map((hall) => hall.rackCount);
  const rackCount = hallRackDistribution.reduce((sum, value) => sum + value, 0);
  const rackCapacityBySpace = halls.reduce((sum, hall) => sum + hall.capacity, 0);
  const criticalKw = configuredHalls.reduce((sum, hall, index) => {
    return sum + halls[index].rackCount * hall.profile.rackDensityKW;
  }, 0);
  const criticalITMW = roundTo(criticalKw / 1000, 2);
  const totalFacilityMW = roundTo(criticalITMW * params.pue, 2);
  const nonITOverheadMW = roundTo(Math.max(0, totalFacilityMW - criticalITMW), 2);
  const averageDensity = rackCount > 0 ? criticalKw / rackCount : params.rackPowerDensity;
  const rackCountFromPower = Math.max(1, Math.round((criticalITMW * 1000) / Math.max(averageDensity, 0.1)));

  return {
    facilityLoad: {
      criticalITMW,
      totalFacilityMW,
      nonITOverheadMW,
    },
    area: base.area,
    rackCount,
    rackCountFromPower,
    rackCapacityBySpace,
    hallRackDistribution,
    halls,
  };
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
