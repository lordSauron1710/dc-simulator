"use client";

import React from "react";

/**
 * Placeholder viewport: dark canvas, CSS 3D scene with grid floor and rack cluster.
 * Will be replaced by Three.js renderer in Prompt 06.
 */
export function Viewport() {
  return (
    <div className="viewport">
      <div className="scene">
        <div className="grid-floor" />
        <div className="rack-cluster">
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="rack" />
          ))}
        </div>
      </div>
    </div>
  );
}
