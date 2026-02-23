"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Viewport } from "@/scene/Viewport";
import { SpecsPanel } from "@/ui/SpecsPanel";
import { PresetsPanel } from "@/ui/PresetsPanel";
import { BottomControls } from "@/ui/BottomControls";
import { CampusBuilderPanel } from "@/ui/CampusBuilderPanel";
import { CampusParametersPanel, type ParameterFocusRequest } from "@/ui/CampusParametersPanel";
import {
  detectPresetId,
  getPresetById,
  serializeStateToSearch,
  type PresetId,
  useStore,
} from "@/state";

type AuthoringTab = "builder" | "parameters";

export default function SandboxPage() {
  const currentVersion = "v0";
  const {
    state,
    select,
    setViewMode,
    setCutawayEnabled,
    setScrollFlowEnabled,
    resetCamera,
    updateParams,
    updateCampusAndParams,
  } = useStore();
  const rightTopRef = useRef<HTMLDivElement | null>(null);
  const inspectorHostRef = useRef<HTMLDivElement | null>(null);
  const [presetsForceMinimized, setPresetsForceMinimized] = useState(false);
  const [presetsExpandedHeight, setPresetsExpandedHeight] = useState(280);
  const [inspectorMaxHeight, setInspectorMaxHeight] = useState<number | null>(null);
  const [authoringMinimized, setAuthoringMinimized] = useState(false);
  const [authoringTab, setAuthoringTab] = useState<AuthoringTab>("builder");
  const [parameterFocusRequest, setParameterFocusRequest] = useState<ParameterFocusRequest>({
    zoneId: null,
    hallId: null,
    nonce: 0,
  });
  const [inspectorMinimized, setInspectorMinimized] = useState(false);
  const [presetsMinimized, setPresetsMinimized] = useState(false);
  const [controlsMinimized, setControlsMinimized] = useState(false);

  const activePresetId = useMemo(() => detectPresetId(state.params), [state.params]);
  const leftRailMinimized = authoringMinimized;
  const rightRailMinimized = inspectorMinimized && presetsMinimized && controlsMinimized;
  const allPanelsMinimized =
    authoringMinimized &&
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

  const handleToggleAllPanels = useCallback(() => {
    const nextMinimized = !allPanelsMinimized;
    setAuthoringMinimized(nextMinimized);
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
      setAuthoringMinimized(true);
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
      <div
        className="under-construction-banner"
        role="status"
        aria-label="Under construction. v0 is live and v1 is in progress."
      >
        <span aria-hidden="true">👷</span>
        <span>{`Under Construction: ${currentVersion}`}</span>
      </div>

      <div className={uiLayerClassName}>
        <div className="ui-toolbar" role="toolbar" aria-label="Interface visibility controls">
          <button
            type="button"
            className={`ui-toolbar-btn ${!authoringMinimized && authoringTab === "builder" ? "active" : ""}`}
            onClick={() => {
              setAuthoringTab("builder");
              setAuthoringMinimized(false);
            }}
            aria-pressed={!authoringMinimized && authoringTab === "builder"}
          >
            Builder
          </button>
          <button
            type="button"
            className={`ui-toolbar-btn ${!authoringMinimized && authoringTab === "parameters" ? "active" : ""}`}
            onClick={() => {
              setAuthoringTab("parameters");
              setAuthoringMinimized(false);
            }}
            aria-pressed={!authoringMinimized && authoringTab === "parameters"}
          >
            Parameters
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
            {authoringMinimized ? (
              <aside className="panel-specs panel-left-card panel-specs-minimal" aria-label="Authoring workspace minimized">
                <button
                  type="button"
                  className="panel-minimal-toggle"
                  onClick={() => setAuthoringMinimized(false)}
                  aria-label="Expand authoring workspace"
                  title="Expand authoring workspace"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <rect x="4" y="5" width="16" height="14" rx="1.5" />
                    <path d="M10 5v14" />
                  </svg>
                </button>
              </aside>
            ) : (
              <aside className="panel-specs panel-left-card" aria-label="Authoring workspace">
                <div className="panel-section">
                  <div className="panel-title panel-title-with-controls">
                    <span>Authoring Workspace</span>
                    <div className="inspector-actions">
                      <button
                        type="button"
                        className="inspector-action-btn"
                        onClick={() => setAuthoringMinimized(true)}
                        aria-label="Minimize authoring workspace"
                        title="Minimize authoring workspace"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M5 11h14v2H5z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="authoring-tabs" role="tablist" aria-label="Authoring sections">
                    <button
                      type="button"
                      className={`authoring-tab ${authoringTab === "builder" ? "active" : ""}`}
                      onClick={() => setAuthoringTab("builder")}
                      aria-selected={authoringTab === "builder"}
                    >
                      Campus Builder
                    </button>
                    <button
                      type="button"
                      className={`authoring-tab ${authoringTab === "parameters" ? "active" : ""}`}
                      onClick={() => setAuthoringTab("parameters")}
                      aria-selected={authoringTab === "parameters"}
                    >
                      Rack Parameters
                    </button>
                  </div>
                  <div className="panel-left-card-body panel-left-card-body-builder">
                    {authoringTab === "builder" ? (
                      <CampusBuilderPanel
                        campus={state.campus}
                        params={state.params}
                        onCampusChange={updateCampusAndParams}
                        onOpenHallParameters={(zoneId, hallId) => {
                          setAuthoringTab("parameters");
                          setParameterFocusRequest({
                            zoneId,
                            hallId,
                            nonce: Date.now(),
                          });
                        }}
                      />
                    ) : (
                      <CampusParametersPanel
                        campus={state.campus}
                        params={state.params}
                        onCampusChange={updateCampusAndParams}
                        focusRequest={parameterFocusRequest}
                      />
                    )}
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
