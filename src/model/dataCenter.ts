import type { Params } from "@/state/types";

const HALL_ASPECT_RATIO = 2;
const SERVICE_CLEARANCE_FT = 4;
const END_CLEARANCE_FT = 4;
const ROW_PITCH_FT = 10;
const RACK_WIDTH_FT = 2;
const TARGET_RACKS_PER_ROW = 18;

export interface FacilityLoadSummary {
  criticalITMW: number;
  totalFacilityMW: number;
  nonITOverheadMW: number;
}

export interface AreaSummary {
  whitespaceSqFt: number;
  grossFacilitySqFt: number;
  hallWhitespaceSqFt: number;
  hallGrossSqFt: number;
}

export interface HallRow {
  id: string;
  rowNumber: number;
  rackCount: number;
}

export interface RowPackingSummary {
  rowCount: number;
  maxRows: number;
  targetRacksPerRow: number;
  maxRacksPerRow: number;
}

export interface HallDescription {
  id: string;
  hallIndex: number;
  rackCount: number;
  rackStartIndex: number;
  rackEndIndex: number;
  whitespaceSqFt: number;
  grossSqFt: number;
  capacity: number;
  dimensionsFt: {
    width: number;
    length: number;
  };
  packing: RowPackingSummary;
  rows: HallRow[];
}

export interface DataCenterModel {
  facilityLoad: FacilityLoadSummary;
  area: AreaSummary;
  rackCount: number;
  rackCountFromPower: number;
  rackCapacityBySpace: number;
  hallRackDistribution: number[];
  halls: HallDescription[];
}

interface HallGeometry {
  widthFt: number;
  lengthFt: number;
  maxRows: number;
  maxRacksPerRow: number;
  capacity: number;
}

interface PackedRows {
  rows: HallRow[];
  rowCount: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampMin(value: number, min: number): number {
  return Math.max(min, value);
}

function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function sanitizeParams(params: Params): Params {
  return {
    ...params,
    criticalLoadMW: clampMin(params.criticalLoadMW, 0.1),
    whitespaceAreaSqFt: clampMin(params.whitespaceAreaSqFt, 1),
    dataHalls: Math.max(1, Math.round(params.dataHalls)),
    whitespaceRatio: clamp(params.whitespaceRatio, 0.05, 0.95),
    rackPowerDensity: clampMin(params.rackPowerDensity, 0.1),
    pue: clampMin(params.pue, 1),
  };
}

function deriveHallGeometry(hallWhitespaceSqFt: number): HallGeometry {
  const widthFt = Math.sqrt(hallWhitespaceSqFt / HALL_ASPECT_RATIO);
  const lengthFt = widthFt * HALL_ASPECT_RATIO;

  const usableWidthFt = Math.max(ROW_PITCH_FT, widthFt - SERVICE_CLEARANCE_FT * 2);
  const usableLengthFt = Math.max(RACK_WIDTH_FT, lengthFt - END_CLEARANCE_FT * 2);

  const maxRows = Math.max(1, Math.floor(usableWidthFt / ROW_PITCH_FT));
  const maxRacksPerRow = Math.max(1, Math.floor(usableLengthFt / RACK_WIDTH_FT));

  return {
    widthFt,
    lengthFt,
    maxRows,
    maxRacksPerRow,
    capacity: maxRows * maxRacksPerRow,
  };
}

function distributeRacks(totalRacks: number, capacities: number[]): number[] {
  if (capacities.length === 0) {
    return [];
  }

  const distribution = capacities.map(() => 0);
  if (totalRacks <= 0) {
    return distribution;
  }

  const baseShare = Math.floor(totalRacks / capacities.length);
  let remaining = totalRacks;

  for (let index = 0; index < capacities.length; index += 1) {
    const allocated = Math.min(baseShare, capacities[index]);
    distribution[index] = allocated;
    remaining -= allocated;
  }

  while (remaining > 0) {
    let placedRack = false;

    for (let index = 0; index < capacities.length; index += 1) {
      if (remaining === 0) {
        break;
      }

      if (distribution[index] < capacities[index]) {
        distribution[index] += 1;
        remaining -= 1;
        placedRack = true;
      }
    }

    if (!placedRack) {
      break;
    }
  }

  return distribution;
}

function packRows(
  hallIndex: number,
  rackCount: number,
  maxRows: number,
  maxRacksPerRow: number
): PackedRows {
  if (rackCount <= 0) {
    return { rows: [], rowCount: 0 };
  }

  const minimumRowsRequired = Math.ceil(rackCount / maxRacksPerRow);
  const targetRows = Math.ceil(rackCount / TARGET_RACKS_PER_ROW);
  const rowCount = Math.min(maxRows, Math.max(1, minimumRowsRequired, targetRows));

  const baseRacksPerRow = Math.floor(rackCount / rowCount);
  let remainder = rackCount % rowCount;

  const rows: HallRow[] = [];

  for (let rowNumber = 1; rowNumber <= rowCount; rowNumber += 1) {
    const rowRacks = baseRacksPerRow + (remainder > 0 ? 1 : 0);
    if (remainder > 0) {
      remainder -= 1;
    }

    rows.push({
      id: `H${String(hallIndex).padStart(2, "0")}-ROW-${String(rowNumber).padStart(2, "0")}`,
      rowNumber,
      rackCount: rowRacks,
    });
  }

  return { rows, rowCount };
}

/**
 * Converts UI parameters into a deterministic scene-ready data center description.
 * The output is used by UI summaries now and 3D geometry generation in later prompts.
 */
export function computeDataCenter(inputParams: Params): DataCenterModel {
  const params = sanitizeParams(inputParams);
  const hallCount = params.dataHalls;

  const criticalITMW = params.criticalLoadMW;
  const totalFacilityMW = criticalITMW * params.pue;
  const nonITOverheadMW = Math.max(0, totalFacilityMW - criticalITMW);

  const whitespaceSqFt = params.whitespaceAreaSqFt;
  const grossFacilitySqFt = whitespaceSqFt / params.whitespaceRatio;
  const hallWhitespaceSqFt = whitespaceSqFt / hallCount;
  const hallGrossSqFt = grossFacilitySqFt / hallCount;

  const hallGeometries = Array.from({ length: hallCount }, () =>
    deriveHallGeometry(hallWhitespaceSqFt)
  );

  const capacities = hallGeometries.map((geometry) => geometry.capacity);
  const rackCapacityBySpace = capacities.reduce((sum, capacity) => sum + capacity, 0);

  const rackCountFromPower = Math.max(
    1,
    Math.round((criticalITMW * 1000) / params.rackPowerDensity)
  );
  const rackCount = Math.min(rackCountFromPower, rackCapacityBySpace);

  const hallRackDistribution = distributeRacks(rackCount, capacities);

  let rackCursor = 1;
  const halls: HallDescription[] = hallRackDistribution.map((hallRackCount, index) => {
    const hallIndex = index + 1;
    const geometry = hallGeometries[index];
    const { rows, rowCount } = packRows(
      hallIndex,
      hallRackCount,
      geometry.maxRows,
      geometry.maxRacksPerRow
    );

    const rackStartIndex = hallRackCount > 0 ? rackCursor : 0;
    const rackEndIndex = hallRackCount > 0 ? rackCursor + hallRackCount - 1 : 0;

    if (hallRackCount > 0) {
      rackCursor = rackEndIndex + 1;
    }

    return {
      id: `H-${String(hallIndex).padStart(2, "0")}`,
      hallIndex,
      rackCount: hallRackCount,
      rackStartIndex,
      rackEndIndex,
      whitespaceSqFt: roundTo(hallWhitespaceSqFt, 2),
      grossSqFt: roundTo(hallGrossSqFt, 2),
      capacity: geometry.capacity,
      dimensionsFt: {
        width: roundTo(geometry.widthFt, 2),
        length: roundTo(geometry.lengthFt, 2),
      },
      packing: {
        rowCount,
        maxRows: geometry.maxRows,
        targetRacksPerRow: TARGET_RACKS_PER_ROW,
        maxRacksPerRow: geometry.maxRacksPerRow,
      },
      rows,
    };
  });

  return {
    facilityLoad: {
      criticalITMW: roundTo(criticalITMW, 2),
      totalFacilityMW: roundTo(totalFacilityMW, 2),
      nonITOverheadMW: roundTo(nonITOverheadMW, 2),
    },
    area: {
      whitespaceSqFt: roundTo(whitespaceSqFt, 2),
      grossFacilitySqFt: roundTo(grossFacilitySqFt, 2),
      hallWhitespaceSqFt: roundTo(hallWhitespaceSqFt, 2),
      hallGrossSqFt: roundTo(hallGrossSqFt, 2),
    },
    rackCount,
    rackCountFromPower,
    rackCapacityBySpace,
    hallRackDistribution,
    halls,
  };
}
