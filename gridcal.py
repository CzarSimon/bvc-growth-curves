#!/usr/bin/env python3
"""
Calibrate the vertical axes from the CHART'S OWN gridlines and tick labels.

Why this replaces anchor-fitting
--------------------------------
Earlier versions fitted pixel->value using published Table 4 values as
anchors. That was backwards. The chart is what BVC actually plots on, so the
chart is the ground truth; the table is an independent reference that may or
may not agree with it. Anchoring to the table made a genuine chart/table
disagreement indistinguishable from a calibration bug.

Gridlines carry the chart's own scale. Pairing each horizontal gridline with
its printed tick value gives a calibration that needs no external data, and
it comes with a self-check that needs none either:

    weight  -> y vs log10(value) must be linear   (if the axis is log)
    length  -> y vs value linear, or piecewise if magnified below ~60 cm
    head    -> y vs value must be linear

An R^2 at 1.0 confirms both the axis type and the calibration, from geometry
alone. Only afterwards do we compare against Table 4 — and any residual
disagreement there is then a real finding about the reference, not a bug.

Usage
    python gridcal.py PCPAL-0-2ar-pojke.pdf --sex male --inspect
    python gridcal.py PCPAL-0-2ar-pojke.pdf --sex male -o boys-curves.json
"""

import argparse
import json
from collections import defaultdict

import numpy as np
import pdfplumber

import extract_growth_curves as X


# --- text recovery -----------------------------------------------------------

def tokens(page, y_tol=2.5, x_gap=3.0):
    """Rebuild numeric labels from raw chars.

    pdfplumber's word grouping splits some axis labels ('60' arrives as '6'
    and '0'), so regroup characters directly: same line, small horizontal gap.
    """
    rows = defaultdict(list)
    for ch in page.chars:
        rows[round(((ch["top"] + ch["bottom"]) / 2) / y_tol)].append(ch)

    out = []
    for _, chs in rows.items():
        chs.sort(key=lambda c: c["x0"])
        cur = [chs[0]]
        for c in chs[1:]:
            if c["x0"] - cur[-1]["x1"] <= x_gap:
                cur.append(c)
            else:
                out.append(_tok(cur)); cur = [c]
        out.append(_tok(cur))
    return [t for t in out if t]


def _tok(chs):
    txt = "".join(c["text"] for c in chs).strip()
    if not txt:
        return None
    return {
        "text": txt,
        "x0": min(c["x0"] for c in chs),
        "x1": max(c["x1"] for c in chs),
        "y": float(np.mean([(c["top"] + c["bottom"]) / 2 for c in chs])),
    }


def numeric(tok):
    t = tok["text"].replace(",", ".")
    try:
        return float(t)
    except ValueError:
        return None


# --- gridlines ---------------------------------------------------------------

def gridlines(page, x_lo, x_hi, min_frac=0.5):
    """Horizontal rules spanning most of the plot width."""
    span = x_hi - x_lo
    out = []
    for ln in page.lines:
        if abs(ln["top"] - ln["bottom"]) > 1.0:
            continue                       # not horizontal
        if (ln["x1"] - ln["x0"]) < min_frac * span:
            continue
        if ln["x1"] < x_lo - 20 or ln["x0"] > x_hi + 20:
            continue                       # outside the main plot
        out.append((ln["top"] + ln["bottom"]) / 2)
    out.sort()
    merged = []
    for y in out:                          # dedupe near-coincident rules
        if not merged or abs(y - merged[-1]) > 1.5:
            merged.append(y)
    return merged


def pair_ticks(grid_ys, toks, x_lo, x_hi, band, expected, y_tol=4.0):
    """Match gridlines to printed tick values inside a panel band."""
    lo, hi = band
    labels = []
    for t in toks:
        v = numeric(t)
        if v is None or int(v) not in expected:
            continue
        if not (lo <= t["y"] <= hi):
            continue
        near_left = t["x1"] < x_lo + 5
        near_right = t["x0"] > x_hi - 20
        if near_left or near_right:
            labels.append((t["y"], float(v)))

    pairs = []
    for gy in grid_ys:
        if not (lo <= gy <= hi):
            continue
        cands = [(abs(gy - ly), v) for ly, v in labels if abs(gy - ly) <= y_tol]
        if cands:
            pairs.append((gy, min(cands)[1]))
    # one value may be printed on both sides; average their gridline matches
    byval = defaultdict(list)
    for gy, v in pairs:
        byval[v].append(gy)
    return sorted((float(np.mean(g)), v) for v, g in byval.items())


# --- fits --------------------------------------------------------------------

def linfit(y, v):
    a, b = np.polyfit(y, v, 1)
    pred = a * np.asarray(y) + b
    ss = np.sum((np.asarray(v) - np.mean(v)) ** 2)
    r2 = 1 - np.sum((pred - v) ** 2) / ss if ss > 0 else float("nan")
    return (lambda yy: a * np.asarray(yy, float) + b), a, b, r2


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--sex", choices=["male", "female"], required=True)
    ap.add_argument("--step", type=float, default=0.5)
    ap.add_argument("--inspect", action="store_true")
    ap.add_argument("-o", "--out")
    a = ap.parse_args()
    sex = a.sex

    EXPECT = {"weight": {2,3,4,5,6,7,8,9,10,12,14,16,18,20},
              "length": {46,48,50,52,54,56,58,60,70,80,90,100},
              "head":   {30,35,40,45,50,55}}

    with pdfplumber.open(a.pdf) as pdf:
        page = pdf.pages[0]
        words = page.extract_words()
        curves = X.main_curves(page)
        groups = X.group_curves(curves)
        xs = np.concatenate([c["pts"][:, 0] for c in curves])
        x_lo, x_hi = xs.min(), xs.max()
        ages_of, _ = X.age_axis(page, words, x_lo, x_hi)
        names = X.identify_panels(groups, ages_of, sex)

        toks = tokens(page)
        grid = gridlines(page, x_lo, x_hi)
        print(f"\nhorizontal gridlines spanning the plot: {len(grid)}")

        centres = [np.mean([c["pts"][-1, 1] for c in g]) for g in groups]
        bands = []
        for i in range(len(groups)):
            top = 0.0 if i == 0 else (centres[i-1] + centres[i]) / 2
            bot = 1e9 if i == len(groups)-1 else (centres[i] + centres[i+1]) / 2
            bands.append((top, bot))

        ages = np.arange(0, 24 + 1e-9, a.step)
        out = {"sex": sex, "ageMonths": ages.round(3).tolist(),
               "calibration": {}, "curves": {}}

        for gi, (group, measure) in enumerate(zip(groups, names)):
            pairs = pair_ticks(grid, toks, x_lo, x_hi, bands[gi], EXPECT[measure])
            print(f"\n{'='*60}\n{measure.upper()}  band={tuple(round(b,1) for b in bands[gi])}")
            print(f"  gridline/label pairs: {len(pairs)}")
            for gy, v in pairs:
                print(f"    y={gy:7.2f}  ->  {v:g}")

            if len(pairs) < 3:
                print("  TOO FEW PAIRS — cannot calibrate from gridlines")
                continue

            ys = np.array([p[0] for p in pairs]); vs = np.array([p[1] for p in pairs])
            f_lin, a_l, b_l, r2_lin = linfit(ys, vs)
            f_log, a_g, b_g, r2_log = linfit(ys, np.log10(vs))
            print(f"  linear fit  R2={r2_lin:.6f}   ({a_l:+.5f} per px)")
            print(f"  log10 fit   R2={r2_log:.6f}   ({a_g:+.6f} per px, "
                  f"{abs(1/a_g):.1f} px/decade)")

            islog = r2_log > r2_lin
            f = f_log if islog else f_lin
            print(f"  -> axis looks {'LOGARITHMIC' if islog else 'LINEAR'}")

            levels = X.label_group(group)
            print("\n  independent check against Table 4 (not used in the fit):")
            worst = 0.0
            for month in X.ANCHORS:
                mean, sd = X.TABLE4[sex][month][measure]
                p = levels[0]
                y = np.interp(month, ages_of(p[:, 0]), p[:, 1])
                got = f(y)
                want = mean
                if islog or measure == "weight":
                    got_k = 10 ** got if islog else got
                    want_k = 10 ** want
                else:
                    got_k, want_k = got, want
                d = (got_k - want_k) / want_k * 100
                worst = max(worst, abs(d))
                print(f"    {month:>2}mo  chart {got_k:8.3f}   table {want_k:8.3f}   {d:+6.2f}%")
            print(f"    worst divergence: {worst:.2f}%")

            cur = {}
            for lvl, path in sorted(levels.items()):
                mo = ages_of(path[:, 0]); vals = f(path[:, 1])
                if islog:
                    vals = 10 ** vals
                o = np.argsort(mo)
                key = "mean" if lvl == 0 else f"{lvl:+d}SD"
                cur[key] = np.interp(ages, mo[o], vals[o]).round(4).tolist()
            out["curves"][measure] = cur
            out["calibration"][measure] = {
                "space": "log10" if islog else "linear",
                "slopePerPixel": float(a_g if islog else a_l),
                "r2": float(max(r2_lin, r2_log)),
                "gridlinePairs": len(pairs),
                "tableDivergencePct": worst,
            }

    if a.out and out["curves"]:
        with open(a.out, "w") as fh:
            json.dump(out, fh, indent=2)
        print(f"\nwrote {a.out}")


if __name__ == "__main__":
    main()
