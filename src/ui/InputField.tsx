"use client";

import React from "react";

export interface InputFieldProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
}

export function InputField({ label, value, onChange }: InputFieldProps) {
  return (
    <div className="input-group">
      <label>{label}</label>
      <input
        type="text"
        className="input-field"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </div>
  );
}
