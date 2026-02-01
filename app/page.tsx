"use client";

import React from "react";
import { Viewport } from "@/scene/Viewport";
import { ExplorerTree } from "@/ui/ExplorerTree";
import { SpecsPanel } from "@/ui/SpecsPanel";
import type { PropertiesState, SpecificationsState } from "@/ui/SpecsPanel";
import { BottomControls } from "@/ui/BottomControls";
import { useStore } from "@/state";

export default function SandboxPage() {
  const { state, select, setViewMode } = useStore();

  const [properties, setProperties] = React.useState<PropertiesState>({
    x: "1240",
    y: "840",
    w: "600",
    h: "2200",
    angle: "0°",
    r: "0",
  });

  const [specifications, setSpecifications] =
    React.useState<SpecificationsState>({
      model: "Blade Server X2",
      power: "2.4 kW",
    });

  return (
    <>
      <Viewport />

      <div className="ui-layer">
        <ExplorerTree
          selection={state.selection}
          onSelect={(id, type) => select({ id, type })}
        />

        <div />

        <div
          style={{
            gridColumn: "3",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            justifyContent: "space-between",
          }}
        >
          <SpecsPanel
            selection={state.selection}
            properties={properties}
            onPropertiesChange={setProperties}
            specifications={specifications}
            onSpecificationsChange={setSpecifications}
          />

          <BottomControls
            viewMode={state.viewMode}
            onViewModeChange={setViewMode}
            onResetCamera={() => {}}
          />
        </div>
      </div>
    </>
  );
}
