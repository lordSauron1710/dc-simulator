import type { Campus } from "./campus";
import type { CampusModel } from "./campusBuilder";

export type SelectionDisplayMode = "focus" | "isolate";
export type SelectionLikeType = "campus" | "zone" | "hall" | "rack" | null;

export interface SelectionLike {
  id: string;
  type: SelectionLikeType;
}

export interface ResolvedSelectionScope {
  type: "campus" | "zone" | "hall" | "rack";
  selectionId: string;
  campusId: string;
  campusName: string;
  zoneId: string | null;
  zoneName: string | null;
  hallId: string | null;
  hallName: string | null;
  rackId: string | null;
  hallIds: string[];
}

function parseTrailingNumber(value: string): number | null {
  const match = value.match(/\d+/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildCampusSelection(campus: Campus): SelectionLike {
  return {
    id: campus.id,
    type: "campus",
  };
}

function findHallByRackId(campus: Campus, rackId: string) {
  const rackIndex = parseTrailingNumber(rackId);
  if (rackIndex === null) {
    return null;
  }

  for (const zone of campus.zones) {
    for (const hall of zone.halls) {
      if (rackIndex >= hall.rackStartIndex && rackIndex <= hall.rackEndIndex) {
        return { zone, hall };
      }
    }
  }

  return null;
}

function findHallById(campus: Campus, hallId: string) {
  for (const zone of campus.zones) {
    const hall = zone.halls.find((entry) => entry.id === hallId);
    if (hall) {
      return { zone, hall };
    }
  }

  return null;
}

export function normalizeLegacySelectionType(type: string | null): SelectionLikeType {
  if (type === "building") {
    return "campus";
  }

  return type === "campus" || type === "zone" || type === "hall" || type === "rack" ? type : null;
}

export function sanitizeSelection(campus: Campus, selection: SelectionLike): SelectionLike {
  if (selection.type === "campus") {
    return buildCampusSelection(campus);
  }

  if (selection.type === "zone") {
    const zone = campus.zones.find((entry) => entry.id === selection.id);
    return zone ? selection : buildCampusSelection(campus);
  }

  if (selection.type === "hall") {
    return findHallById(campus, selection.id) ? selection : buildCampusSelection(campus);
  }

  if (selection.type === "rack") {
    return findHallByRackId(campus, selection.id) ? selection : buildCampusSelection(campus);
  }

  return buildCampusSelection(campus);
}

export function sanitizeSelectionForCampus<T extends { campus: Campus; selection: SelectionLike }>(state: T): T {
  return {
    ...state,
    selection: sanitizeSelection(state.campus, state.selection),
  };
}

export function resolveSelectionScope(model: CampusModel, selection: SelectionLike): ResolvedSelectionScope {
  const normalizedType = normalizeLegacySelectionType(selection.type);

  if (normalizedType === "zone") {
    const zone = model.specs.zonesById[selection.id];
    if (zone) {
      return {
        type: "zone",
        selectionId: zone.id,
        campusId: model.campus.id,
        campusName: model.campus.name,
        zoneId: zone.id,
        zoneName: zone.name,
        hallId: null,
        hallName: null,
        rackId: null,
        hallIds: zone.halls.map((hall) => hall.id),
      };
    }
  }

  if (normalizedType === "hall") {
    const hall = model.specs.hallsById[selection.id];
    if (hall) {
      const zone = model.specs.zonesById[hall.zoneId];
      return {
        type: "hall",
        selectionId: hall.id,
        campusId: model.campus.id,
        campusName: model.campus.name,
        zoneId: hall.zoneId,
        zoneName: zone?.name ?? null,
        hallId: hall.id,
        hallName: hall.name,
        rackId: null,
        hallIds: [hall.id],
      };
    }
  }

  if (normalizedType === "rack") {
    const rackIndex = parseTrailingNumber(selection.id);
    const hall = rackIndex === null
      ? null
      : model.halls.find((entry) => rackIndex >= entry.rackStartIndex && rackIndex <= entry.rackEndIndex) ?? null;
    if (hall) {
      const zone = model.specs.zonesById[hall.zoneId];
      return {
        type: "rack",
        selectionId: selection.id,
        campusId: model.campus.id,
        campusName: model.campus.name,
        zoneId: hall.zoneId,
        zoneName: zone?.name ?? null,
        hallId: hall.id,
        hallName: hall.name,
        rackId: selection.id,
        hallIds: [hall.id],
      };
    }
  }

  return {
    type: "campus",
    selectionId: model.campus.id,
    campusId: model.campus.id,
    campusName: model.campus.name,
    zoneId: null,
    zoneName: null,
    hallId: null,
    hallName: null,
    rackId: null,
    hallIds: model.halls.map((hall) => hall.id),
  };
}
