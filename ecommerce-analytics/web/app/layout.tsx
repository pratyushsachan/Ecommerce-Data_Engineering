import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "E-commerce Analytics",
  description: "Sales dashboard built on a data pipeline with quality checks",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
