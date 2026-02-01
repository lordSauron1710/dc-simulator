"use client";

import React, { useState } from "react";
import { Viewport } from "@/scene/Viewport";
import { ExplorerTree } from "@/ui/ExplorerTree";
import { SpecsPanel } from "@/ui/SpecsPanel";
import type { PropertiesState, SpecificationsState } from "@/ui/SpecsPanel";
import { BottomControls } from "@/ui/BottomControls";
import type { ViewMode } from "@/ui/BottomControls";

export default function SandboxPage() {
  const [properties, setProperties] = useState<PropertiesState>({
    x: "1240",
    y: "840",
    w: "600",
    h: "2200",
    angle: "0°",
    r: "0",
  });

  const [specifications, setSpecifications] = useState<SpecificationsState>({
    model: "Blade Server X2",
    power: "2.4 kW",
  });

  const [viewMode, setViewMode] = useState<ViewMode>("orbit");
  const [activeRackId, setActiveRackId] = useState("R-104");

  return (
    <>
      <Viewport />

      <div className="ui-layer">
        <ExplorerTree
          activeRackId={activeRackId}
          onSelect={setActiveRackId}
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
            properties={properties}
            onPropertiesChange={setProperties}
            specifications={specifications}
            onSpecificationsChange={setSpecifications}
          />

          <BottomControls
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onResetCamera={() => {}}
          />
        </div>
      </div>
    </>
  );
}
