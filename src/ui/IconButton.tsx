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
    <div
      className={`icon-btn ${isActive ? "active" : ""}`}
      title={title}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
