"use client";

import React from "react";
import { TreeItem } from "./TreeItem";
import type { Selection } from "@/state";

export interface ExplorerTreeProps {
  selection: Selection;
  onSelect?: (id: string, type: Selection["type"]) => void;
  showHeader?: boolean;
}

export function ExplorerTree({
  selection,
  onSelect,
  showHeader = true,
}: ExplorerTreeProps) {
  const activeId = selection.id;

  return (
    <aside className={`drawer-left ${showHeader ? "" : "drawer-left-embedded"}`}>
      {showHeader ? <div className="section-header">EXPLORER</div> : null}

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
