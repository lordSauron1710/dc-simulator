"use client";

import React from "react";
import { StoreProvider } from "@/state";

export function Providers({ children }: { children: React.ReactNode }) {
  return <StoreProvider>{children}</StoreProvider>;
}
