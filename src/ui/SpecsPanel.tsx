"use client";

import React from "react";
import { InputField } from "./InputField";
import { Dropdown } from "./Dropdown";

export interface PropertiesState {
  x: string;
  y: string;
  w: string;
  h: string;
  angle: string;
  r: string;
}

export interface SpecificationsState {
  model: string;
  power: string;
}

export interface SpecsPanelProps {
  properties: PropertiesState;
  onPropertiesChange: (properties: PropertiesState) => void;
  specifications: SpecificationsState;
  onSpecificationsChange: (specs: SpecificationsState) => void;
}

export function SpecsPanel({
  properties,
  onPropertiesChange,
  specifications,
  onSpecificationsChange,
}: SpecsPanelProps) {
  return (
    <aside className="panel-specs">
      <div className="panel-section">
        <div className="panel-title">
          <span>Properties</span>
          <svg width="12" height="12" fill="#666" viewBox="0 0 24 24">
            <path d="M12 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm0 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm0 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />
          </svg>
        </div>

        <div className="control-row grid">
          <InputField
            label="X"
            value={properties.x}
            onChange={(val) =>
              onPropertiesChange({ ...properties, x: val })
            }
          />
          <InputField
            label="Y"
            value={properties.y}
            onChange={(val) =>
              onPropertiesChange({ ...properties, y: val })
            }
          />
        </div>

        <div className="control-row grid">
          <InputField
            label="W"
            value={properties.w}
            onChange={(val) =>
              onPropertiesChange({ ...properties, w: val })
            }
          />
          <InputField
            label="H"
            value={properties.h}
            onChange={(val) =>
              onPropertiesChange({ ...properties, h: val })
            }
          />
        </div>

        <div className="control-row grid">
          <InputField
            label="∠"
            value={properties.angle}
            onChange={(val) =>
              onPropertiesChange({ ...properties, angle: val })
            }
          />
          <InputField
            label="R"
            value={properties.r}
            onChange={(val) =>
              onPropertiesChange({ ...properties, r: val })
            }
          />
        </div>
      </div>

      <div className="panel-section">
        <div className="panel-title">
          <span>Specifications</span>
          <span style={{ fontSize: "10px", opacity: 0.5 }}>+</span>
        </div>

        <div className="control-row">
          <span className="text-label">Model</span>
          <Dropdown value={specifications.model} />
        </div>

        <div className="control-row">
          <span className="text-label">Power</span>
          <div className="input-group" style={{ width: "140px" }}>
            <input
              type="text"
              className="input-field"
              value={specifications.power}
              onChange={(e) =>
                onSpecificationsChange({
                  ...specifications,
                  power: e.target.value,
                })
              }
              style={{ textAlign: "right" }}
            />
          </div>
        </div>

        <div className="control-row">
          <span className="text-label">Status</span>
          <div className="color-row" style={{ width: "140px" }}>
            <div className="color-well" />
            <span style={{ fontSize: "10px" }}>Operational</span>
            <div style={{ flexGrow: 1 }} />
            <span style={{ opacity: 0.5 }}>100%</span>
          </div>
        </div>
      </div>

      <div className="panel-section">
        <div className="panel-title">
          <span>Thermal</span>
          <svg
            width="10"
            height="10"
            fill="none"
            stroke="#666"
            viewBox="0 0 24 24"
            strokeWidth="2"
          >
            <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </div>
        <div className="control-row">
          <span className="text-label">Intake</span>
          <span style={{ fontFamily: "monospace" }}>22.4°C</span>
        </div>
        <div className="divider" />
        <div className="control-row">
          <span className="text-label">Exhaust</span>
          <span style={{ fontFamily: "monospace" }}>35.1°C</span>
        </div>
      </div>
    </aside>
  );
}
