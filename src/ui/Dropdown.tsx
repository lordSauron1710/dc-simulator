"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

export interface DropdownProps {
  label?: string;
  value: string;
  options?: string[];
  onChange?: (value: string) => void;
  width?: number | string;
}

function isClippingContainer(element: HTMLElement): boolean {
  const styles = window.getComputedStyle(element);
  const overflowValues = [styles.overflow, styles.overflowX, styles.overflowY];
  return overflowValues.some((value) => /(auto|scroll|hidden|clip)/.test(value));
}

function getVerticalClipBounds(anchor: HTMLElement): { top: number; bottom: number } {
  let top = 0;
  let bottom = window.innerHeight;
  let current: HTMLElement | null = anchor.parentElement;

  while (current) {
    if (isClippingContainer(current)) {
      const bounds = current.getBoundingClientRect();
      top = Math.max(top, bounds.top);
      bottom = Math.min(bottom, bounds.bottom);
    }
    current = current.parentElement;
  }

  return { top, bottom };
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
  width = "100%",
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
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

  useEffect(() => {
    if (!isOpen || !dropdownRef.current || !options || options.length === 0) {
      return;
    }

    const estimateDirection = () => {
      if (!dropdownRef.current) {
        return;
      }

      const wrapperBounds = dropdownRef.current.getBoundingClientRect();
      const clipBounds = getVerticalClipBounds(dropdownRef.current);
      const estimatedOptionHeight = 34;
      const menuPadding = 8;
      const menuGap = 4;
      const estimatedMenuHeight = options.length * estimatedOptionHeight + menuPadding + menuGap;
      const roomBelow = clipBounds.bottom - wrapperBounds.bottom;
      const roomAbove = wrapperBounds.top - clipBounds.top;

      setOpenUpward(roomBelow < estimatedMenuHeight && roomAbove > roomBelow);
    };

    estimateDirection();
    window.addEventListener("resize", estimateDirection);
    window.addEventListener("scroll", estimateDirection, true);

    return () => {
      window.removeEventListener("resize", estimateDirection);
      window.removeEventListener("scroll", estimateDirection, true);
    };
  }, [isOpen, options]);

  const resolvedWidth = typeof width === "number" ? `${width}px` : width;

  return (
    <div className="dropdown-wrapper" ref={dropdownRef}>
      {label && <span className="dropdown-label">{label}</span>}
      <div
        className="dropdown"
        style={{ width: resolvedWidth }}
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
        <div
          className={`dropdown-menu ${openUpward ? "dropdown-menu-up" : ""}`}
          style={{ width: resolvedWidth }}
        >
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
