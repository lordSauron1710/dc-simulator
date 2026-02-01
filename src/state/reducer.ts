/**
 * Store reducer for DC Simulator (Prompt 03).
 */

import type { AppState } from "./types";
import type { StoreAction } from "./actions";
import { DEFAULT_STATE } from "./types";

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
    case "SET_UI":
      return { ...state, ui: { ...state.ui, ...action.payload } };
    case "TOGGLE_DRAWER":
      return { ...state, ui: { ...state.ui, drawerOpen: !state.ui.drawerOpen } };
    default:
      return state;
  }
}

export function getInitialState(): AppState {
  return { ...DEFAULT_STATE };
}
