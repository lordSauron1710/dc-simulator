import { buildDefaultCampusFromParams } from "@/model";
import type { AppState, Params } from "./types";

/**
 * v0 -> v1 migration utility.
 * Hydrates a v1 campus hierarchy from parameter-only (v0) state snapshots.
 */
export function mapV0ParamsToDefaultCampus(params: Params): AppState["campus"] {
  return buildDefaultCampusFromParams(params);
}

/**
 * Builds a full v1 app state from a parsed URL/share payload.
 * Existing v0 links (params + selection + mode flags) remain compatible.
 */
export function hydrateV1StateFromParsedState(
  baseState: AppState,
  parsedState: Partial<AppState> | null
): AppState {
  const mergedParams: Params = {
    ...baseState.params,
    ...(parsedState?.params ?? {}),
  };

  return {
    ...baseState,
    ...(parsedState ?? {}),
    params: mergedParams,
    selection: parsedState?.selection ?? baseState.selection,
    ui: { ...baseState.ui, ...(parsedState?.ui ?? {}) },
    campus: parsedState?.campus ?? mapV0ParamsToDefaultCampus(mergedParams),
  };
}
