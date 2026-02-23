/**
 * Store reducer for DC Simulator (Prompt 03).
 */

import type { AppState } from "./types";
import type { StoreAction } from "./actions";
import { DEFAULT_STATE } from "./types";
import { hydrateV1StateFromParsedState, mapV0ParamsToDefaultCampus } from "./migrations";

export function storeReducer(state: AppState, action: StoreAction): AppState {
  switch (action.type) {
    case "HYDRATE_FROM_URL":
      return hydrateV1StateFromParsedState(state, action.payload);
    case "SET_PARAMS":
      return {
        ...state,
        params: action.payload,
        campus: mapV0ParamsToDefaultCampus(action.payload),
      };
    case "PATCH_PARAMS": {
      const nextParams = { ...state.params, ...action.payload };
      return {
        ...state,
        params: nextParams,
        campus: mapV0ParamsToDefaultCampus(nextParams),
      };
    }
    case "SET_CAMPUS":
      return { ...state, campus: action.payload };
    case "SET_CAMPUS_AND_PARAMS":
      return {
        ...state,
        campus: action.payload.campus,
        params: action.payload.params,
      };
    case "SET_SELECTION":
      return { ...state, selection: action.payload };
    case "SET_VIEW_MODE":
      return { ...state, viewMode: action.payload };
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
    campus: mapV0ParamsToDefaultCampus(DEFAULT_STATE.params),
  };
  return base;
}
