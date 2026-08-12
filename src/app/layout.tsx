import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { APP_NAME, START } from "@/lib/copy";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

/*
 * The fonts are self-hosted from `./fonts`, not fetched through
 * `next/font/google`.
 *
 * `next/font/google` resolves the woff2 URLs from Google's CSS at build time
 * and downloads them during the build. Google rotates those filenames without
 * warning — it renamed Source Serif 4's from `vEFv2_…` to `vEFF2_…` — and a
 * build that restores a Turbopack cache holding the old URLs then downloads
 * 404s and fails to compile. That took a production deploy down. Nothing about
 * the build should depend on a third-party CDN keeping a filename stable.
 *
 * Both files are the `latin` subset only, which is what `subsets: ["latin"]`
 * shipped before this: it covers åäö and the punctuation the copy uses. Both
 * are variable fonts, so one file per family covers every weight used — the
 * ranges below are the fonts' own `wght` axes, and CSS `font-weight` picks the
 * instance. To update them, re-download the `latin` woff2 from Google's CSS
 * API. Both are SIL Open Font License 1.1; see `fonts/README.md`.
 */
const publicSans = localFont({
  src: "./fonts/public-sans-latin.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-public-sans",
  display: "swap",
  adjustFontFallback: "Arial",
});

const sourceSerif = localFont({
  src: "./fonts/source-serif-4-latin.woff2",
  weight: "200 900",
  style: "normal",
  variable: "--font-source-serif",
  display: "swap",
  adjustFontFallback: "Times New Roman",
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
