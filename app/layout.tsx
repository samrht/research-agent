import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Research Agent — Paper Analyzer",
  description: "State of the Field reports for academic papers",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
