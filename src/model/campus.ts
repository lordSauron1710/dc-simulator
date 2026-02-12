import { computeDataCenter } from "./dataCenter";
import type { Params } from "@/state/types";

export interface EntityMetadata {
  name: string;
  notes?: string;
  capacityTarget?: number;
  tags?: string[];
}

export interface Rack {
  id: string;
  rackIndex: number;
  metadata: EntityMetadata;
}

export interface Hall {
  id: string;
  hallIndex: number;
  rackCount: number;
  rackStartIndex: number;
  rackEndIndex: number;
  metadata: EntityMetadata;
  racks: Rack[];
}

export interface Zone {
  id: string;
  zoneIndex: number;
  metadata: EntityMetadata;
  halls: Hall[];
}

export interface Campus {
  id: string;
  version: 1;
  metadata: EntityMetadata;
  zones: Zone[];
}

export function formatCampusId(index: number): string {
  return `C-${String(index).padStart(2, "0")}`;
}

export function formatZoneId(index: number): string {
  return `Z-${String(index).padStart(2, "0")}`;
}

export function formatHallId(index: number): string {
  return `H-${String(index).padStart(2, "0")}`;
}

export function formatRackId(index: number): string {
  return `R-${String(index).padStart(4, "0")}`;
}

function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function buildRackRange(startIndex: number, endIndex: number, targetDensityKW: number): Rack[] {
  if (startIndex <= 0 || endIndex <= 0 || endIndex < startIndex) {
    return [];
  }

  const racks: Rack[] = [];
  for (let rackIndex = startIndex; rackIndex <= endIndex; rackIndex += 1) {
    racks.push({
      id: formatRackId(rackIndex),
      rackIndex,
      metadata: {
        name: `Rack ${rackIndex}`,
        capacityTarget: roundTo(targetDensityKW, 2),
        tags: ["rack"],
      },
    });
  }
  return racks;
}

/**
 * Deterministically derives a default v1 campus hierarchy from existing v0 parameters.
 * This keeps v0 parameter-driven behavior while introducing typed Campus/Zone/Hall/Rack entities.
 */
export function buildDefaultCampusFromParams(params: Params): Campus {
  const model = computeDataCenter(params);
  const campusId = formatCampusId(1);
  const zoneId = formatZoneId(1);

  const halls: Hall[] = model.halls.map((hall) => {
    const hallId = formatHallId(hall.hallIndex);
    return {
      id: hallId,
      hallIndex: hall.hallIndex,
      rackCount: hall.rackCount,
      rackStartIndex: hall.rackStartIndex,
      rackEndIndex: hall.rackEndIndex,
      metadata: {
        name: `Hall ${hall.hallIndex}`,
        notes: `${hall.rackCount.toLocaleString()} modeled racks`,
        capacityTarget: hall.capacity,
        tags: ["hall"],
      },
      racks: buildRackRange(hall.rackStartIndex, hall.rackEndIndex, params.rackPowerDensity),
    };
  });

  return {
    id: campusId,
    version: 1,
    metadata: {
      name: "Campus C-01",
      notes: "Generated from v0 parameter baseline.",
      capacityTarget: roundTo(params.criticalLoadMW, 2),
      tags: ["generated", "v1-default"],
    },
    zones: [
      {
        id: zoneId,
        zoneIndex: 1,
        metadata: {
          name: "Zone A",
          notes: "Default zone migrated from v0 state.",
          capacityTarget: model.rackCount,
          tags: ["default-zone"],
        },
        halls,
      },
    ],
  };
}
