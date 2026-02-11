"use client";

import React, { useState } from "react";
import { IconButton } from "./IconButton";
import type { RenderQuality } from "@/state";

export type ViewMode = "orbit" | "pan";

export interface BottomControlsProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  scrollFlowEnabled: boolean;
  onScrollFlowChange: (enabled: boolean) => void;
  cutawayEnabled: boolean;
  onCutawayChange: (enabled: boolean) => void;
  quality: RenderQuality;
  onQualityChange: (quality: RenderQuality) => void;
  onResetCamera?: () => void;
}

const QUALITY_LABEL: Record<RenderQuality, string> = {
  performance: "Performance",
  balanced: "Balanced",
  quality: "Quality",
};

const NEXT_QUALITY: Record<RenderQuality, RenderQuality> = {
  performance: "balanced",
  balanced: "quality",
  quality: "performance",
};

export function BottomControls({
  viewMode,
  onViewModeChange,
  scrollFlowEnabled,
  onScrollFlowChange,
  cutawayEnabled,
  onCutawayChange,
  quality,
  onQualityChange,
  onResetCamera,
}: BottomControlsProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  if (isMinimized) {
    return (
      <nav className="controls-bottom controls-bottom-minimal" aria-label="View and camera controls minimized">
        <button
          type="button"
          className="panel-minimal-toggle"
          onClick={() => setIsMinimized(false)}
          aria-label="Expand camera controls"
          title="Expand camera controls"
          data-tooltip="Expand camera controls"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M4 6h5" />
            <path d="M15 6h5" />
            <circle cx="12" cy="6" r="2" />
            <path d="M4 12h9" />
            <path d="M19 12h1" />
            <circle cx="16" cy="12" r="2" />
            <path d="M4 18h1" />
            <path d="M9 18h11" />
            <circle cx="6" cy="18" r="2" />
          </svg>
        </button>
      </nav>
    );
  }

  return (
    <nav className="controls-bottom" aria-label="View and camera controls">
      <IconButton
        title={`Scroll Flow: ${scrollFlowEnabled ? "On" : "Off"} (toggle)`}
        isActive={scrollFlowEnabled}
        onClick={() => onScrollFlowChange(!scrollFlowEnabled)}
      >
        <svg viewBox="0 0 24 24">
          <path d="M12 2l3 3h-2v6h-2V5H9l3-3zm0 20l-3-3h2v-6h2v6h2l-3 3z" />
          <path d="M5 7h2v10H5zM17 7h2v10h-2z" />
        </svg>
      </IconButton>
      <IconButton
        title="Orbit Mode"
        isActive={viewMode === "orbit"}
        onClick={() => onViewModeChange("orbit")}
      >
        <svg viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
          <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" />
        </svg>
      </IconButton>
      <IconButton
        title="Pan Mode"
        isActive={viewMode === "pan"}
        onClick={() => onViewModeChange("pan")}
      >
        <svg viewBox="0 0 24 24">
          <path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z" />
        </svg>
      </IconButton>
      <IconButton title="Reset Camera" onClick={onResetCamera}>
        <svg viewBox="0 0 24 24">
          <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
        </svg>
      </IconButton>
      <div className="controls-bottom-divider" aria-hidden="true" />
      <IconButton
        title={`Cutaway Mode: ${cutawayEnabled ? "On" : "Off"} (toggle)`}
        isActive={cutawayEnabled}
        onClick={() => onCutawayChange(!cutawayEnabled)}
      >
        <svg viewBox="0 0 24 24">
          <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Zm0 2.2 5.6 2.8L12 10.8 6.4 8 12 5.2Zm-6 4.4 5 2.5v6.4l-5-2.5V9.6Zm7 8.9V12l5-2.5v6.4l-5 2.5Z" />
        </svg>
      </IconButton>
      <IconButton
        title={`Render Quality: ${QUALITY_LABEL[quality]} (toggle)`}
        isActive={quality !== "balanced"}
        onClick={() => onQualityChange(NEXT_QUALITY[quality])}
      >
        <svg viewBox="0 0 24 24">
          <path d="M15 21h2v-2h-2v2zm4-12h2V7h-2v2zM3 5v14c0 1.1.9 2 2 2h4v-2H5V5h4V3H5c-1.1 0-2 .9-2 2zm16-2v2h2c0-1.1-.9-2-2-2zm-8 20h2V1h-2v22zm8-6h2v-2h-2v2zM15 5h2V3h-2v2zm4 8h2v-2h-2v2zm0 8c1.1 0 2-.9 2-2h-2v2z" />
        </svg>
      </IconButton>
      <button
        type="button"
        className="inspector-action-btn controls-bottom-collapse"
        onClick={() => setIsMinimized(true)}
        aria-label="Minimize camera controls"
        title="Minimize controls"
        data-tooltip="Minimize controls"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 11h14v2H5z" />
        </svg>
      </button>
    </nav>
  );
}
