"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  /** Custom value formatter (overrides unit if provided) */
  formatValue?: (value: number) => string;
  onChange: (value: number) => void;
  debounceMs?: number;
}

/**
 * Slider component with debounced updates.
 * Displays label, current value with unit, and a range input.
 */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  unit = "",
  formatValue,
  onChange,
  debounceMs = 150,
}: SliderProps) {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local value when prop changes externally
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback(
    (newValue: number) => {
      setLocalValue(newValue);

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Debounce the onChange callback
      timeoutRef.current = setTimeout(() => {
        onChange(newValue);
      }, debounceMs);
    },
    [onChange, debounceMs]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Use custom formatter if provided, otherwise use unit
  const displayValue = formatValue
    ? formatValue(localValue)
    : unit
    ? `${localValue}${unit}`
    : localValue.toString();

  return (
    <div className="slider-container">
      <div className="slider-header">
        <span className="slider-label">{label}</span>
        <span className="slider-value">{displayValue}</span>
      </div>
      <input
        type="range"
        className="slider-input"
        min={min}
        max={max}
        step={step}
        value={localValue}
        onChange={(e) => handleChange(parseFloat(e.target.value))}
      />
    </div>
  );
}
