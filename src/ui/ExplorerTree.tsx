"use client";

import React from "react";
import { TreeItem } from "./TreeItem";

export interface ExplorerTreeProps {
  activeRackId?: string;
  onSelect?: (id: string) => void;
}

export function ExplorerTree({
  activeRackId = "R-104",
  onSelect,
}: ExplorerTreeProps) {
  return (
    <aside className="drawer-left">
      <div className="section-header">EXPLORER</div>

      <TreeItem
        label="Global Campus"
        icon="🌐"
        hasChildren
        isExpanded
      />

      <TreeItem
        label="US-East-1"
        icon="🏢"
        level={1}
        hasChildren
        isExpanded
      />

      <TreeItem
        label="Zone A"
        icon="📍"
        level={2}
        hasChildren
        isExpanded
      />

      <TreeItem
        label="Rack R-104"
        icon="🔌"
        level={3}
        hasChildren
        isActive={activeRackId === "R-104"}
        onClick={() => onSelect?.("R-104")}
      />

      <TreeItem
        label="Rack R-105"
        icon="🔌"
        level={3}
        hasChildren
        isActive={activeRackId === "R-105"}
        onClick={() => onSelect?.("R-105")}
      />
    </aside>
  );
}
