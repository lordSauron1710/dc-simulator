import { describe, expect, it } from "vitest";
import { deriveParamsFromCampus } from "@/model";
import { createCampusFixture } from "@/test/fixtures/campusFixture";
import { hydrateFromUrl, patchParams, setCampus, setCampusAndParams } from "./actions";
import { storeReducer } from "./reducer";
import { DEFAULT_PARAMS, DEFAULT_STATE } from "./types";

describe("storeReducer campus/parameter consistency", () => {
  it("PATCH_PARAMS remaps campus from current parameter baseline", () => {
    const customCampus = createCampusFixture();
    const state = {
      ...DEFAULT_STATE,
      campus: customCampus,
    };

    const next = storeReducer(state, patchParams({ dataHalls: 5, rackPowerDensity: 14 }));

    expect(next.params.dataHalls).toBe(5);
    expect(next.params.rackPowerDensity).toBe(14);
    expect(next.campus).not.toBe(customCampus);
    expect(next.campus.zones[0].halls).toHaveLength(5);
    next.campus.zones[0].halls.forEach((hall) => {
      expect(hall.profile.rackDensityKW).toBe(14);
    });
  });

  it("SET_CAMPUS updates hierarchy without mutating active params", () => {
    const customCampus = createCampusFixture();
    const state = {
      ...DEFAULT_STATE,
      params: {
        ...DEFAULT_PARAMS,
        rackPowerDensity: 18,
      },
    };

    const next = storeReducer(state, setCampus(customCampus));

    expect(next.campus).toBe(customCampus);
    expect(next.params).toEqual(state.params);
  });

  it("SET_CAMPUS_AND_PARAMS applies an atomic synchronized update", () => {
    const customCampus = createCampusFixture();
    const derivedParams = deriveParamsFromCampus(customCampus, DEFAULT_PARAMS);
    const state = {
      ...DEFAULT_STATE,
      params: DEFAULT_PARAMS,
    };

    const next = storeReducer(state, setCampusAndParams(customCampus, derivedParams));

    expect(next.campus).toBe(customCampus);
    expect(next.params).toBe(derivedParams);
    expect(next.params.dataHalls).toBe(4);
    expect(next.params.criticalLoadMW).toBe(5.35);
  });

  it("HYDRATE_FROM_URL merges parsed state and derives campus from hydrated params", () => {
    const state = { ...DEFAULT_STATE };
    const next = storeReducer(
      state,
      hydrateFromUrl({
        params: {
          ...DEFAULT_PARAMS,
          dataHalls: 6,
          rackPowerDensity: 11,
        },
        selection: { id: "H-02", type: "hall" },
      })
    );

    expect(next.params.dataHalls).toBe(6);
    expect(next.params.rackPowerDensity).toBe(11);
    expect(next.selection).toEqual({ id: "H-02", type: "hall" });
    expect(next.campus.zones[0].halls).toHaveLength(6);
    next.campus.zones[0].halls.forEach((hall) => {
      expect(hall.profile.rackDensityKW).toBe(11);
    });
  });
});
