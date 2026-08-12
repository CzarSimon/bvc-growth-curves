# Fonts

Self-hosted so the build never depends on a third-party CDN. `next/font/google`
downloads its woff2 files during the build, and Google rotates those filenames
without notice — when it renamed Source Serif 4's from `vEFv2_…` to `vEFF2_…`,
a Vercel build restored a cache holding the old URLs, downloaded 404s, and the
production deploy failed to compile. Wired up in `../layout.tsx`.

| file | family | license |
|---|---|---|
| `public-sans-latin.woff2` | [Public Sans](https://fonts.google.com/specimen/Public+Sans) | SIL Open Font License 1.1 |
| `source-serif-4-latin.woff2` | [Source Serif 4](https://fonts.google.com/specimen/Source+Serif+4) | SIL Open Font License 1.1 |

Both are the **`latin` subset** — matching the `subsets: ["latin"]` this
replaced — and both are **variable**, so one file per family covers every weight
the design uses. `→` in `CURVES_CARD.open` is outside the latin subset and
renders from a fallback font, as it did before.

To update, take the `latin` face out of Google's CSS API with a browser user
agent (any other UA gets `.ttf` rather than `woff2`) and download the URL it
names:

```bash
curl -sS -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 \
  (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  "https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600&display=swap"
```

The `latin` face is the last one in the response — its `unicode-range` starts
`U+0000-00FF`. Check the `wght` axis range of anything you download against the
`weight` string in `layout.tsx`.
