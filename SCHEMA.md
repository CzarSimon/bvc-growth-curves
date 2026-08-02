# `src/data/{boys,girls}-curves.json` — data contract

Swedish 0–2 year growth reference curves, extracted from the official BVC
charts in `docs/reference/`. Everything here is read off the
chart's own vector paths and calibrated against the chart's own gridlines.

If you are an agent building the plotting app: **this file is the contract.
You do not need to read the PDFs or the extraction code.**

## Shape

```jsonc
{
  "sex": "male",                  // or "female"
  "source": { "pdf": …, "chartCitation": …, "method": …, "ageRangeMonths": [0, 24] },
  "measures": {
    "weight": {
      "unit": "kg",
      "distribution": "log10-normal",
      "zscore": "z = (log10(kg) - mu) / sigma",
      "muUnit": "log10(kg)",
      "ageMonths": [0.0, 1.21, 2.42, …, 24.0],   // 21 values
      "mu":        [ … ],                         // 21 values, in muUnit
      "sigma":     [ … ],                         // 21 values, in muUnit
      "curves": {
        "-3SD": [ … ], "-2SD": [ … ], "-1SD": [ … ],
        "median": [ … ],
        "+1SD": [ … ], "+2SD": [ … ], "+3SD": [ … ]   // all in `unit`
      },
      "calibration": { … },     // provenance, see below
      "validation":  { … },     // quality evidence, see below
      "table4DivergencePct": { "0": -4.45, "3": -4.98, … }
    },
    "length": { … },            // unit "cm", distribution "normal"
    "head":   { … }             // unit "cm", distribution "normal"
  }
}
```

Every array in a measure has the same length as that measure's `ageMonths`.
The three measures may in principle carry different age arrays — index into
the one belonging to the measure you are plotting, not a shared global.

## Units and the z-score — read this before computing anything

**The three measures are not distributed the same way.** Use the `distribution`
field; do not assume.

| measure | `unit` | `distribution` | `mu`/`sigma` are in | z-score |
|---|---|---|---|---|
| weight | kg | `log10-normal` | log₁₀(kg) | `z = (log10(kg) - mu) / sigma` |
| length | cm | `normal` | cm | `z = (cm - mu) / sigma` |
| head | cm | `normal` | cm | `z = (cm - mu) / sigma` |

The `zscore` field in each measure states the correct formula as a string.
Prefer branching on `distribution`, and treat an unrecognised value as an error
rather than falling through to the linear case.

Note that all three are *drawn* on logarithmic axes — that is a property of the
chart's ink, not of the distribution. Weight is genuinely log-normal; length and
head are not. Conflating the two is the single easiest way to get this wrong.

Going the other way, to draw an arbitrary centile:

```js
const value = dist === "log10-normal" ? 10 ** (mu + z * sigma) : mu + z * sigma;
```

Percentiles come from the normal CDF of `z` (z = ±2 ≈ the 2.3rd/97.7th
centile). The chart itself is drawn in SD units, not centiles, and Swedish BVC
practice reads it in SD — prefer showing SD, and offer centiles only as a
secondary label.

## Interpolation

`ageMonths` samples every **1.2 months** (24 / 20), uniform in age: 21 vertices
from birth to 24 months. These are the chart's own polyline vertices, not a
resampling. Table 4 publishes only 9 anchors (birth and every 3 months), so this
is 2.3× the age resolution and, in particular, gives you two real points in the
0–3 month gap where the table has nothing.

To evaluate between vertices, interpolate **linearly in `age`**:

- `mu` and `sigma` — interpolate directly. This is what the z-score needs.
- Plotted curves — for exact chart fidelity interpolate `log10(value)`, because
  the chart draws straight segments in pixel space and every axis is
  logarithmic. Interpolating the value directly instead differs by well under
  0.1% and is fine for a screen.

**Do not extrapolate outside 0–24 months.** The chart does not define the curves
there, and weight in particular is steep at both ends. Clamp, or refuse.

## Provenance and quality fields

`calibration`:

| field | meaning |
|---|---|
| `space` | always `log10` — the pixel→value mapping, not the distribution |
| `pxPerDecade` | axis scale (head ≈ 1089, length ≈ 1012, weight ≈ 374) |
| `gridlinePairs` | how many gridline/label pairs the fit used |
| `r2Log`, `r2Linear` | fit quality; log is 1.000000, linear is visibly worse |
| `ticks` | the actual `[y_pixel, value]` pairs, so the fit can be re-derived |

`validation`:

| field | meaning |
|---|---|
| `sd3HeldOutMaxPx`, `sd3HeldOutRmsPx` | **the real check.** `mu`/`sigma` are fitted to the five solid curves only; the chart also draws ±3SD *dashed*, which nothing in the fit touches. These are the max/RMS pixel distances between the predicted ±3SD and where the chart actually drew them. ~0.25 px and ~0.11 px. |
| `sd3PerTrack`, `sd3DashesMatched` | how many dash fragments each predicted track claimed — guards against a track being starved |
| `sdGapCV` | spread of the four inter-curve gaps; ~0.002, i.e. the SD lines really are equidistant |
| `meanAsymmetrySD` | how far the median sits from the midpoint of ±2SD, in SD |
| `curveXSpreadPx` | how well the five curves share x positions |

## `table4DivergencePct` — do not "correct" for this

Percentage difference between the chart's median and Table 4 of Niklasson &
Albertsson-Wikland, BMC Pediatrics 2008;8:8, at each 3-month anchor.

**The chart is ground truth.** It is what Swedish BVC actually plots on, and
these files deliberately reproduce it. The table is a separate publication that
disagrees, mostly at birth and 3 months (weight up to ~5–6%, length ~1.5% at
birth, everything ≤1.4% from 9 months on). The chart cites the 1999/2002
references, not the 2008 paper, and the 2008 paper's headline change was birth
size — so the divergence is probably a version difference. That is unconfirmed.

Two things would close it: verifying the Table 4 constants against the paper
(doi:10.1186/1471-2431-8-8, CC BY) and fixing `TABLE4` in
`extraction/extract_growth_curves.py` if they are wrong — it is diagnostic-only,
so that changes no output — or asking the authors for the fitted coefficients.

The field is recorded so the disagreement stays visible. Do not use it to adjust
the curves.

## Scope

- Term infants, 0–24 months, Swedish reference.
- The **Prematurkurvor** side chart (preterm, gestational weeks 24–40) is a
  different chart on the same page and is **not** extracted here. If the app
  needs preterm curves, that is separate work — do not stretch these.
- No age correction for prematurity is applied. The printed chart tells staff to
  age-correct manually until 40 weeks; if the app offers that, it is your logic,
  not something baked into this data.

## Regenerating

```bash
pip install pdfplumber numpy
python extraction/gridcal.py docs/reference/PCPAL-0-2ar-pojke.pdf \
       --sex male   -o src/data/boys-curves.json
python extraction/gridcal.py docs/reference/PCPAL-0-2ar-flicka.pdf \
       --sex female -o src/data/girls-curves.json
python extraction/verify.py src/data/boys-curves.json src/data/girls-curves.json
```

`gridcal.py` aborts rather than emitting anything if the calibration or the
held-out ±3SD check fails. `verify.py` checks the emitted files independently.
