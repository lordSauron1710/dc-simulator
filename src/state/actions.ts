/**
 * Store actions for DC Simulator (Prompt 03).
 */

import type { Params, Selection, ViewMode, UIState } from "./types";

export type StoreAction =
  | { type: "SET_PARAMS"; payload: Params }
  | { type: "PATCH_PARAMS"; payload: Partial<Params> }
  | { type: "SET_SELECTION"; payload: Selection }
  | { type: "SET_VIEW_MODE"; payload: ViewMode }
  | { type: "SET_UI"; payload: Partial<UIState> }
  | { type: "TOGGLE_DRAWER" };

export function setParams(params: Params): StoreAction {
  return { type: "SET_PARAMS", payload: params };
}

export function patchParams(payload: Partial<Params>): StoreAction {
  return { type: "PATCH_PARAMS", payload };
}

export function setSelection(selection: Selection): StoreAction {
  return { type: "SET_SELECTION", payload: selection };
}

export function setViewMode(viewMode: ViewMode): StoreAction {
  return { type: "SET_VIEW_MODE", payload: viewMode };
}

export function setUI(payload: Partial<UIState>): StoreAction {
  return { type: "SET_UI", payload };
}

export function toggleDrawer(): StoreAction {
  return { type: "TOGGLE_DRAWER" };
}
