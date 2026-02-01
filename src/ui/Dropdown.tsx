"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

export interface DropdownProps {
  label?: string;
  value: string;
  options?: string[];
  onChange?: (value: string) => void;
  width?: number;
}

/**
 * Dropdown component with clickable menu.
 * Displays current value and opens a menu on click.
 */
export function Dropdown({
  label,
  value,
  options,
  onChange,
  width = 140,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(() => {
    if (options && options.length > 0) {
      setIsOpen((prev) => !prev);
    }
  }, [options]);

  const handleSelect = useCallback(
    (option: string) => {
      onChange?.(option);
      setIsOpen(false);
    },
    [onChange]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="dropdown-wrapper" ref={dropdownRef}>
      {label && <span className="dropdown-label">{label}</span>}
      <div
        className="dropdown"
        style={{ width: `${width}px` }}
        onClick={handleToggle}
      >
        <span>{value}</span>
        <svg
          width="8"
          height="8"
          fill="currentColor"
          viewBox="0 0 10 10"
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        >
          <path d="M1 3L5 7L9 3Z" />
        </svg>
      </div>
      {isOpen && options && options.length > 0 && (
        <div className="dropdown-menu" style={{ width: `${width}px` }}>
          {options.map((option) => (
            <div
              key={option}
              className={`dropdown-item ${option === value ? "active" : ""}`}
              onClick={() => handleSelect(option)}
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
