/**
 * Store reducer for DC Simulator (Prompt 03).
 */

import type { AppState } from "./types";
import type { StoreAction } from "./actions";
import { DEFAULT_STATE } from "./types";
import { parseStateFromSearch } from "./urlState";

export function storeReducer(state: AppState, action: StoreAction): AppState {
  switch (action.type) {
    case "SET_PARAMS":
      return { ...state, params: action.payload };
    case "PATCH_PARAMS":
      return { ...state, params: { ...state.params, ...action.payload } };
    case "SET_SELECTION":
      return { ...state, selection: action.payload };
    case "SET_VIEW_MODE":
      return { ...state, viewMode: action.payload };
    case "SET_QUALITY":
      return { ...state, quality: action.payload };
    case "SET_SCROLL_FLOW_ENABLED":
      return {
        ...state,
        ui: { ...state.ui, scrollFlowEnabled: action.payload },
      };
    case "SET_CUTAWAY_ENABLED":
      return {
        ...state,
        ui: { ...state.ui, cutawayEnabled: action.payload },
      };
    case "SET_UI":
      return { ...state, ui: { ...state.ui, ...action.payload } };
    case "TOGGLE_DRAWER":
      return { ...state, ui: { ...state.ui, drawerOpen: !state.ui.drawerOpen } };
    case "REQUEST_CAMERA_RESET":
      return {
        ...state,
        ui: { ...state.ui, cameraResetNonce: state.ui.cameraResetNonce + 1 },
      };
    default:
      return state;
  }
}

export function getInitialState(): AppState {
  const base: AppState = {
    ...DEFAULT_STATE,
    params: { ...DEFAULT_STATE.params },
    selection: { ...DEFAULT_STATE.selection },
    ui: { ...DEFAULT_STATE.ui },
  };

  if (typeof window === "undefined") {
    return base;
  }

  const parsed = parseStateFromSearch(window.location.search);
  if (!parsed) {
    return base;
  }

  return {
    ...base,
    ...parsed,
    params: { ...base.params, ...(parsed.params ?? {}) },
    selection: parsed.selection ?? base.selection,
    ui: { ...base.ui, ...(parsed.ui ?? {}) },
  };
}
