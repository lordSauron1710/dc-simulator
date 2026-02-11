"use client";

import { useMemo, useState } from "react";
import { computeDataCenter, type HallDescription } from "@/model";
import { useStore, type SelectionType } from "@/state";

type InspectorView = "full" | "key" | "minimal";

function formatPower(valueMW: number): string {
  if (valueMW >= 1000) {
    return `${(valueMW / 1000).toFixed(2)} GW`;
  }
  return `${valueMW.toFixed(2)} MW`;
}

function toTitleCase(value: string | null): string {
  if (!value) return "None";
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function inferHall(
  selectionId: string,
  selectionType: SelectionType,
  halls: HallDescription[]
): string {
  if (selectionType === null) {
    return "Unassigned";
  }

  if (selectionType === "building") {
    return "Facility";
  }

  const numericMatch = selectionId.match(/\d+/);
  if (!numericMatch) {
    return "Unassigned";
  }

  const numericId = Number(numericMatch[0]);
  if (!Number.isFinite(numericId)) {
    return "Unassigned";
  }

  if (selectionType === "hall") {
    const hall = halls.find((entry) => entry.hallIndex === numericId);
    return hall ? `Hall ${hall.hallIndex}` : "Unassigned";
  }

  const hall = halls.find(
    (entry) => numericId >= entry.rackStartIndex && numericId <= entry.rackEndIndex
  );

  return hall ? `Hall ${hall.hallIndex}` : "Unassigned";
}

export function SpecsPanel() {
  const { state } = useStore();
  const { params, selection } = state;
  const [view, setView] = useState<InspectorView>("full");
  const model = useMemo(() => computeDataCenter(params), [params]);

  const totalRacks = model.rackCount;
  const racksPerHall =
    model.hallRackDistribution.length > 0
      ? Math.round(model.rackCount / model.hallRackDistribution.length)
      : 0;
  const totalFacilityMW = model.facilityLoad.totalFacilityMW;
  const overheadMW = model.facilityLoad.nonITOverheadMW;

  const selectionType = toTitleCase(selection.type);
  const selectionName = selection.type ? `${selectionType} ${selection.id}` : "No selection";
  const hallAssignment = inferHall(selection.id, selection.type, model.halls);

  const stepDown = () => {
    setView((current) => {
      if (current === "full") return "key";
      if (current === "key") return "minimal";
      return "minimal";
    });
  };

  const stepUp = () => {
    setView((current) => {
      if (current === "minimal") return "key";
      if (current === "key") return "full";
      return "full";
    });
  };

  if (view === "minimal") {
    return (
      <aside className="panel-specs panel-specs-minimal" aria-label="Inspector minimized">
        <button
          type="button"
          className="panel-minimal-toggle"
          onClick={stepUp}
          aria-label="Expand inspector"
          title="Expand inspector"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M4 5h16v14H4z" />
            <path d="M4 9h16" />
          </svg>
        </button>
      </aside>
    );
  }

  return (
    <aside className={`panel-specs ${view === "key" ? "panel-specs-key" : ""}`}>
      <div className="panel-section">
        <div className="panel-title panel-title-with-controls">
          <span>Inspector</span>
          <div className="inspector-actions">
            <button
              type="button"
              className="inspector-action-btn"
              onClick={stepDown}
              aria-label={
                view === "full" ? "Show key inspector info" : "Minimize inspector completely"
              }
              title={view === "full" ? "Minimize to key info" : "Minimize completely"}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 11h14v2H5z" />
              </svg>
            </button>
            {view === "key" ? (
              <button
                type="button"
                className="inspector-action-btn"
                onClick={stepUp}
                aria-label="Expand inspector fully"
                title="Expand fully"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M11 5h2v14h-2zM5 11h14v2H5z" />
                </svg>
              </button>
            ) : null}
            <span className="inspector-badge">Live</span>
          </div>
        </div>

        <div className="inspector-selection">{selectionName}</div>
        <div className="inspector-caption">
          {formatPower(params.criticalLoadMW)} • PUE {params.pue.toFixed(2)} • {model.halls.length} halls
        </div>

        {view === "key" ? (
          <div className="inspector-key-grid">
            <div className="inspector-key-card">
              <span className="insight-label">Total Racks</span>
              <span className="insight-value">{totalRacks.toLocaleString()}</span>
            </div>
            <div className="inspector-key-card">
              <span className="insight-label">Facility Power</span>
              <span className="insight-value">{formatPower(totalFacilityMW)}</span>
            </div>
            <div className="inspector-key-card">
              <span className="insight-label">Assigned Hall</span>
              <span className="insight-value">{hallAssignment}</span>
            </div>
            <div className="inspector-key-card">
              <span className="insight-label">Rack Density</span>
              <span className="insight-value">{params.rackPowerDensity} kW/rack</span>
            </div>
          </div>
        ) : null}
      </div>

      {view === "full" ? (
        <div className="panel-section">
          <div className="panel-title">
            <span>Capacity Insights</span>
          </div>

          <div className="insight-grid">
            <div className="insight-card">
              <span className="insight-label">Est. Total Racks</span>
              <span className="insight-value">{totalRacks.toLocaleString()}</span>
            </div>

            <div className="insight-card">
              <span className="insight-label">Racks per Hall</span>
              <span className="insight-value">{racksPerHall.toLocaleString()}</span>
            </div>

            <div className="insight-card">
              <span className="insight-label">Total Facility Power</span>
              <span className="insight-value">{formatPower(totalFacilityMW)}</span>
            </div>

            <div className="insight-card">
              <span className="insight-label">Non-IT Overhead</span>
              <span className="insight-value">{formatPower(overheadMW)}</span>
            </div>
          </div>
        </div>
      ) : null}

      {view === "full" ? (
        <div className="panel-section">
          <div className="panel-title">
            <span>Selection Profile</span>
          </div>

          <div className="control-row">
            <span className="text-label">Type</span>
            <span className="inspector-value">{selectionType}</span>
          </div>
          <div className="divider" />

          <div className="control-row">
            <span className="text-label">Assigned Hall</span>
            <span className="inspector-value">{hallAssignment}</span>
          </div>
          <div className="divider" />

          <div className="control-row">
            <span className="text-label">Rack Density</span>
            <span className="inspector-value">{params.rackPowerDensity} kW/rack</span>
          </div>
          <div className="divider" />

          <div className="control-row">
            <span className="text-label">Redundancy</span>
            <span className="inspector-value">{params.redundancy}</span>
          </div>
          <div className="divider" />

          <div className="control-row">
            <span className="text-label">Cooling</span>
            <span className="inspector-value">{params.coolingType}</span>
          </div>
          <div className="divider" />

          <div className="control-row" style={{ marginBottom: 0 }}>
            <span className="text-label">Containment</span>
            <span className="inspector-value">{params.containment}</span>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
