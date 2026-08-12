import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/copy";

/**
 * Installed-app metadata. The colours are the brand tile (`--accent`) and the
 * warm page background (`--bg`) from `globals.css`; the icons are generated
 * from `public/logo.svg` with optical corrections per size.
 *
 * `background_color` is the app background `#FAF8F5`, not the `#F5F2EC` the
 * brand handoff lists — that value is the sidebar's surface-sunken, and a
 * splash screen painted in it would not match the screen it hands over to.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description:
      "Barnets vikt, längd och huvudomfång på samma tillväxtkurvor som BVC använder.",
    lang: "sv",
    start_url: "/",
    display: "standalone",
    theme_color: "#1C5C66",
    background_color: "#FAF8F5",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
