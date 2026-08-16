import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://stills-1hk.pages.dev";
const DESCRIPTION = "photographs rebuilt as walk-around 3D scenes";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "stills.",
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "stills.",
    title: "stills.",
    description: DESCRIPTION,
    url: "/",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "three photographs from stills." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "stills.",
    description: DESCRIPTION,
    images: ["/og.jpg"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
