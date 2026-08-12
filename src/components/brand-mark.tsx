import { cn } from "@/lib/cn";

/**
 * The Barntillväxt mark: a growth curve rising and flattening inside a teal
 * tile, with the latest measurement as a filled dot at the leading end. It is
 * the same shape the chart draws all day.
 *
 * Inline rather than an <img> so it inherits no network round-trip and stays
 * crisp at the three sizes it appears at (44 px on the start screens, 30 px in
 * the sidebar). The tile radius is 27 % of the side, matching `logo.svg`; the
 * glyph sits at 62 % of the tile. Do not invert it to a teal glyph on white at
 * these sizes — the stroke is too fine to hold.
 */
export function BrandMark({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      role="img"
      aria-label="Barntillväxt"
      className={cn("flex-none", className)}
    >
      <rect width="512" height="512" rx="140" fill="#1C5C66" />
      <g transform="translate(56.3 56.3) scale(16.633)">
        <path
          d="M3.6 20.2C8.2 20.2 10.8 15.4 12.8 10.6C14.0 7.8 15.2 6.2 16.4 5.4"
          stroke="#FFFFFF"
          strokeWidth="1.7"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="19.4" cy="4.0" r="2" fill="#FFFFFF" />
      </g>
    </svg>
  );
}
