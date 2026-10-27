import "./globals.css";
import type { ReactNode } from "react";
import { Bricolage_Grotesque, Source_Sans_3 } from "next/font/google";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata = {
  title: "E-commerce Data Pipeline",
  description:
    "A bronze, silver, gold data pipeline with automated quality checks and a live sales dashboard.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
