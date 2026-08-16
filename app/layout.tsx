import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "stills.",
  description: "photographs rebuilt as walk-around 3D scenes",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <div className="wordmark">stills.</div>
        {children}
      </body>
    </html>
  );
}
