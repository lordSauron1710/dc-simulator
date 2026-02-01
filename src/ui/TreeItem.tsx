"use client";

import React, { useState } from "react";

export interface TreeItemProps {
  label: string;
  icon: string;
  level?: number;
  isExpanded?: boolean;
  isActive?: boolean;
  hasChildren?: boolean;
  onClick?: () => void;
}

export function TreeItem({
  label,
  icon,
  level = 0,
  isExpanded = false,
  isActive = false,
  hasChildren = false,
  onClick,
}: TreeItemProps) {
  const [expanded, setExpanded] = useState(isExpanded);

  const handleClick = () => {
    if (hasChildren) {
      setExpanded(!expanded);
    }
    onClick?.();
  };

  return (
    <div
      className={`tree-item ${isActive ? "active" : ""}`}
      onClick={handleClick}
    >
      {hasChildren && (
        <span
          className={`chevron ${expanded ? "expanded" : ""}`}
          style={{ marginLeft: `${level * 12}px` }}
        >
          <svg viewBox="0 0 10 10">
            <path d="M3 2L7 5L3 8Z" />
          </svg>
        </span>
      )}
      {!hasChildren && (
        <span style={{ width: "16px", marginLeft: `${level * 12}px` }} />
      )}
      <span className="tree-icon">{icon}</span>
      <span>{label}</span>
    </div>
  );
}
