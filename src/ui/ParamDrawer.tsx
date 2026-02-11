"use client";

import React, { useCallback } from "react";
import { Slider } from "./Slider";
import { Dropdown } from "./Dropdown";
import type { Params, CoolingType, ContainmentType } from "@/state/types";

export interface ParamDrawerProps {
  params: Params;
  isOpen: boolean;
  onToggle: () => void;
  onParamsChange: (patch: Partial<Params>) => void;
}

/** Format large numbers with thousands separator */
function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

function formatCriticalLoad(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} GW`;
  }
  return `${value.toLocaleString("en-US")} MW`;
}

/**
 * Collapsible parameter drawer with sliders and dropdowns.
 * Uses industry-standard data center terminology.
 */
export function ParamDrawer({
  params,
  isOpen,
  onToggle,
  onParamsChange,
}: ParamDrawerProps) {
  const handleSliderChange = useCallback(
    (key: keyof Params) => (value: number) => {
      onParamsChange({ [key]: value });
    },
    [onParamsChange]
  );

  const handleDropdownChange = useCallback(
    (key: keyof Params) => (value: string) => {
      onParamsChange({ [key]: value });
    },
    [onParamsChange]
  );

  return (
    <div className={`param-drawer ${isOpen ? "open" : "closed"}`}>
      <button
        type="button"
        className="param-drawer-header"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls="param-drawer-content"
      >
        <span>PARAMETERS</span>
        <svg
          width="12"
          height="12"
          fill="currentColor"
          viewBox="0 0 10 10"
          className="param-drawer-chevron"
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        >
          <path d="M1 3L5 7L9 3Z" />
        </svg>
      </button>

      <div className="param-drawer-content" id="param-drawer-content">
        {/* Facility-level parameters */}
        <div className="param-section">
          <div className="param-section-title">Facility</div>

          <Slider
            label="Critical IT Load"
            value={params.criticalLoadMW}
            min={0.5}
            max={1000}
            step={0.5}
            formatValue={formatCriticalLoad}
            onChange={handleSliderChange("criticalLoadMW")}
          />

          <Slider
            label="Whitespace Area"
            value={params.whitespaceAreaSqFt}
            min={5000}
            max={200000}
            step={1000}
            unit=" sq ft"
            formatValue={formatNumber}
            onChange={handleSliderChange("whitespaceAreaSqFt")}
          />

          <Slider
            label="Data Halls"
            value={params.dataHalls}
            min={1}
            max={100}
            step={1}
            onChange={handleSliderChange("dataHalls")}
          />

          <Slider
            label="Whitespace Ratio"
            value={params.whitespaceRatio}
            min={0.25}
            max={0.65}
            step={0.05}
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={handleSliderChange("whitespaceRatio")}
          />
        </div>

        {/* IT Equipment parameters */}
        <div className="param-section">
          <div className="param-section-title">IT Equipment</div>

          <Slider
            label="Avg. Rack Density"
            value={params.rackPowerDensity}
            min={3}
            max={80}
            step={1}
            unit=" kW/rack"
            onChange={handleSliderChange("rackPowerDensity")}
          />

          <Dropdown
            label="Power Redundancy"
            value={params.redundancy}
            options={["N", "N+1", "2N"]}
            onChange={handleDropdownChange("redundancy")}
            width={200}
          />
        </div>

        {/* MEP Systems parameters */}
        <div className="param-section">
          <div className="param-section-title">MEP Systems</div>

          <Slider
            label="Target PUE"
            value={params.pue}
            min={1.05}
            max={2.0}
            step={0.05}
            formatValue={(v) => v.toFixed(2)}
            onChange={handleSliderChange("pue")}
          />

          <Dropdown
            label="Cooling Type"
            value={params.coolingType}
            options={["Air-Cooled", "DLC", "Hybrid"] as CoolingType[]}
            onChange={handleDropdownChange("coolingType")}
            width={200}
          />

          <Dropdown
            label="Containment"
            value={params.containment}
            options={["None", "Hot Aisle", "Cold Aisle", "Full Enclosure"] as ContainmentType[]}
            onChange={handleDropdownChange("containment")}
            width={200}
          />
        </div>
      </div>
    </div>
  );
}
