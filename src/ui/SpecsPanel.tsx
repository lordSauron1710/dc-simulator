"use client";

import { useStore } from "@/state";

function toTitleCase(value: string | null): string {
  if (!value) return "None";
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function inferHall(selectionId: string, hallCount: number): string {
  const numericMatch = selectionId.match(/\d+/);
  if (!numericMatch || hallCount < 1) {
    return "Unassigned";
  }

  const numericId = Number(numericMatch[0]);
  if (!Number.isFinite(numericId)) {
    return "Unassigned";
  }

  const hallNumber = ((numericId - 1) % hallCount) + 1;
  return `Hall ${hallNumber}`;
}

export function SpecsPanel() {
  const { state } = useStore();
  const { params, selection } = state;
  const safeHallCount = Math.max(1, params.dataHalls);
  const safeRackDensity = Math.max(0.1, params.rackPowerDensity);

  const totalRacks = Math.max(
    1,
    Math.round((params.criticalLoadMW * 1000) / safeRackDensity)
  );
  const racksPerHall = Math.max(1, Math.round(totalRacks / safeHallCount));
  const totalFacilityMW = params.criticalLoadMW * params.pue;
  const overheadMW = Math.max(0, totalFacilityMW - params.criticalLoadMW);

  const selectionType = toTitleCase(selection.type);
  const selectionName = selection.type ? `${selectionType} ${selection.id}` : "No selection";
  const hallAssignment = selection.type ? inferHall(selection.id, safeHallCount) : "Unassigned";

  return (
    <aside className="panel-specs">
      <div className="panel-section">
        <div className="panel-title">
          <span>Inspector</span>
          <span className="inspector-badge">Live</span>
        </div>

        <div className="inspector-selection">{selectionName}</div>
        <div className="inspector-caption">
          {params.criticalLoadMW} MW • PUE {params.pue.toFixed(2)} • {params.dataHalls} halls
        </div>
      </div>

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
            <span className="insight-value">{totalFacilityMW.toFixed(2)} MW</span>
          </div>

          <div className="insight-card">
            <span className="insight-label">Non-IT Overhead</span>
            <span className="insight-value">{overheadMW.toFixed(2)} MW</span>
          </div>
        </div>
      </div>

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
    </aside>
  );
}
