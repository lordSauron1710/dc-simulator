"use client";

import React, { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import type { AppState, Campus, Params, Selection, ViewMode } from "./types";
import type { StoreAction } from "./actions";
import {
  patchParams,
  setCampus,
  setSelection,
  setCutawayEnabled,
  setScrollFlowEnabled,
  setViewMode,
  setUI,
  requestCameraReset,
  toggleDrawer,
} from "./actions";
import { storeReducer, getInitialState } from "./reducer";

interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<StoreAction>;
  // Convenience actions so consumers don't need action creators
  updateParams: (patch: Partial<Params>) => void;
  updateCampus: (campus: Campus) => void;
  select: (selection: Selection) => void;
  setViewMode: (mode: ViewMode) => void;
  setCutawayEnabled: (enabled: boolean) => void;
  setScrollFlowEnabled: (enabled: boolean) => void;
  resetCamera: () => void;
  setDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(storeReducer, undefined, getInitialState);

  const updateParams = useCallback((patch: Partial<Params>) => {
    dispatch(patchParams(patch));
  }, []);

  const updateCampus = useCallback((campus: Campus) => {
    dispatch(setCampus(campus));
  }, []);

  const select = useCallback((selection: Selection) => {
    dispatch(setSelection(selection));
  }, []);

  const setViewModeAction = useCallback((mode: ViewMode) => {
    dispatch(setViewMode(mode));
  }, []);

  const setCutawayEnabledAction = useCallback((enabled: boolean) => {
    dispatch(setCutawayEnabled(enabled));
  }, []);

  const setScrollFlowEnabledAction = useCallback((enabled: boolean) => {
    dispatch(setScrollFlowEnabled(enabled));
  }, []);

  const resetCamera = useCallback(() => {
    dispatch(requestCameraReset());
  }, []);

  const setDrawerOpen = useCallback((open: boolean) => {
    dispatch(setUI({ drawerOpen: open }));
  }, []);

  const toggleDrawerAction = useCallback(() => {
    dispatch(toggleDrawer());
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      state,
      dispatch,
      updateParams,
      updateCampus,
      select,
      setViewMode: setViewModeAction,
      setCutawayEnabled: setCutawayEnabledAction,
      setScrollFlowEnabled: setScrollFlowEnabledAction,
      resetCamera,
      setDrawerOpen,
      toggleDrawer: toggleDrawerAction,
    }),
    [
      state,
      updateParams,
      updateCampus,
      select,
      setViewModeAction,
      setCutawayEnabledAction,
      setScrollFlowEnabledAction,
      resetCamera,
      setDrawerOpen,
      toggleDrawerAction,
    ]
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (ctx === null) {
    throw new Error("useStore must be used within StoreProvider");
  }
  return ctx;
}
