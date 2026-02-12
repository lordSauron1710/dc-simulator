"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Viewport } from "@/scene/Viewport";
import { ExplorerTree } from "@/ui/ExplorerTree";
import { SpecsPanel } from "@/ui/SpecsPanel";
import { PresetsPanel } from "@/ui/PresetsPanel";
import { BottomControls } from "@/ui/BottomControls";
import { ParamDrawer } from "@/ui/ParamDrawer";
import {
  buildShareUrl,
  detectPresetId,
  getPresetById,
  serializeStateToSearch,
  type PresetId,
  useStore,
} from "@/state";

export default function SandboxPage() {
  const {
    state,
    select,
    setViewMode,
    setCutawayEnabled,
    setScrollFlowEnabled,
    resetCamera,
    updateParams,
    toggleDrawer,
  } = useStore();
  const rightTopRef = useRef<HTMLDivElement | null>(null);
  const inspectorHostRef = useRef<HTMLDivElement | null>(null);
  const [presetsForceMinimized, setPresetsForceMinimized] = useState(false);
  const [presetsExpandedHeight, setPresetsExpandedHeight] = useState(280);
  const [inspectorMaxHeight, setInspectorMaxHeight] = useState<number | null>(null);
  const [explorerMinimized, setExplorerMinimized] = useState(false);
  const [paramsMinimized, setParamsMinimized] = useState(false);
  const [inspectorMinimized, setInspectorMinimized] = useState(false);
  const [presetsMinimized, setPresetsMinimized] = useState(false);
  const [controlsMinimized, setControlsMinimized] = useState(false);

  const activePresetId = useMemo(() => detectPresetId(state.params), [state.params]);
  const leftRailMinimized = explorerMinimized && paramsMinimized;
  const rightRailMinimized = inspectorMinimized && presetsMinimized && controlsMinimized;
  const allPanelsMinimized =
    explorerMinimized &&
    paramsMinimized &&
    inspectorMinimized &&
    presetsMinimized &&
    controlsMinimized;
  const uiLayerClassName = [
    "ui-layer",
    leftRailMinimized ? "ui-left-minimized" : "",
    rightRailMinimized ? "ui-right-minimized" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleApplyPreset = useCallback(
    (presetId: PresetId) => {
      const preset = getPresetById(presetId);
      if (!preset) {
        return;
      }

      updateParams(preset.params);
      select(preset.selection);
      setViewMode("orbit");
      setScrollFlowEnabled(false);
    },
    [select, setScrollFlowEnabled, setViewMode, updateParams]
  );

  const handleCopyShareLink = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined" || !window.navigator?.clipboard?.writeText) {
      return false;
    }

    try {
      await window.navigator.clipboard.writeText(buildShareUrl(state));
      return true;
    } catch {
      return false;
    }
  }, [state]);

  const handleToggleAllPanels = useCallback(() => {
    const nextMinimized = !allPanelsMinimized;
    setExplorerMinimized(nextMinimized);
    setParamsMinimized(nextMinimized);
    setInspectorMinimized(nextMinimized);
    setPresetsMinimized(nextMinimized);
    setControlsMinimized(nextMinimized);
  }, [allPanelsMinimized]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handle = window.setTimeout(() => {
      const nextSearch = serializeStateToSearch(state);
      const currentSearch = window.location.search.startsWith("?")
        ? window.location.search.slice(1)
        : window.location.search;
      if (nextSearch === currentSearch) {
        return;
      }

      const nextUrl = new URL(window.location.href);
      nextUrl.search = nextSearch ? `?${nextSearch}` : "";
      window.history.replaceState(window.history.state, "", nextUrl.toString());
    }, 220);

    return () => window.clearTimeout(handle);
  }, [
    state.params,
    state.selection.id,
    state.selection.type,
    state.viewMode,
    state.ui.scrollFlowEnabled,
    state.ui.cutawayEnabled,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.matchMedia("(max-width: 900px)").matches) {
      setExplorerMinimized(true);
      setParamsMinimized(true);
      setInspectorMinimized(true);
      setPresetsMinimized(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const container = rightTopRef.current;
    const inspectorHost = inspectorHostRef.current;
    if (!container || !inspectorHost) {
      return;
    }

    let rafId: number | null = null;

    const evaluateLayout = () => {
      const containerHeight = container.clientHeight;
      const stackGap = 6;
      const presetsBubbleHeight = 34;
      const presetsHeightForLayout = presetsMinimized ? presetsBubbleHeight : presetsExpandedHeight;
      const inspectorElement = inspectorHost.firstElementChild as HTMLElement | null;
      const inspectorNaturalHeight = inspectorElement
        ? Math.max(inspectorElement.scrollHeight, Math.round(inspectorHost.getBoundingClientRect().height))
        : Math.round(inspectorHost.getBoundingClientRect().height);
      const requiredHeight = inspectorNaturalHeight + stackGap + presetsHeightForLayout;
      const overflowing = container.scrollHeight > container.clientHeight + 2;
      const shouldForceBubble = overflowing || requiredHeight > containerHeight;
      const nextInspectorMaxHeight = shouldForceBubble
        ? Math.max(96, Math.floor(containerHeight - stackGap - presetsBubbleHeight))
        : null;

      setPresetsForceMinimized((current) => {
        if (current === shouldForceBubble) {
          return current;
        }
        return shouldForceBubble;
      });
      setInspectorMaxHeight((current) => {
        if (current === nextInspectorMaxHeight) {
          return current;
        }
        return nextInspectorMaxHeight;
      });
    };

    const scheduleEvaluate = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        evaluateLayout();
      });
    };

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => scheduleEvaluate())
        : null;

    resizeObserver?.observe(container);
    resizeObserver?.observe(inspectorHost);
    window.addEventListener("resize", scheduleEvaluate);
    scheduleEvaluate();

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleEvaluate);
    };
  }, [
    presetsExpandedHeight,
    presetsMinimized,
    state.selection.id,
    state.selection.type,
    state.params,
  ]);

  return (
    <>
      <Viewport />

      <div className={uiLayerClassName}>
        <div className="ui-toolbar" role="toolbar" aria-label="Interface visibility controls">
          <button
            type="button"
            className={`ui-toolbar-btn ${explorerMinimized ? "" : "active"}`}
            onClick={() => setExplorerMinimized((current) => !current)}
            aria-pressed={!explorerMinimized}
          >
            Explorer
          </button>
          <button
            type="button"
            className={`ui-toolbar-btn ${paramsMinimized ? "" : "active"}`}
            onClick={() => setParamsMinimized((current) => !current)}
            aria-pressed={!paramsMinimized}
          >
            Params
          </button>
          <button
            type="button"
            className={`ui-toolbar-btn ${inspectorMinimized ? "" : "active"}`}
            onClick={() => setInspectorMinimized((current) => !current)}
            aria-pressed={!inspectorMinimized}
          >
            Inspector
          </button>
          <button
            type="button"
            className={`ui-toolbar-btn ${presetsMinimized ? "" : "active"}`}
            onClick={() => setPresetsMinimized((current) => !current)}
            aria-pressed={!presetsMinimized}
          >
            Presets
          </button>
          <button
            type="button"
            className={`ui-toolbar-btn ${controlsMinimized ? "" : "active"}`}
            onClick={() => setControlsMinimized((current) => !current)}
            aria-pressed={!controlsMinimized}
          >
            Controls
          </button>
          <button
            type="button"
            className="ui-toolbar-btn ui-toolbar-btn-all"
            onClick={handleToggleAllPanels}
          >
            {allPanelsMinimized ? "Show all" : "Minimize all"}
          </button>
        </div>

        <div className="panel-left-shell">
          <div className="panel-left-stack">
            {explorerMinimized ? (
              <aside className="panel-specs panel-left-card panel-specs-minimal" aria-label="Explorer minimized">
                <button
                  type="button"
                  className="panel-minimal-toggle"
                  onClick={() => setExplorerMinimized(false)}
                  aria-label="Expand explorer"
                  title="Expand explorer"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <rect x="4" y="5" width="16" height="14" rx="1.5" />
                    <path d="M10 5v14" />
                  </svg>
                </button>
              </aside>
            ) : (
              <aside className="panel-specs panel-left-card" aria-label="Explorer">
                <div className="panel-section">
                  <div className="panel-title panel-title-with-controls">
                    <span>Explorer</span>
                    <div className="inspector-actions">
                      <button
                        type="button"
                        className="inspector-action-btn"
                        onClick={() => setExplorerMinimized(true)}
                        aria-label="Minimize explorer"
                        title="Minimize explorer"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M5 11h14v2H5z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="panel-left-card-body panel-left-card-body-explorer">
                    <ExplorerTree
                      selection={state.selection}
                      onSelect={(id, type) => select({ id, type })}
                      showHeader={false}
                    />
                  </div>
                </div>
              </aside>
            )}

            {paramsMinimized ? (
              <aside className="panel-specs panel-left-card panel-specs-minimal" aria-label="Parameters minimized">
                <button
                  type="button"
                  className="panel-minimal-toggle"
                  onClick={() => setParamsMinimized(false)}
                  aria-label="Expand parameters"
                  title="Expand parameters"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <circle cx="12" cy="12" r="3.2" />
                    <path d="M12 4.5v2.1" />
                    <path d="M12 17.4v2.1" />
                    <path d="M4.5 12h2.1" />
                    <path d="M17.4 12h2.1" />
                    <path d="M6.7 6.7 8.2 8.2" />
                    <path d="M15.8 15.8 17.3 17.3" />
                    <path d="M6.7 17.3 8.2 15.8" />
                    <path d="M15.8 8.2 17.3 6.7" />
                  </svg>
                </button>
              </aside>
            ) : (
              <aside className="panel-specs panel-left-card" aria-label="Parameters">
                <div className="panel-section">
                  <div className="panel-title panel-title-with-controls">
                    <span>Parameters</span>
                    <div className="inspector-actions">
                      <button
                        type="button"
                        className="inspector-action-btn"
                        onClick={() => setParamsMinimized(true)}
                        aria-label="Minimize parameters"
                        title="Minimize parameters"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M5 11h14v2H5z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="panel-left-card-body panel-left-card-body-params">
                    <ParamDrawer
                      params={state.params}
                      isOpen={state.ui.drawerOpen}
                      onToggle={toggleDrawer}
                      onParamsChange={updateParams}
                      showHeader={false}
                    />
                  </div>
                </div>
              </aside>
            )}
          </div>
        </div>

        <div />

        <div className="panel-right">
          <div className="panel-right-top" ref={rightTopRef}>
            <div
              className="panel-card-host"
              ref={inspectorHostRef}
              style={inspectorMaxHeight !== null ? { maxHeight: `${inspectorMaxHeight}px` } : undefined}
            >
              <SpecsPanel
                isMinimized={inspectorMinimized}
                onMinimizedChange={setInspectorMinimized}
              />
            </div>
            <PresetsPanel
              activePresetId={activePresetId}
              onApplyPreset={handleApplyPreset}
              onCopyShareLink={handleCopyShareLink}
              forceMinimized={presetsForceMinimized}
              isMinimized={presetsMinimized}
              onMinimizedChange={setPresetsMinimized}
              onExpandedHeightChange={setPresetsExpandedHeight}
            />
          </div>

          <BottomControls
            viewMode={state.viewMode}
            onViewModeChange={setViewMode}
            scrollFlowEnabled={state.ui.scrollFlowEnabled}
            onScrollFlowChange={setScrollFlowEnabled}
            cutawayEnabled={state.ui.cutawayEnabled}
            onCutawayChange={setCutawayEnabled}
            onResetCamera={resetCamera}
            isMinimized={controlsMinimized}
            onMinimizedChange={setControlsMinimized}
          />
        </div>
      </div>
    </>
  );
}
