import type { Metadata, Viewport } from "next";
import { Public_Sans, Source_Serif_4 } from "next/font/google";
import { APP_NAME, START } from "@/lib/copy";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-public-sans",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-source-serif",
  display: "swap",
});

const description =
  "Barnets vikt, längd och huvudomfång på samma tillväxtkurvor som BVC använder.";

export const metadata: Metadata = {
  // Absolute URLs for the OG image and canonical links. `icon.svg`,
  // `favicon.ico`, `apple-icon.png` and `opengraph-image.png` sit next to this
  // file and Next picks them up by convention — no manual <link> tags.
  metadataBase: new URL(SITE_URL),
  title: APP_NAME,
  description,
  openGraph: {
    title: APP_NAME,
    description: START.promise,
    locale: "sv_SE",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#1C5C66",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv" className={`${publicSans.variable} ${sourceSerif.variable} h-full`}>
      <body className="flex min-h-full flex-col antialiased">{children}</body>
    </html>
  );
}
