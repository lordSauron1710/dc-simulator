import { describe, expect, it } from "vitest";
import { computeCampusModel, deriveParamsFromCampus, formatRackId } from "@/model";
import { DEFAULT_PARAMS } from "@/state";
import { createCampusFixture } from "@/test/fixtures/campusFixture";
import {
  normalizeLegacySelectionType,
  resolveSelectionScope,
  sanitizeSelection,
} from "./selectionScope";

function createScopeFixture() {
  const campus = createCampusFixture();
  const params = deriveParamsFromCampus(campus, DEFAULT_PARAMS);
  const model = computeCampusModel(campus, params);

  return { campus, model };
}

describe("selectionScope", () => {
  it("normalizes legacy building selections to campus", () => {
    expect(normalizeLegacySelectionType("building")).toBe("campus");
  });

  it("falls back to the campus selection when the target is invalid", () => {
    const { campus } = createScopeFixture();

    expect(sanitizeSelection(campus, { id: "Z-99", type: "zone" })).toEqual({
      id: campus.id,
      type: "campus",
    });
    expect(sanitizeSelection(campus, { id: "H-99", type: "hall" })).toEqual({
      id: campus.id,
      type: "campus",
    });
    expect(sanitizeSelection(campus, { id: "R-9999", type: "rack" })).toEqual({
      id: campus.id,
      type: "campus",
    });
  });

  it("resolves campus scope to every hall in the model", () => {
    const { campus, model } = createScopeFixture();

    const scope = resolveSelectionScope(model, { id: campus.id, type: "campus" });

    expect(scope).toMatchObject({
      type: "campus",
      selectionId: campus.id,
      zoneId: null,
      hallId: null,
      rackId: null,
    });
    expect(scope.hallIds).toEqual(model.halls.map((hall) => hall.id));
  });

  it("resolves zone scope without leaking halls from other zones", () => {
    const { campus, model } = createScopeFixture();
    const targetZone = campus.zones[1];

    const scope = resolveSelectionScope(model, { id: targetZone.id, type: "zone" });

    expect(scope).toMatchObject({
      type: "zone",
      selectionId: targetZone.id,
      zoneId: targetZone.id,
      zoneName: targetZone.metadata.name,
      hallId: null,
      rackId: null,
    });
    expect(scope.hallIds).toEqual(targetZone.halls.map((hall) => hall.id));
  });

  it("maps rack selections back to the containing hall and zone", () => {
    const { campus, model } = createScopeFixture();
    const targetZone = campus.zones[1];
    const targetHall = targetZone.halls[0];
    const rackId = formatRackId(targetHall.rackStartIndex);

    const scope = resolveSelectionScope(model, { id: rackId, type: "rack" });

    expect(scope).toMatchObject({
      type: "rack",
      selectionId: rackId,
      zoneId: targetZone.id,
      zoneName: targetZone.metadata.name,
      hallId: targetHall.id,
      hallName: targetHall.metadata.name,
      rackId,
      hallIds: [targetHall.id],
    });
  });
});
