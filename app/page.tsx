"use client";

import { Viewport } from "@/scene/Viewport";
import { ExplorerTree } from "@/ui/ExplorerTree";
import { SpecsPanel } from "@/ui/SpecsPanel";
import { BottomControls } from "@/ui/BottomControls";
import { ParamDrawer } from "@/ui/ParamDrawer";
import { useStore } from "@/state";

export default function SandboxPage() {
  const {
    state,
    select,
    setViewMode,
    setScrollFlowEnabled,
    setQuality,
    resetCamera,
    updateParams,
    toggleDrawer,
  } = useStore();

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
          <SpecsPanel />

          <BottomControls
            viewMode={state.viewMode}
            onViewModeChange={setViewMode}
            scrollFlowEnabled={state.ui.scrollFlowEnabled}
            onScrollFlowChange={setScrollFlowEnabled}
            quality={state.quality}
            onQualityChange={setQuality}
            onResetCamera={resetCamera}
          />
        </div>
      </div>
    </>
  );
}
