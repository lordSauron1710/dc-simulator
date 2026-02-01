"use client";

import React from "react";

export interface DropdownProps {
  value: string;
  options?: string[];
  onChange?: (value: string) => void;
  width?: number;
}

export function Dropdown({
  value,
  width = 140,
}: DropdownProps) {
  return (
    <div className="dropdown" style={{ width: `${width}px` }}>
      <span>{value}</span>
      <svg width="8" height="8" fill="currentColor" viewBox="0 0 10 10">
        <path d="M1 3L5 7L9 3Z" />
      </svg>
    </div>
  );
}
