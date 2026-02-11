"use client";

import React from "react";

export interface IconButtonProps {
  children: React.ReactNode;
  title?: string;
  isActive?: boolean;
  onClick?: () => void;
}

export function IconButton({
  children,
  title,
  isActive = false,
  onClick,
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-btn ${isActive ? "active" : ""}`}
      title={title}
      aria-label={title}
      data-tooltip={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
