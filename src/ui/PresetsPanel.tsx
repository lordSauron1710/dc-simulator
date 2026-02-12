"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DATA_CENTER_PRESETS, type PresetId } from "@/state/presets";

export interface PresetsPanelProps {
  activePresetId: PresetId | null;
  onApplyPreset: (presetId: PresetId) => void;
  onCopyShareLink: () => Promise<boolean>;
  forceMinimized?: boolean;
  isMinimized?: boolean;
  onMinimizedChange?: (minimized: boolean) => void;
  onExpandedHeightChange?: (height: number) => void;
}

export function PresetsPanel({
  activePresetId,
  onApplyPreset,
  onCopyShareLink,
  forceMinimized = false,
  isMinimized,
  onMinimizedChange,
  onExpandedHeightChange,
}: PresetsPanelProps) {
  const [internalMinimized, setInternalMinimized] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "error">("idle");
  const panelRef = useRef<HTMLElement | null>(null);
  const manualMinimized = isMinimized ?? internalMinimized;
  const effectiveMinimized = forceMinimized || manualMinimized;

  const setManualMinimized = useCallback(
    (next: boolean) => {
      if (isMinimized === undefined) {
        setInternalMinimized(next);
      }
      onMinimizedChange?.(next);
    },
    [isMinimized, onMinimizedChange]
  );

  const handleCopyShare = useCallback(async () => {
    const copied = await onCopyShareLink();
    setShareStatus(copied ? "copied" : "error");
    window.setTimeout(() => setShareStatus("idle"), 1500);
  }, [onCopyShareLink]);

  useEffect(() => {
    if (!onExpandedHeightChange || effectiveMinimized || !panelRef.current) {
      return;
    }

    const reportHeight = () => {
      if (!panelRef.current) {
        return;
      }
      const height = Math.round(panelRef.current.getBoundingClientRect().height);
      if (height > 0) {
        onExpandedHeightChange(height);
      }
    };

    reportHeight();
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => reportHeight());
    observer.observe(panelRef.current);
    return () => observer.disconnect();
  }, [effectiveMinimized, onExpandedHeightChange]);

  if (effectiveMinimized) {
    return (
      <aside className="panel-specs panel-presets panel-specs-minimal" aria-label="Presets minimized">
        <button
          type="button"
          className="panel-minimal-toggle"
          onClick={() => {
            if (!forceMinimized) {
              setManualMinimized(false);
            }
          }}
          aria-label="Expand presets"
          title={forceMinimized ? "Auto-minimized to fit viewport" : "Expand presets"}
          aria-disabled={forceMinimized}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-3-6 3V5a1 1 0 0 1 1-1z" />
          </svg>
        </button>
      </aside>
    );
  }

  return (
    <aside className="panel-specs panel-presets" aria-label="Presets" ref={panelRef}>
      <div className="panel-section">
        <div className="panel-title panel-title-with-controls">
          <span>Presets</span>
          <div className="inspector-actions">
            <button
              type="button"
              className="inspector-action-btn"
              onClick={() => setManualMinimized(true)}
              aria-label="Minimize presets"
              title="Minimize presets"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 11h14v2H5z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="preset-grid">
          {DATA_CENTER_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`preset-chip ${activePresetId === preset.id ? "active" : ""}`}
              onClick={() => onApplyPreset(preset.id)}
              title={preset.description}
            >
              <span className="preset-chip-label">{preset.label}</span>
              <span className="preset-chip-meta">{preset.description}</span>
            </button>
          ))}
        </div>

        <div className="preset-share-row">
          <button type="button" className="preset-share-btn" onClick={handleCopyShare}>
            Copy Share Link
          </button>
          <span className="preset-share-status">
            {shareStatus === "copied"
              ? "Link copied"
              : shareStatus === "error"
                ? "Copy failed"
                : " "}
          </span>
        </div>
      </div>
    </aside>
  );
}
