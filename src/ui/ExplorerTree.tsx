"use client";

import React, { useMemo } from "react";
import { computeCampusModel, type Campus } from "@/model";
import { TreeItem } from "./TreeItem";
import type { Params, Selection } from "@/state";

export interface ExplorerTreeProps {
  selection: Selection;
  campus?: Campus;
  params?: Params;
  onSelect?: (id: string, type: Selection["type"]) => void;
  showHeader?: boolean;
}

function parseRackIndex(selectionId: string): number | null {
  const match = selectionId.match(/\d+/);
  if (!match) {
    return null;
  }
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ExplorerTree({
  selection,
  campus,
  params,
  onSelect,
  showHeader = true,
}: ExplorerTreeProps) {
  const activeId = selection.id;
  const campusModel = useMemo(() => {
    if (!campus || !params) {
      return null;
    }
    return computeCampusModel(campus, params);
  }, [campus, params]);

  const selectedRackHallId = useMemo(() => {
    if (!campusModel || selection.type !== "rack") {
      return null;
    }
    const rackIndex = parseRackIndex(selection.id);
    if (rackIndex === null) {
      return null;
    }
    const hall = campusModel.halls.find(
      (entry) => rackIndex >= entry.rackStartIndex && rackIndex <= entry.rackEndIndex
    );
    return hall?.id ?? null;
  }, [campusModel, selection.id, selection.type]);

  if (!campusModel) {
    return (
      <aside className={`drawer-left ${showHeader ? "" : "drawer-left-embedded"}`}>
        {showHeader ? <div className="section-header">EXPLORER</div> : null}

        <TreeItem label="Global Campus" icon="🌐" hasChildren isExpanded />
        <TreeItem label="US-East-1" icon="🏢" level={1} hasChildren isExpanded />
        <TreeItem label="Zone A" icon="📍" level={2} hasChildren isExpanded />
        <TreeItem
          label="Rack R-104"
          icon="🔌"
          level={3}
          hasChildren
          isActive={activeId === "R-104"}
          onClick={() => onSelect?.("R-104", "rack")}
        />
        <TreeItem
          label="Rack R-105"
          icon="🔌"
          level={3}
          hasChildren
          isActive={activeId === "R-105"}
          onClick={() => onSelect?.("R-105", "rack")}
        />
      </aside>
    );
  }

  return (
    <aside className={`drawer-left ${showHeader ? "" : "drawer-left-embedded"}`}>
      {showHeader ? <div className="section-header">EXPLORER</div> : null}

      <TreeItem
        label={`${campusModel.explorer.campusName} • ${campusModel.explorer.zoneCount} zones`}
        icon="🌐"
        hasChildren
        isExpanded
        isActive={selection.type === "building"}
        onClick={() => onSelect?.("B-01", "building")}
      />

      {campusModel.explorer.zones.map((zone) => (
        <React.Fragment key={zone.id}>
          <TreeItem
            label={`${zone.name} • ${zone.hallCount} halls • ${zone.rackCount} racks`}
            icon="📍"
            level={1}
            hasChildren={zone.halls.length > 0}
            isExpanded
          />
          {zone.halls.map((hall) => (
            <React.Fragment key={hall.id}>
              <TreeItem
                label={`${hall.name} • ${hall.rackCount}/${hall.rackCapacityBySpace} racks`}
                icon="🏢"
                level={2}
                hasChildren={selectedRackHallId === hall.id}
                isExpanded
                isActive={selection.type === "hall" && activeId === hall.id}
                onClick={() => onSelect?.(hall.id, "hall")}
              />
              {selectedRackHallId === hall.id && selection.type === "rack" ? (
                <TreeItem
                  label={`Rack ${selection.id}`}
                  icon="🔌"
                  level={3}
                  isActive
                  onClick={() => onSelect?.(selection.id, "rack")}
                />
              ) : null}
            </React.Fragment>
          ))}
        </React.Fragment>
      ))}
    </aside>
  );
}
