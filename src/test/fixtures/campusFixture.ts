import { buildDefaultCampusFromParams, reconcileCampus, type Campus, type Hall } from "@/model";
import { DEFAULT_PARAMS } from "@/state";

function createHall(
  seedHall: Hall,
  id: string,
  hallIndex: number,
  name: string,
  rackCount: number,
  profile: Hall["profile"]
): Hall {
  return {
    ...seedHall,
    id,
    hallIndex,
    rackCount,
    rackStartIndex: 0,
    rackEndIndex: 0,
    metadata: {
      ...seedHall.metadata,
      name,
      notes: `${rackCount.toLocaleString()} modeled racks`,
    },
    profile,
    rackGroups: [
      {
        id: `${id}-G-01`,
        name: "Default Group",
        rackCount,
      },
    ],
    racks: [],
  };
}

export function createCampusFixture(): Campus {
  const base = buildDefaultCampusFromParams(DEFAULT_PARAMS);
  const seedZone = base.zones[0];
  const seedHall = seedZone.halls[0];

  const zoneA = {
    ...seedZone,
    id: "Z-01",
    zoneIndex: 1,
    metadata: {
      ...seedZone.metadata,
      name: "Zone A",
    },
    hallDefaults: {
      rackDensityKW: 8,
      redundancy: "N+1" as const,
      containment: "Hot Aisle" as const,
      coolingType: "Air-Cooled" as const,
    },
    rackRules: {
      minRackCount: 4,
      maxRackCount: 250,
      defaultRackCount: 80,
      step: 2,
    },
    halls: [
      createHall(seedHall, "H-01", 1, "Hall 1", 80, {
        rackDensityKW: 8,
        redundancy: "N+1",
        containment: "Hot Aisle",
        coolingType: "Air-Cooled",
      }),
      createHall(seedHall, "H-02", 2, "Hall 2", 96, {
        rackDensityKW: 12,
        redundancy: "N+1",
        containment: "Hot Aisle",
        coolingType: "Air-Cooled",
      }),
    ],
  };

  const zoneB = {
    ...seedZone,
    id: "Z-02",
    zoneIndex: 2,
    metadata: {
      ...seedZone.metadata,
      name: "Zone B",
    },
    hallDefaults: {
      rackDensityKW: 20,
      redundancy: "2N" as const,
      containment: "Cold Aisle" as const,
      coolingType: "DLC" as const,
    },
    rackRules: {
      minRackCount: 4,
      maxRackCount: 300,
      defaultRackCount: 70,
      step: 2,
    },
    halls: [
      createHall(seedHall, "H-03", 3, "Hall 3", 70, {
        rackDensityKW: 20,
        redundancy: "2N",
        containment: "Cold Aisle",
        coolingType: "DLC",
      }),
      createHall(seedHall, "H-04", 4, "Hall 4", 90, {
        rackDensityKW: 24,
        redundancy: "N",
        containment: "Full Enclosure",
        coolingType: "Hybrid",
      }),
    ],
  };

  return reconcileCampus({
    ...base,
    metadata: {
      ...base.metadata,
      name: "Campus Test",
      notes: "Fixture campus for deterministic model tests.",
    },
    properties: {
      targetPUE: 1.35,
      whitespaceRatio: 0.42,
    },
    zones: [zoneA, zoneB],
  });
}

export function flattenHalls(campus: Campus): Array<{ zoneId: string; hall: Hall }> {
  return campus.zones.flatMap((zone) => zone.halls.map((hall) => ({ zoneId: zone.id, hall })));
}
