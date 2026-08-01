# Swedish 0-2y growth curve extraction

Goal: recover the SD curves from the official Swedish growth charts at finer
age resolution than the published table offers, for a personal web app that
plots a child's measurements against them.

**Status: done.** `{boys,girls}-curves.json` are generated, validated against
held-out geometry, and documented in `SCHEMA.md`. That file is the contract for
whoever builds the app; this one is the record of how the data was obtained and
what went wrong on the way.

## Files

| file | status |
|---|---|
| `PCPAL-0-2ar-{pojke,flicka}.pdf` | source charts, from endodiab.barnlakarforeningen.se |
| `extract_growth_curves.py` | extraction primitives: curves, grouping, age axis, panel ID |
| `gridcal.py` | gridline calibration + JSON emit. **The pipeline.** |
| `verify.py` | independent checks on the emitted JSON |
| `SCHEMA.md` | data contract for the app |
| `{boys,girls}-curves.json` | **the deliverable** |
| `calibrate.py` | **deprecated, does not run.** Kept only as the record of the anchor-fitting approach. |

## Established facts

- PDFs are vector. Each bundle draws **5** curves (-2,-1,M,+1,+2 SD) as
  21-point polylines, not Beziers. The mean is stroked at lw 1.92, others
  0.72. The +/-3SD lines are dashed and live in `page.lines` as ~500
  fragments at lw 0.24.
- The chart is **one shared plot area**, not three stacked panels. The three
  bundles are drawn diagonally across the same x 176..555 region and overlap
  heavily in y (head 106..323, length 261..569, weight 452..737).
- Bundle order top to bottom is **head, length, weight**.
- **All three vertical axes are logarithmic**: head 1088.7, length 1011.6,
  weight 374.4 px/decade. log10(value) vs pixel fits at R^2 = 1.000000.
  There is no dual-scale break on the length axis.
- Being drawn on a log axis is not the same as being log-normally
  distributed. **Weight is log-normal** (SD lines equidistant in log10 kg);
  **length and head are normal** (equidistant in cm). This matches how
  Table 4 publishes them. `gridcal.py` measures it rather than assuming.
- The age axis is compressed: ~37 px/month at birth falling to ~11 by 24
  months. 17 ticks (F,1..12,15,18,21,24); the '24' label is absent and is
  added by trend check.
- The 21 vertices are uniform in **age**, every **1.2 months** (24/20). Their
  x gaps shrink from 37.0 to 10.8 px, which is exactly what uniform age
  spacing looks like on a compressed axis. Against Table 4's 9 anchors this
  is 2.3x the resolution, with two real points in the 0-3 month gap where the
  table has none.

## Traps — each of these produced a confident wrong answer

1. **Do not identify panels from the printed titles.** VIKT/LÄNGD/
   HUVUDOMFÅNG sit at coordinates that do not track their own bundle.
2. **Do not identify panels from tick-value sets alone.** They overlap (50
   appears on both the head and length axes, ~410 px apart) and the age tick
   row pollutes the match. `gridcal.consensus_axis()` resolves membership by
   residual against the fitted line instead.
3. **Never calibrate by interpolating through the anchor points.**
   `np.interp` through 45 anchors reproduces all of them exactly even when
   they are mutually inconsistent, so in-sample residuals are identically
   zero and prove nothing.
4. **Any validation must either hold data out or use independent geometry.**
   If a check cannot fail, it is not a check.
5. **Do not compare quantities in different units and call it a test.** The
   old `identify_panels()` scored panels by pixels-per-SD at birth vs at 24
   months, divided by the Table 4 SD. But Table 4 stores weight SDs in log10
   and length/head SDs in cm. On a log axis the head bundle's pixel spacing
   shrinks at almost exactly weight's log-SD ratio (0.813 vs 0.811), so the
   test reported **head as weight and weight as head, at 0.2%**. It passed
   its own check for months. This is trap #4 with a specific mechanism, and
   it is why `identify_panels()` now takes no external data at all.
6. **Check what the page actually looks like.** Two of the wrong "facts"
   above (three stacked panels; weight/length/head order) survived because
   nobody rendered the PDF to an image. Doing so took one command and
   settled both immediately.
7. **Do not infer sample positions from an assumed spacing.** An earlier note
   here recorded the 21 vertices as landing at 0, 0.61, 1.24, 1.92, 2.66,
   3.43 months — "four points before 3 months". Those are the ages you get if
   you assume the vertices are evenly spaced in *pixels* and map them through
   the age axis. The actual x values were never read. They are evenly spaced
   in age, 1.2 months apart.

## How the current pipeline validates itself

- **Calibration.** Gridlines are paired with the tick value printed at each
  rule's own end, inside the plot area only. log10 R^2 must exceed 0.9999 and
  beat the linear fit, on >= 4 pairs, or the run aborts. Actual: 1.000000 on
  all three axes, from 5/9/12 pairs.
- **Panel assignment.** Each bundle must lie inside the y-span of its axis's
  own labelled gridlines: 88.9/83.8/97.7% for head/length/weight against
  <= 42% for every alternative. A margin test aborts if this is not decisive.
- **Held-out check.** `mu`/`sigma` are fitted to the five solid curves. The
  dashed +/-3SD lines are then predicted and compared against where the chart
  actually drew them — ~500 fragments that nothing in the fit touches. Max
  0.25 px, RMS 0.11 px, with all six tracks evenly claimed.

  It rejects real errors, measured by deliberately breaking the model:

  | perturbation | max error | verdict at 1.0 px limit |
  |---|---|---|
  | none | 0.25 px | pass |
  | sigma +1% | 0.77 px | pass (marginal) |
  | sigma +2% | 1.36 px | **rejected** |
  | length/head forced log-normal | 3.14 px | **rejected** |
  | head/weight assignment swapped | 172 px | **rejected**, and starves a track |

## Chart vs Table 4 — an open question about the reference, not a bug

Chart minus table, median curve, percent:

| | 0mo | 3mo | 6mo | 9mo | 12mo | 24mo | worst |
|---|---|---|---|---|---|---|---|
| head ♂ | −0.55 | −0.93 | −0.11 | +0.13 | +0.48 | −0.08 | 0.93% |
| length ♂ | −1.53 | −0.20 | −0.02 | −0.14 | +0.10 | −0.25 | 1.53% |
| weight ♂ | −4.45 | −4.98 | −1.14 | −0.09 | +1.38 | −0.47 | 4.98% |
| head ♀ | +0.01 | −0.94 | −0.23 | +0.14 | +0.32 | −0.00 | 0.94% |
| length ♀ | −1.37 | −0.10 | −0.00 | −0.10 | −0.09 | −0.12 | 1.37% |
| weight ♀ | −3.36 | −5.79 | −1.65 | −0.25 | +0.65 | +0.25 | 5.79% |

The divergence is concentrated at 0-3 months and is <= 1.4% from 9 months on.
Note this is the *inverse* of what `calibrate.py` reported (smallest at birth,
largest at 24 months), which is itself evidence that the old residuals were
the head/weight swap rather than a real disagreement.

Candidate causes, still unresolved:

- **Version mismatch.** The chart's footer cites Niklasson & Karlberg 1999 and
  Albertsson-Wikland et al, Acta Paediatr 91:739-754, 2002 — not the 2008
  paper the constants came from. The 2008 paper's main change was birth size,
  and the residual is now birth-concentrated, which fits. This hypothesis was
  previously rated "weakly supported" on the grounds that residuals were
  smallest at birth; that reasoning was based on the swapped calibration and
  no longer applies.
- **The Table 4 constants are an unverified transcription**, typed from a
  source that could not be re-opened (PMC is CAPTCHA-walled).
- **Age-axis error at the left edge.** Weight diverges *more* at 3 months than
  at birth, and weight is steepest exactly where the age axis is most
  compressed. Not ruled out.

None of this blocks the app: the chart is what BVC plots on, and the JSON
reproduces the chart.

## If someone wants to close the loop

1. Verify the Table 4 constants against the paper (doi:10.1186/1471-2431-8-8,
   CC BY) and fix `TABLE4` in `extract_growth_curves.py` if wrong. It is
   diagnostic-only now, so this changes no output.
2. Consider emailing the authors for the actual fitted coefficients —
   aimon.niklasson@vgregion.se, kerstin.albertsson.wikland@gu.se.
3. Extract the Prematurkurvor side chart if preterm support is ever wanted.
   It is a separate chart on the same page and is deliberately excluded.

## Ground rule

The chart is what BVC plots on, so **the chart is ground truth**; the
published table is an independent reference that may or may not agree.
An earlier version had this backwards, which made genuine chart/table
disagreement indistinguishable from a calibration bug.
