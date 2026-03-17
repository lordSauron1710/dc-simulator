"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import type { AppState, Campus, Params, Selection, ViewMode } from "./types";
import type { StoreAction } from "./actions";
import {
  hydrateFromUrl,
  patchParams,
  setCampus,
  setCampusAndParams,
  setSelection,
  setCutawayEnabled,
  setScrollFlowEnabled,
  setViewMode,
  setUI,
  requestCameraReset,
  toggleDrawer,
} from "./actions";
import { storeReducer, getInitialState } from "./reducer";
import { parseStateFromSearch } from "./urlState";

interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<StoreAction>;
  // Convenience actions so consumers don't need action creators
  updateParams: (patch: Partial<Params>) => void;
  updateCampus: (campus: Campus) => void;
  updateCampusAndParams: (campus: Campus, params: Params) => void;
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
  const didHydrateFromUrlRef = useRef(false);

  useEffect(() => {
    if (didHydrateFromUrlRef.current) {
      return;
    }
    didHydrateFromUrlRef.current = true;

    const parsed = parseStateFromSearch(window.location.search);
    if (!parsed) {
      return;
    }

    dispatch(hydrateFromUrl(parsed));
  }, []);

  const updateParams = useCallback((patch: Partial<Params>) => {
    dispatch(patchParams(patch));
  }, []);

  const updateCampus = useCallback((campus: Campus) => {
    dispatch(setCampus(campus));
  }, []);

  const updateCampusAndParams = useCallback((campus: Campus, params: Params) => {
    dispatch(setCampusAndParams(campus, params));
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
      updateCampusAndParams,
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
      updateCampusAndParams,
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
