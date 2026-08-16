import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "splats.",
  description: "photographs rebuilt as 3D gaussian splats, rendered live",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
