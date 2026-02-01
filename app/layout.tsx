import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DC Simulator",
  description: "Interactive playground to simulate data centers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
