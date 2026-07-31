# Swedish 0-2y growth curve extraction

Goal: extract the SD curves from the official Swedish growth charts at finer
age resolution than the published table offers, for a personal web app that
plots a child's measurements against them.

The published reference (Niklasson & Albertsson-Wikland, BMC Pediatrics
2008;8:8, Table 4) gives anchors only at birth and every 3 months. The
printed chart is drawn from the underlying continuous fit, so its vector
paths carry more detail — that is what we are recovering.

## Files

| file | status |
|---|---|
| `PCPAL-0-2ar-{pojke,flicka}.pdf` | source charts, from endodiab.barnlakarforeningen.se |
| `extract_growth_curves.py` | core extraction: curve grouping, panel ID, age axis. **Trusted.** |
| `calibrate.py` | anchor-fitted calibration. **Known-wrong approach, kept for reference only.** |
| `gridcal.py` | gridline-based calibration. **Intended replacement. NEVER RUN YET.** |
| `{boys,girls}-curves.json` | output of `calibrate.py`. **DO NOT USE.** Its own verdict is NOT usable. |

## Established facts — do not re-derive

- PDFs are vector. Each panel draws **5** curves (-2,-1,M,+1,+2 SD) as
  21-point polylines, not Beziers. The mean is stroked at lw 1.92, others
  0.72. The +/-3SD lines are dashed and live in `page.lines` as fragments;
  they are not needed, since mean and SD determine every level.
- Panel order top to bottom is **weight, length, head**.
- Plot area is x 176..555; the right edge is exactly 24 months (the printed
  tick spacing extrapolates to x=555.1, paths end at 555.5).
- The age axis is compressed: ~31 px/month at birth falling to ~9 by 21
  months. 17 ticks (F,1..12,15,18,21,24); the '24' label is absent and is
  added by trend check.
- The 21 vertices land at roughly 0, 0.61, 1.24, 1.92, 2.66, 3.43 months...
  — four points before 3 months, where the table has none. **This finer
  early-infancy resolution is the entire point of the project.**

## Traps — each of these already produced confident wrong answers

1. **Do not identify panels from the printed titles.** VIKT/LÄNGD/
   HUVUDOMFÅNG sit at coordinates that do not track their own panel.
2. **Do not identify panels from tick-value sets.** They overlap (50 appears
   on two axes) and the age tick row pollutes the match.
   Use the scale-consistency test in `identify_panels()`: for the correct
   measure, pixels-per-data-unit agrees at birth and 24 months. Weight
   matches to 0.2%; wrong assignments are off by 20%+.
3. **Never calibrate by interpolating through the anchor points.**
   `np.interp` through 45 anchors reproduces all of them exactly even when
   they are mutually inconsistent, so in-sample residuals are identically
   zero and prove nothing. This produced a diagnostic that returned +0.00
   everywhere while the calibration was genuinely wrong.
4. **Any validation must either hold data out or use independent geometry.**
   If a check cannot fail, it is not a check.

## Open problem

`calibrate.py` anchors pixel->value to Table 4 values transcribed into
`extract_growth_curves.py`. Results:

    weight  RMS 2.08%   by age 0.54/2.69/0.55/1.97/2.63/1.85/0.64/1.54/3.60
                        by lvl 1.46/1.70/1.86/1.92/1.95  (flat)
    length  RMS 0.78%   fitted break 69.7cm, slope ratio 1.48
    head    RMS 0.55%

Flat across SD levels + structured across ages = the whole curve bundle is
displaced at certain ages, i.e. the anchors disagree with the chart. Not an
age-axis error: residuals are smallest at birth and largest at 24 months,
where weight changes slowly.

Two candidate causes, unresolved:
- **The Table 4 constants are an unverified transcription.** They were typed
  from a source that could not be re-opened (PMC is CAPTCHA-walled). Treat
  them as suspect until checked against the actual paper.
- **Version mismatch.** The chart's own footer cites Niklasson & Karlberg
  1999 and Albertsson-Wikland et al, Acta Paediatr 91:739-754, 2002 — not
  the 2008 paper. Weakly supported, since the 2008 paper's main change was
  birth size and the residuals are smallest at birth.

Also note the length fit predicted `slope_ratio ~5.0` and `break ~60cm`
(from tick spacing: 2cm/tick below 60, 10cm above). It returned 1.48 and
69.7. The prediction failed, so the piecewise model is absorbing something
that is not a scale break.

## Next steps

1. Run `gridcal.py` on both PDFs. It calibrates from the chart's own
   gridlines and tick labels, touching no external data. The self-check is
   R^2 of pixel vs log10(value) across the 2-20kg gridlines: ~0.9999
   confirms both the log axis and the calibration from geometry alone.
2. If R^2 is clean, regenerate both JSONs from `gridcal.py` and discard the
   `calibrate.py` outputs. The Table 4 comparison then becomes diagnostic:
   residual divergence is a fact about the reference, not a bug.
3. Independently verify the Table 4 constants against the paper
   (doi:10.1186/1471-2431-8-8, CC BY). Fix them in
   `extract_growth_curves.py` if wrong.
4. Consider emailing the authors for the actual fitted coefficients —
   aimon.niklasson@vgregion.se, kerstin.albertsson.wikland@gu.se. A reply
   would make all of this reverse-engineering unnecessary.

## Ground rule

The chart is what BVC plots on, so **the chart is ground truth**; the
published table is an independent reference that may or may not agree.
An earlier version had this backwards, which made genuine chart/table
disagreement indistinguishable from a calibration bug.
