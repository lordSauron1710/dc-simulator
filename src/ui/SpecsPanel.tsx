"use client";

import { useMemo, useState } from "react";
import { computeDataCenter, type HallDescription } from "@/model";
import { useStore, type SelectionType } from "@/state";

type InspectorView = "full" | "key" | "minimal";
type SelectionProfileType = "building" | "hall" | "rack" | "none";

interface SelectionContext {
  profileType: SelectionProfileType;
  selectionName: string;
  caption: string;
  assignedHallLabel: string;
  hall: HallDescription | null;
  rackIndex: number | null;
  rackOrdinalInHall: number | null;
}

interface ProfileRow {
  label: string;
  value: string;
}

function formatPower(valueMW: number): string {
  if (valueMW >= 1000) {
    return `${(valueMW / 1000).toFixed(2)} GW`;
  }
  return `${valueMW.toFixed(2)} MW`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function parseTrailingNumber(value: string): number | null {
  const match = value.match(/\d+/);
  if (!match) {
    return null;
  }

  const numericValue = Number(match[0]);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function findHallBySelection(selectionId: string, selectionType: SelectionType, halls: HallDescription[]) {
  if (selectionType === "hall") {
    const byId = halls.find((hall) => hall.id === selectionId);
    if (byId) {
      return byId;
    }

    const hallIndex = parseTrailingNumber(selectionId);
    if (hallIndex === null) {
      return null;
    }
    return halls.find((hall) => hall.hallIndex === hallIndex) ?? null;
  }

  if (selectionType === "rack") {
    const rackIndex = parseTrailingNumber(selectionId);
    if (rackIndex === null) {
      return null;
    }

    return (
      halls.find(
        (hall) => rackIndex >= hall.rackStartIndex && rackIndex <= hall.rackEndIndex
      ) ?? null
    );
  }

  return null;
}

function resolveSelectionContext(
  selectionId: string,
  selectionType: SelectionType,
  halls: HallDescription[],
  totalRacks: number,
  rackCapacityBySpace: number,
  totalFacilityMW: number,
  nonITOverheadMW: number
): SelectionContext {
  const resolvedHall = findHallBySelection(selectionId, selectionType, halls);
  const rackIndex = selectionType === "rack" ? parseTrailingNumber(selectionId) : null;

  if (selectionType === "building") {
    const headroom = Math.max(0, rackCapacityBySpace - totalRacks);
    const overheadShare =
      totalFacilityMW > 0 ? formatPercent(nonITOverheadMW / totalFacilityMW) : "0.0%";
    return {
      profileType: "building",
      selectionName: "Building B-01",
      caption: `${totalRacks.toLocaleString()} modeled racks • ${headroom.toLocaleString()} rack headroom • ${overheadShare} non-IT share`,
      assignedHallLabel: "Facility",
      hall: null,
      rackIndex: null,
      rackOrdinalInHall: null,
    };
  }

  if (selectionType === "hall" && resolvedHall) {
    const utilization =
      resolvedHall.capacity > 0 ? formatPercent(resolvedHall.rackCount / resolvedHall.capacity) : "0.0%";
    return {
      profileType: "hall",
      selectionName: `Hall ${resolvedHall.hallIndex}`,
      caption: `${resolvedHall.rackCount.toLocaleString()} racks • ${utilization} utilized`,
      assignedHallLabel: `Hall ${resolvedHall.hallIndex}`,
      hall: resolvedHall,
      rackIndex: null,
      rackOrdinalInHall: null,
    };
  }

  if (selectionType === "rack") {
    const hallLabel = resolvedHall ? `Hall ${resolvedHall.hallIndex}` : "Unassigned";
    const rackPosition =
      resolvedHall && rackIndex !== null && resolvedHall.rackStartIndex > 0
        ? rackIndex - resolvedHall.rackStartIndex + 1
        : null;
    const hallUtilization =
      resolvedHall && resolvedHall.capacity > 0
        ? formatPercent(resolvedHall.rackCount / resolvedHall.capacity)
        : "N/A";

    return {
      profileType: "rack",
      selectionName: `Rack ${selectionId}`,
      caption:
        rackPosition && resolvedHall
          ? `${hallLabel} • Position ${rackPosition}/${resolvedHall.rackCount} • ${hallUtilization} utilized`
          : `${hallLabel} • Awaiting hall rack mapping`,
      assignedHallLabel: hallLabel,
      hall: resolvedHall,
      rackIndex,
      rackOrdinalInHall: rackPosition,
    };
  }

  if (selectionType === "hall") {
    const hallIndex = parseTrailingNumber(selectionId);
    return {
      profileType: "hall",
      selectionName: hallIndex !== null ? `Hall ${hallIndex}` : `Hall ${selectionId}`,
      caption: `Hall metadata unavailable • verify hall binding`,
      assignedHallLabel: hallIndex !== null ? `Hall ${hallIndex}` : "Unassigned",
      hall: null,
      rackIndex: null,
      rackOrdinalInHall: null,
    };
  }

  return {
    profileType: "none",
    selectionName: "No selection",
    caption: `Click building, hall, or rack to inspect context-aware KPIs`,
    assignedHallLabel: "Unassigned",
    hall: null,
    rackIndex: null,
    rackOrdinalInHall: null,
  };
}

function buildProfileRows(
  selection: SelectionContext,
  hallCount: number,
  totalRacks: number,
  rackCapacityBySpace: number,
  rackCountFromPower: number,
  totalFacilityMW: number,
  nonITOverheadMW: number
): ProfileRow[] {
  if (selection.profileType === "building") {
    const headroom = Math.max(0, rackCapacityBySpace - totalRacks);
    const averageRacksPerHall = hallCount > 0 ? Math.round(totalRacks / hallCount) : 0;
    const overheadShare =
      totalFacilityMW > 0 ? formatPercent(nonITOverheadMW / totalFacilityMW) : "0.0%";
    return [
      { label: "Type", value: "Building" },
      { label: "Entity ID", value: "B-01" },
      { label: "Modeled Rack Count", value: totalRacks.toLocaleString() },
      { label: "Space Capacity", value: `${rackCapacityBySpace.toLocaleString()} racks` },
      { label: "Power-Limited Racks", value: rackCountFromPower.toLocaleString() },
      { label: "Capacity Headroom", value: `${headroom.toLocaleString()} racks` },
      { label: "Avg Racks per Hall", value: averageRacksPerHall.toLocaleString() },
      { label: "Non-IT Overhead Share", value: overheadShare },
    ];
  }

  if (selection.profileType === "hall" && selection.hall) {
    const hall = selection.hall;
    const utilization = hall.capacity > 0 ? formatPercent(hall.rackCount / hall.capacity) : "0.0%";
    const rowPacking = `${hall.packing.rowCount}/${hall.packing.maxRows}`;
    const rackRange =
      hall.rackStartIndex > 0
        ? `R-${String(hall.rackStartIndex).padStart(4, "0")} to R-${String(hall.rackEndIndex).padStart(4, "0")}`
        : "No racks assigned";
    const avgRacksPerUsedRow =
      hall.packing.rowCount > 0 ? (hall.rackCount / hall.packing.rowCount).toFixed(1) : "0.0";
    return [
      { label: "Type", value: "Hall" },
      { label: "Hall ID", value: hall.id },
      { label: "Rack Range", value: rackRange },
      { label: "Racks Assigned", value: hall.rackCount.toLocaleString() },
      { label: "Hall Capacity", value: hall.capacity.toLocaleString() },
      { label: "Utilization", value: utilization },
      { label: "Rows Used", value: rowPacking },
      { label: "Avg Racks / Used Row", value: avgRacksPerUsedRow },
      { label: "Max Racks / Row", value: hall.packing.maxRacksPerRow.toLocaleString() },
      { label: "Dimensions", value: `${hall.dimensionsFt.width} ft × ${hall.dimensionsFt.length} ft` },
    ];
  }

  if (selection.profileType === "rack") {
    const hallUtilization =
      selection.hall && selection.hall.capacity > 0
        ? formatPercent(selection.hall.rackCount / selection.hall.capacity)
        : "N/A";
    return [
      { label: "Type", value: "Rack" },
      { label: "Rack ID", value: selection.selectionName.replace("Rack ", "") },
      { label: "Assigned Hall", value: selection.assignedHallLabel },
      {
        label: "Rack Position",
        value:
          selection.rackOrdinalInHall && selection.hall
            ? `${selection.rackOrdinalInHall}/${selection.hall.rackCount}`
            : "N/A",
      },
      {
        label: "Hall Rack Range",
        value:
          selection.hall && selection.hall.rackStartIndex > 0
            ? `R-${String(selection.hall.rackStartIndex).padStart(4, "0")} to R-${String(selection.hall.rackEndIndex).padStart(4, "0")}`
            : "N/A",
      },
      { label: "Hall Capacity", value: selection.hall ? selection.hall.capacity.toLocaleString() : "N/A" },
      { label: "Hall Utilization", value: hallUtilization },
      {
        label: "Facility Rack Share",
        value: totalRacks > 0 ? formatPercent(1 / totalRacks) : "N/A",
      },
      {
        label: "Position from Hall Center",
        value:
          selection.rackOrdinalInHall && selection.hall
            ? `${Math.abs(selection.rackOrdinalInHall - Math.ceil(selection.hall.rackCount / 2))} slots`
            : "N/A",
      },
    ];
  }

  return [
    { label: "Type", value: "None" },
    { label: "Assigned Hall", value: "Unassigned" },
    { label: "Modeled Rack Count", value: totalRacks.toLocaleString() },
    { label: "Space Capacity", value: `${rackCapacityBySpace.toLocaleString()} racks` },
    { label: "Capacity Headroom", value: `${Math.max(0, rackCapacityBySpace - totalRacks).toLocaleString()} racks` },
    { label: "Facility Power", value: formatPower(totalFacilityMW) },
    { label: "Non-IT Overhead", value: formatPower(nonITOverheadMW) },
  ];
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

  const selectionContext = useMemo(
    () =>
      resolveSelectionContext(
        selection.id,
        selection.type,
        model.halls,
        model.rackCount,
        model.rackCapacityBySpace,
        model.facilityLoad.totalFacilityMW,
        model.facilityLoad.nonITOverheadMW
      ),
    [
      selection.id,
      selection.type,
      model.halls,
      model.rackCount,
      model.rackCapacityBySpace,
      model.facilityLoad.totalFacilityMW,
      model.facilityLoad.nonITOverheadMW,
    ]
  );

  const profileRows = useMemo(
    () =>
      buildProfileRows(
        selectionContext,
        model.halls.length,
        model.rackCount,
        model.rackCapacityBySpace,
        model.rackCountFromPower,
        model.facilityLoad.totalFacilityMW,
        model.facilityLoad.nonITOverheadMW
      ),
    [
      selectionContext,
      model.halls.length,
      model.rackCount,
      model.rackCapacityBySpace,
      model.rackCountFromPower,
      model.facilityLoad.totalFacilityMW,
      model.facilityLoad.nonITOverheadMW,
    ]
  );

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

        <div className="inspector-selection">{selectionContext.selectionName}</div>
        <div className="inspector-caption">{selectionContext.caption}</div>

        <div className="inspector-key-grid">
          <div className="inspector-key-card">
            <span className="insight-label">Est. Total Racks</span>
            <span className="insight-value">{totalRacks.toLocaleString()}</span>
          </div>
          <div className="inspector-key-card">
            <span className="insight-label">Facility Power</span>
            <span className="insight-value">{formatPower(totalFacilityMW)}</span>
          </div>
          <div className="inspector-key-card">
            <span className="insight-label">Non-IT Overhead</span>
            <span className="insight-value">{formatPower(overheadMW)}</span>
          </div>
          <div className="inspector-key-card">
            <span className="insight-label">Assigned Hall</span>
            <span className="insight-value">{selectionContext.assignedHallLabel}</span>
          </div>
        </div>
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
          {profileRows.map((row, index) => (
            <div key={row.label}>
              <div
                className="control-row"
                style={index === profileRows.length - 1 ? { marginBottom: 0 } : undefined}
              >
                <span className="text-label">{row.label}</span>
                <span className="inspector-value">{row.value}</span>
              </div>
              {index === profileRows.length - 1 ? null : <div className="divider" />}
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
