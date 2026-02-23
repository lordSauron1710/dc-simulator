import { describe, expect, it } from "vitest";
import {
  applyCampusPropertyPatch,
  applyRackProfilePatchByScope,
  buildDefaultCampusFromParams,
  CAMPUS_PARAM_LIMITS,
  computeDataCenterFromCampus,
  deriveParamsFromCampus,
  deriveParamsFromReconciledCampus,
  reconcileCampus,
  validateCampus,
  type Campus,
  type CoolingProfile,
  type ContainmentProfile,
  type CampusParameterScope,
  type RackProfilePatch,
  type RedundancyProfile,
} from "@/model";
import { DEFAULT_PARAMS } from "@/state";
import { createCampusFixture, flattenHalls } from "@/test/fixtures/campusFixture";

function cloneCampus(campus: Campus): Campus {
  return JSON.parse(JSON.stringify(campus)) as Campus;
}

function expectedDensity(value: number): number {
  const clamped = Math.min(
    CAMPUS_PARAM_LIMITS.rackPowerDensity.max,
    Math.max(CAMPUS_PARAM_LIMITS.rackPowerDensity.min, value)
  );
  return Math.round(clamped * 100) / 100;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randomInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

function pickFromList<T>(rand: () => number, values: T[]): T {
  return values[randomInt(rand, 0, values.length - 1)];
}

function createLargeCampus(seed = 17): Campus {
  const rand = createSeededRandom(seed);
  const base = buildDefaultCampusFromParams(DEFAULT_PARAMS);
  const templateZone = base.zones[0];
  const templateHall = templateZone.halls[0];
  const redundancies: RedundancyProfile[] = ["N", "N+1", "2N"];
  const containments: ContainmentProfile[] = ["None", "Hot Aisle", "Cold Aisle", "Full Enclosure"];
  const coolingProfiles: CoolingProfile[] = ["Air-Cooled", "DLC", "Hybrid"];

  const zoneCount = 6;
  const hallsPerZone = 12;
  let hallIndex = 1;

  const zones = Array.from({ length: zoneCount }, (_, zoneIndex) => {
    const minRackCount = randomInt(rand, 4, 24);
    const maxRackCount = randomInt(rand, 300, 450);
    const defaultRackCount = randomInt(rand, minRackCount, maxRackCount);
    const step = randomInt(rand, 1, 8);

    const hallDefaults = {
      rackDensityKW: randomInt(rand, 6, 40),
      redundancy: pickFromList(rand, redundancies),
      containment: pickFromList(rand, containments),
      coolingType: pickFromList(rand, coolingProfiles),
    };

    const halls = Array.from({ length: hallsPerZone }, () => {
      const rackCount = randomInt(rand, minRackCount, maxRackCount);
      const rackDensityKW = randomInt(rand, 6, 55);
      const hallId = `H-${String(hallIndex).padStart(2, "0")}`;
      const hallName = `Hall ${hallIndex}`;

      const hall = {
        ...templateHall,
        id: hallId,
        hallIndex,
        rackCount,
        rackStartIndex: 0,
        rackEndIndex: 0,
        metadata: {
          ...templateHall.metadata,
          name: hallName,
          notes: `${rackCount.toLocaleString()} modeled racks`,
        },
        profile: {
          rackDensityKW,
          redundancy: pickFromList(rand, redundancies),
          containment: pickFromList(rand, containments),
          coolingType: pickFromList(rand, coolingProfiles),
        },
        rackGroups: [
          {
            id: `${hallId}-G-01`,
            name: "Default Group",
            rackCount,
          },
        ],
        racks: [],
      };

      hallIndex += 1;
      return hall;
    });

    return {
      ...templateZone,
      id: `Z-${String(zoneIndex + 1).padStart(2, "0")}`,
      zoneIndex: zoneIndex + 1,
      metadata: {
        ...templateZone.metadata,
        name: `Zone ${String.fromCharCode(65 + zoneIndex)}`,
      },
      hallDefaults,
      rackRules: {
        minRackCount,
        maxRackCount,
        defaultRackCount,
        step,
      },
      halls,
    };
  });

  return {
    ...base,
    metadata: {
      ...base.metadata,
      name: "Stress Campus",
      notes: "Large synthetic campus for stress validation.",
    },
    properties: {
      targetPUE: 1.38,
      whitespaceRatio: 0.41,
    },
    zones,
  };
}

describe("applyRackProfilePatchByScope", () => {
  const patchCases: Array<{ name: string; patch: RackProfilePatch }> = [
    { name: "density only", patch: { rackDensityKW: 26 } },
    { name: "redundancy only", patch: { redundancy: "2N" } },
    { name: "containment only", patch: { containment: "Cold Aisle" } },
    { name: "cooling only", patch: { coolingType: "Hybrid" } },
    {
      name: "all profile fields",
      patch: {
        rackDensityKW: 16,
        redundancy: "N",
        containment: "None",
        coolingType: "DLC",
      },
    },
  ];

  const scopeCases: Array<{
    name: string;
    scope: CampusParameterScope;
    targetHallIds: string[];
    targetZoneDefaults: string[];
  }> = [
    {
      name: "campus scope",
      scope: { level: "campus" },
      targetHallIds: ["H-01", "H-02", "H-03", "H-04"],
      targetZoneDefaults: ["Z-01", "Z-02"],
    },
    {
      name: "zone scope",
      scope: { level: "zone", zoneId: "Z-02" },
      targetHallIds: ["H-03", "H-04"],
      targetZoneDefaults: ["Z-02"],
    },
    {
      name: "hall scope",
      scope: { level: "hall", zoneId: "Z-02", hallId: "H-03" },
      targetHallIds: ["H-03"],
      targetZoneDefaults: [],
    },
  ];

  for (const patchCase of patchCases) {
    for (const scopeCase of scopeCases) {
      it(`applies ${patchCase.name} in ${scopeCase.name}`, () => {
        const campus = createCampusFixture();
        const nextCampus = applyRackProfilePatchByScope(campus, scopeCase.scope, patchCase.patch);
        const targetHallIds = new Set(scopeCase.targetHallIds);
        const targetZoneDefaults = new Set(scopeCase.targetZoneDefaults);

        const beforeHallMap = new Map(flattenHalls(campus).map(({ hall }) => [hall.id, hall]));
        flattenHalls(nextCampus).forEach(({ zoneId, hall }) => {
          const before = beforeHallMap.get(hall.id);
          if (!before) {
            throw new Error(`Missing baseline hall ${hall.id}`);
          }

          const isTargetedHall = targetHallIds.has(hall.id);
          expect(hall.profile.rackDensityKW).toBe(
            patchCase.patch.rackDensityKW !== undefined && isTargetedHall
              ? expectedDensity(patchCase.patch.rackDensityKW)
              : before.profile.rackDensityKW
          );
          expect(hall.profile.redundancy).toBe(
            patchCase.patch.redundancy && isTargetedHall
              ? patchCase.patch.redundancy
              : before.profile.redundancy
          );
          expect(hall.profile.containment).toBe(
            patchCase.patch.containment && isTargetedHall
              ? patchCase.patch.containment
              : before.profile.containment
          );
          expect(hall.profile.coolingType).toBe(
            patchCase.patch.coolingType && isTargetedHall
              ? patchCase.patch.coolingType
              : before.profile.coolingType
          );

          const beforeZone = campus.zones.find((zone) => zone.id === zoneId);
          const afterZone = nextCampus.zones.find((zone) => zone.id === zoneId);
          if (!beforeZone || !afterZone) {
            throw new Error(`Missing zone ${zoneId}`);
          }

          const isTargetedZoneDefaults = targetZoneDefaults.has(zoneId);
          expect(afterZone.hallDefaults.rackDensityKW).toBe(
            patchCase.patch.rackDensityKW !== undefined && isTargetedZoneDefaults
              ? expectedDensity(patchCase.patch.rackDensityKW)
              : beforeZone.hallDefaults.rackDensityKW
          );
          expect(afterZone.hallDefaults.redundancy).toBe(
            patchCase.patch.redundancy && isTargetedZoneDefaults
              ? patchCase.patch.redundancy
              : beforeZone.hallDefaults.redundancy
          );
          expect(afterZone.hallDefaults.containment).toBe(
            patchCase.patch.containment && isTargetedZoneDefaults
              ? patchCase.patch.containment
              : beforeZone.hallDefaults.containment
          );
          expect(afterZone.hallDefaults.coolingType).toBe(
            patchCase.patch.coolingType && isTargetedZoneDefaults
              ? patchCase.patch.coolingType
              : beforeZone.hallDefaults.coolingType
          );
        });
      });
    }
  }

  it("clamps out-of-range rack density before applying", () => {
    const campus = createCampusFixture();
    const nextCampus = applyRackProfilePatchByScope(campus, { level: "campus" }, { rackDensityKW: 999 });
    flattenHalls(nextCampus).forEach(({ hall }) => {
      expect(hall.profile.rackDensityKW).toBe(CAMPUS_PARAM_LIMITS.rackPowerDensity.max);
    });
  });

  it("falls back to the first hall in a zone when hall scope omits hall id", () => {
    const campus = createCampusFixture();
    const nextCampus = applyRackProfilePatchByScope(
      campus,
      { level: "hall", zoneId: "Z-02", hallId: null },
      { redundancy: "N+1" }
    );

    const hall3 = flattenHalls(nextCampus).find(({ hall }) => hall.id === "H-03");
    const hall4 = flattenHalls(nextCampus).find(({ hall }) => hall.id === "H-04");
    expect(hall3?.hall.profile.redundancy).toBe("N+1");
    expect(hall4?.hall.profile.redundancy).toBe("N");
  });

  it("returns the original campus when scope cannot be resolved", () => {
    const campus = createCampusFixture();
    const nextCampus = applyRackProfilePatchByScope(
      campus,
      { level: "zone", zoneId: "Z-999" },
      { coolingType: "Hybrid" }
    );
    expect(nextCampus).toBe(campus);
  });

  it("returns the original campus for an empty patch", () => {
    const campus = createCampusFixture();
    const nextCampus = applyRackProfilePatchByScope(campus, { level: "campus" }, {});
    expect(nextCampus).toBe(campus);
  });
});

describe("applyCampusPropertyPatch", () => {
  it("clamps campus properties to supported limits", () => {
    const campus = createCampusFixture();
    const nextCampus = applyCampusPropertyPatch(campus, {
      targetPUE: 99,
      whitespaceRatio: -4,
    });

    expect(nextCampus.properties.targetPUE).toBe(CAMPUS_PARAM_LIMITS.pue.max);
    expect(nextCampus.properties.whitespaceRatio).toBe(CAMPUS_PARAM_LIMITS.whitespaceRatio.min);
    expect(campus.properties.targetPUE).toBe(1.35);
    expect(campus.properties.whitespaceRatio).toBe(0.42);
  });

  it("returns the original campus when no valid property patch is provided", () => {
    const campus = createCampusFixture();
    expect(applyCampusPropertyPatch(campus, {})).toBe(campus);
    expect(applyCampusPropertyPatch(campus, { targetPUE: Number.NaN })).toBe(campus);
  });
});

describe("campus synthesis and validation", () => {
  it("reconciles rack rules, rack groups, and rack indexing deterministically", () => {
    const campus = cloneCampus(createCampusFixture());
    campus.zones[0].rackRules = {
      minRackCount: 4,
      maxRackCount: 10,
      defaultRackCount: 700,
      step: 0,
    };
    campus.zones[0].halls[0].rackGroups = [
      { id: "", name: "", rackCount: 30 },
      { id: "", name: "Overflow", rackCount: 20 },
    ];
    campus.zones[0].halls[0].rackCount = 999;
    campus.zones[0].halls[0].profile.rackDensityKW = 120;

    const reconciled = reconcileCampus(campus);
    const firstZone = reconciled.zones[0];
    const firstHall = firstZone.halls[0];

    expect(firstZone.rackRules.minRackCount).toBe(4);
    expect(firstZone.rackRules.maxRackCount).toBe(10);
    expect(firstZone.rackRules.defaultRackCount).toBe(10);
    expect(firstZone.rackRules.step).toBe(1);
    expect(firstHall.rackCount).toBe(10);
    expect(firstHall.profile.rackDensityKW).toBe(CAMPUS_PARAM_LIMITS.rackPowerDensity.max);
    expect(firstHall.rackGroups.reduce((sum, group) => sum + group.rackCount, 0)).toBe(10);
    expect(firstHall.rackGroups[0].name).toBe("Group 1");

    const halls = flattenHalls(reconciled).map((entry) => entry.hall);
    let expectedStart = 1;
    halls.forEach((hall) => {
      expect(hall.rackStartIndex).toBe(expectedStart);
      expect(hall.rackEndIndex).toBe(expectedStart + hall.rackCount - 1);
      expect(hall.racks).toHaveLength(hall.rackCount);
      expectedStart = hall.rackEndIndex + 1;
    });
  });

  it("derives aggregated params from hall-level profiles and campus properties", () => {
    const campus = createCampusFixture();
    const derived = deriveParamsFromCampus(campus, DEFAULT_PARAMS);

    expect(derived.criticalLoadMW).toBe(5.35);
    expect(derived.dataHalls).toBe(4);
    expect(derived.rackPowerDensity).toBe(15.93);
    expect(derived.redundancy).toBe("N+1");
    expect(derived.coolingType).toBe("Air-Cooled");
    expect(derived.containment).toBe("Hot Aisle");
    expect(derived.whitespaceAreaSqFt).toBe(12096);
    expect(derived.pue).toBe(1.35);
  });

  it("builds deterministic campus model totals with hall-level rack distributions", () => {
    const campus = createCampusFixture();
    const model = computeDataCenterFromCampus(campus, DEFAULT_PARAMS);
    const repeated = computeDataCenterFromCampus(campus, DEFAULT_PARAMS);

    expect(model).toEqual(repeated);
    expect(model.hallRackDistribution).toEqual([80, 96, 70, 90]);
    expect(model.rackCount).toBe(336);
    expect(model.halls.map((hall) => hall.id)).toEqual(["H-01", "H-02", "H-03", "H-04"]);
    expect(model.rackCount).toBe(model.halls.reduce((sum, hall) => sum + hall.rackCount, 0));
    expect(model.facilityLoad.criticalITMW).toBe(5.35);
    expect(model.facilityLoad.totalFacilityMW).toBe(7.22);
    expect(model.facilityLoad.nonITOverheadMW).toBe(1.87);
  });

  it("reports actionable validation issues for invalid campus states", () => {
    const invalid = cloneCampus(createCampusFixture());
    invalid.metadata.name = "";
    invalid.properties.targetPUE = 3;
    invalid.properties.whitespaceRatio = 0.9;
    invalid.zones[0].metadata.name = "";
    invalid.zones[0].rackRules.minRackCount = 20;
    invalid.zones[0].rackRules.maxRackCount = 10;
    invalid.zones[0].rackRules.step = 0;
    invalid.zones[0].halls[0].metadata.name = "";
    invalid.zones[0].halls[0].profile.rackDensityKW = 100;
    invalid.zones[0].halls[0].rackGroups = [{ id: "H-01-G-01", name: "", rackCount: 0 }];

    const issues = validateCampus(invalid);
    const issueText = issues.map((issue) => `${issue.path} ${issue.message}`).join("\n");

    expect(issueText).toContain("Campus name is required.");
    expect(issueText).toContain("Campus target PUE");
    expect(issueText).toContain("Campus whitespace ratio");
    expect(issueText).toContain("Zone 1");
    expect(issueText).toContain("rack rules");
    expect(issueText).toContain("Hall 1");
    expect(issueText).toContain("density");
    expect(issueText).toContain("rack groups");
  });
});

describe("campus stress and cache behavior", () => {
  it("derives identical params from reconciled vs unreconciled campus inputs", () => {
    const campus = createLargeCampus(23);
    const reconciled = reconcileCampus(campus);

    const fromReconciled = deriveParamsFromReconciledCampus(reconciled, DEFAULT_PARAMS);
    const fromRaw = deriveParamsFromCampus(campus, DEFAULT_PARAMS);

    expect(fromReconciled).toEqual(fromRaw);
  });

  it("keeps structural invariants under extreme hierarchy sizes", () => {
    const campus = reconcileCampus(createLargeCampus());
    const model = computeDataCenterFromCampus(campus, DEFAULT_PARAMS);

    const halls = flattenHalls(campus).map((entry) => entry.hall);
    expect(halls).toHaveLength(72);
    expect(model.halls).toHaveLength(72);

    let expectedStart = 1;
    halls.forEach((hall) => {
      expect(hall.rackCount).toBeGreaterThan(0);
      expect(hall.rackStartIndex).toBe(expectedStart);
      expect(hall.rackEndIndex).toBe(expectedStart + hall.rackCount - 1);
      expect(hall.racks).toHaveLength(hall.rackCount);
      if (hall.rackGroups.length > 0) {
        expect(hall.rackGroups.reduce((sum, group) => sum + group.rackCount, 0)).toBe(hall.rackCount);
      }
      expectedStart = hall.rackEndIndex + 1;
    });

    expect(model.hallRackDistribution).toEqual(model.halls.map((hall) => hall.rackCount));
    expect(model.rackCount).toBe(model.hallRackDistribution.reduce((sum, count) => sum + count, 0));
    model.halls.forEach((hall) => {
      expect(hall.rackCount).toBeLessThanOrEqual(hall.capacity);
    });
    expect(model.facilityLoad.totalFacilityMW).toBeGreaterThanOrEqual(model.facilityLoad.criticalITMW);
    expect(model.facilityLoad.nonITOverheadMW).toBeGreaterThanOrEqual(0);
  });

  it("returns stable cached references for identical campus + fallback keys", () => {
    const campus = reconcileCampus(createLargeCampus(99));

    const first = computeDataCenterFromCampus(campus, DEFAULT_PARAMS);
    const second = computeDataCenterFromCampus(campus, DEFAULT_PARAMS);
    expect(second).toBe(first);

    const withDifferentFallback = computeDataCenterFromCampus(
      campus,
      { ...DEFAULT_PARAMS, pue: DEFAULT_PARAMS.pue + 0.01 }
    );
    expect(withDifferentFallback).toEqual(first);
  });

  it("evicts oldest campus cache entries once per-campus cache limit is exceeded", () => {
    const campus = reconcileCampus(createCampusFixture());
    const fallbacks = Array.from({ length: 7 }, (_, index) => ({
      ...DEFAULT_PARAMS,
      pue: 1.1 + index * 0.01,
    }));

    const first = computeDataCenterFromCampus(campus, fallbacks[0]);
    fallbacks.slice(1).forEach((fallback) => {
      computeDataCenterFromCampus(campus, fallback);
    });

    const recomputed = computeDataCenterFromCampus(campus, fallbacks[0]);
    expect(recomputed).not.toBe(first);
    expect(recomputed).toEqual(first);
  });

  it("survives randomized patch/reconcile/model cycles without invariant breaks", () => {
    const scopes: CampusParameterScope[] = [
      { level: "campus" },
      { level: "zone", zoneId: "Z-01" },
      { level: "hall", zoneId: "Z-01", hallId: "H-01" },
    ];
    const profilePatches: RackProfilePatch[] = [
      { rackDensityKW: 14 },
      { redundancy: "2N" },
      { coolingType: "Hybrid", containment: "Cold Aisle" },
      { rackDensityKW: 999, redundancy: "N+1", containment: "Hot Aisle", coolingType: "DLC" },
    ];

    for (let seed = 1; seed <= 20; seed += 1) {
      const rand = createSeededRandom(seed);
      let campus = createCampusFixture();

      for (let step = 0; step < 12; step += 1) {
        const scope = scopes[randomInt(rand, 0, scopes.length - 1)];
        const patch = profilePatches[randomInt(rand, 0, profilePatches.length - 1)];
        const withProfilePatch = applyRackProfilePatchByScope(campus, scope, patch);
        const withCampusPatch = applyCampusPropertyPatch(withProfilePatch, {
          targetPUE: 1.05 + randomInt(rand, 0, 95) / 100,
          whitespaceRatio: 0.25 + randomInt(rand, 0, 40) / 100,
        });
        campus = reconcileCampus(withCampusPatch);

        const issues = validateCampus(campus);
        expect(issues).toHaveLength(0);

        const model = computeDataCenterFromCampus(campus, DEFAULT_PARAMS);
        expect(model.rackCount).toBe(model.halls.reduce((sum, hall) => sum + hall.rackCount, 0));
        expect(model.rackCapacityBySpace).toBeGreaterThanOrEqual(model.rackCount);
        expect(model.halls.length).toBeGreaterThan(0);
      }
    }
  });
});
