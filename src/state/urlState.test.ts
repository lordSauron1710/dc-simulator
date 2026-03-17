import { describe, expect, it } from "vitest";
import { DEFAULT_STATE } from "./types";
import { parseStateFromSearch, serializeStateToSearch } from "./urlState";

describe("urlState", () => {
  it("serializes and parses the shareable state payload", () => {
    const state = {
      ...DEFAULT_STATE,
      params: {
        ...DEFAULT_STATE.params,
        criticalLoadMW: 180,
        whitespaceAreaSqFt: 650000,
        dataHalls: 18,
        whitespaceRatio: 0.56,
        rackPowerDensity: 16,
        redundancy: "2N" as const,
        pue: 1.22,
        coolingType: "Air-Cooled" as const,
        containment: "Cold Aisle" as const,
      },
      selection: { type: "hall" as const, id: "H-01" },
      viewMode: "pan" as const,
      ui: {
        ...DEFAULT_STATE.ui,
        scrollFlowEnabled: true,
        cutawayEnabled: true,
      },
    };

    const search = serializeStateToSearch(state);
    const parsed = parseStateFromSearch(search);

    expect(parsed).toEqual({
      params: state.params,
      selection: state.selection,
      viewMode: state.viewMode,
      ui: {
        scrollFlowEnabled: true,
        cutawayEnabled: true,
      },
    });
  });

  it("parses legacy building selections from shared URLs", () => {
    const parsed = parseStateFromSearch("sel=building:B-01");

    expect(parsed).toEqual({
      selection: {
        id: "B-01",
        type: "campus",
      },
    });
  });

  it("omits selection from the share URL when the viewport is in full-view mode", () => {
    const search = serializeStateToSearch(DEFAULT_STATE);
    const query = new URLSearchParams(search);

    expect(query.has("sel")).toBe(false);
  });

  it("clamps numeric values and ignores invalid enums", () => {
    const parsed = parseStateFromSearch(
      "cl=9999&wa=1&dh=0&wr=7&rd=999&pe=0.1&re=bad&ct=unknown&cn=nope&vm=sideways&sf=yes&cw=no"
    );

    expect(parsed).toEqual({
      params: {
        criticalLoadMW: 1000,
        whitespaceAreaSqFt: 5000,
        dataHalls: 1,
        whitespaceRatio: 0.65,
        rackPowerDensity: 80,
        pue: 1.05,
      },
      ui: {
        scrollFlowEnabled: true,
        cutawayEnabled: false,
      },
    });
  });

  it("returns null when the search string has no usable state", () => {
    expect(parseStateFromSearch("")).toBeNull();
    expect(parseStateFromSearch("?")).toBeNull();
    expect(parseStateFromSearch("sel=broken&sf=maybe")).toBeNull();
  });
});
