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
    setQuality,
    resetCamera,
    updateParams,
    toggleDrawer,
  } = useStore();
  const rightTopRef = useRef<HTMLDivElement | null>(null);
  const inspectorHostRef = useRef<HTMLDivElement | null>(null);
  const [presetsForceMinimized, setPresetsForceMinimized] = useState(false);
  const [presetsExpandedHeight, setPresetsExpandedHeight] = useState(280);
  const [inspectorMaxHeight, setInspectorMaxHeight] = useState<number | null>(null);

  const activePresetId = useMemo(() => detectPresetId(state.params), [state.params]);

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
    state.quality,
    state.ui.scrollFlowEnabled,
    state.ui.cutawayEnabled,
  ]);

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
      const inspectorElement = inspectorHost.firstElementChild as HTMLElement | null;
      const inspectorNaturalHeight = inspectorElement
        ? Math.max(inspectorElement.scrollHeight, Math.round(inspectorHost.getBoundingClientRect().height))
        : Math.round(inspectorHost.getBoundingClientRect().height);
      const requiredHeight = inspectorNaturalHeight + stackGap + presetsExpandedHeight;
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
  }, [presetsExpandedHeight, state.selection.id, state.selection.type, state.params, state.ui.drawerOpen]);

  return (
    <>
      <Viewport />

      <div className="ui-layer">
        <div className="panel-left">
          <ExplorerTree
            selection={state.selection}
            onSelect={(id, type) => select({ id, type })}
          />
          <ParamDrawer
            params={state.params}
            isOpen={state.ui.drawerOpen}
            onToggle={toggleDrawer}
            onParamsChange={updateParams}
          />
        </div>

        <div />

        <div className="panel-right">
          <div className="panel-right-top" ref={rightTopRef}>
            <div
              className="panel-card-host"
              ref={inspectorHostRef}
              style={inspectorMaxHeight !== null ? { maxHeight: `${inspectorMaxHeight}px` } : undefined}
            >
              <SpecsPanel />
            </div>
            <PresetsPanel
              activePresetId={activePresetId}
              onApplyPreset={handleApplyPreset}
              onCopyShareLink={handleCopyShareLink}
              forceMinimized={presetsForceMinimized}
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
            quality={state.quality}
            onQualityChange={setQuality}
            onResetCamera={resetCamera}
          />
        </div>
      </div>
    </>
  );
}
