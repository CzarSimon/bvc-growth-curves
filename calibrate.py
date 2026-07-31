#!/usr/bin/env python3
"""
Calibrate the vertical axes with LOW-PARAMETER models and report honest
residuals, then write the extracted curves.

Why not interpolate through the anchors
---------------------------------------
The previous approach fit pixel->value by running np.interp through all 45
anchor points. That reproduces every anchor exactly no matter how mutually
inconsistent the anchors are, so in-sample residuals are identically zero and
prove nothing. It also overfits: leave-one-out errors were 1.4-4.7%.

Each axis has a known functional form, so fit that instead:

    weight   log10(v) = a*y + b            (2 params; log axis)
    head            v = a*y + b            (2 params; linear axis)
    length          v = piecewise linear   (3 params; magnified below ~60 cm)

45 points against 2-3 parameters leaves plenty of residual degrees of
freedom, so the reported error is a real measure of fit. If the point cloud
is internally inconsistent, the model cannot absorb it and the residual says
so.

Usage
    python calibrate.py PCPAL-0-2ar-pojke.pdf --sex male -o boys-curves.json
"""

import argparse
import json

import numpy as np
import pdfplumber

import extract_growth_curves as X


# --- models ------------------------------------------------------------------

def fit_affine(y, v):
    a, b = np.polyfit(y, v, 1)
    return (lambda yy: a * np.asarray(yy) * 1.0 + b), {"a": a, "b": b}


def fit_piecewise(y, v):
    """Two linear segments meeting at a breakpoint; scan for the best break.

    The length chart magnifies lengths below roughly 60 cm, so pixels-per-cm
    differs above and below that. The breakpoint is fitted, not assumed, so
    where it lands is itself evidence about the chart's construction.
    """
    order = np.argsort(y)
    y, v = np.asarray(y)[order], np.asarray(v)[order]
    best = None
    for i in range(4, len(y) - 4):
        yb = y[i]
        lo, hi = y <= yb, y >= yb
        if lo.sum() < 4 or hi.sum() < 4:
            continue
        a1, b1 = np.polyfit(y[lo], v[lo], 1)
        a2, b2 = np.polyfit(y[hi], v[hi], 1)
        # enforce continuity at the break by averaging the two predictions
        vb = (a1 * yb + b1 + a2 * yb + b2) / 2
        b1c, b2c = vb - a1 * yb, vb - a2 * yb
        pred = np.where(y <= yb, a1 * y + b1c, a2 * y + b2c)
        rss = float(np.sum((pred - v) ** 2))
        if best is None or rss < best[0]:
            best = (rss, yb, a1, b1c, a2, b2c, vb)
    _, yb, a1, b1c, a2, b2c, vb = best

    def f(yy):
        yy = np.asarray(yy, dtype=float)
        return np.where(yy <= yb, a1 * yy + b1c, a2 * yy + b2c)

    return f, {"break_y": yb, "break_value": vb,
               "slope_low_y": a1, "slope_high_y": a2,
               "slope_ratio": abs(a1 / a2) if a2 else float("nan")}


MODEL = {"weight": ("log10", fit_affine),
         "head":   ("linear", fit_affine),
         "length": ("linear", fit_piecewise)}


def sample_points(levels, ages_of, sex, measure):
    """All (pixel_y, value) pairs from 5 curves x 9 anchor ages."""
    ys, vs, tags = [], [], []
    for month in X.ANCHORS:
        mean, sd = X.TABLE4[sex][month][measure]
        for lvl in (-2, -1, 0, 1, 2):
            p = levels[lvl]
            ys.append(np.interp(month, ages_of(p[:, 0]), p[:, 1]))
            vs.append(mean + lvl * sd)      # log10 already, for weight
            tags.append((month, lvl))
    return np.array(ys), np.array(vs), tags


def report(measure, ys, vs, tags, f, params, islog):
    pred = f(ys)
    resid = pred - vs
    if islog:
        rel = (10 ** pred - 10 ** vs) / 10 ** vs * 100
    else:
        rel = resid / vs * 100

    n_par = len(params)
    print(f"\n{'='*62}\n{measure.upper()}   model params: {n_par}, points: {len(ys)}\n{'='*62}")
    for k, val in params.items():
        print(f"  {k:14s} {val:12.5f}")
    print(f"\n  residual  RMS {np.sqrt(np.mean(rel**2)):6.3f}%   "
          f"max {np.max(np.abs(rel)):6.3f}%")

    by_age = {}
    for (m, l), r in zip(tags, rel):
        by_age.setdefault(m, []).append(r)
    print("  by age :", " ".join(f"{m}mo={np.mean(np.abs(v)):.2f}"
                                 for m, v in sorted(by_age.items())))
    by_lvl = {}
    for (m, l), r in zip(tags, rel):
        by_lvl.setdefault(l, []).append(r)
    print("  by lvl :", " ".join(f"{l:+d}={np.mean(np.abs(v)):.2f}"
                                 for l, v in sorted(by_lvl.items())))
    return float(np.sqrt(np.mean(rel ** 2))), float(np.max(np.abs(rel)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--sex", choices=["male", "female"], required=True)
    ap.add_argument("--step", type=float, default=0.5)
    ap.add_argument("-o", "--out")
    a = ap.parse_args()
    sex = a.sex

    with pdfplumber.open(a.pdf) as pdf:
        page = pdf.pages[0]
        words = page.extract_words()
        curves = X.main_curves(page)
        groups = X.group_curves(curves)
        xs = np.concatenate([c["pts"][:, 0] for c in curves])
        ages_of, _ = X.age_axis(page, words, xs.min(), xs.max())
        names = X.identify_panels(groups, ages_of, sex)

        grid = np.arange(0, 24 + 1e-9, a.step)
        out = {"sex": sex, "ageMonths": grid.round(3).tolist(),
               "calibration": {}, "curves": {}}
        ok = True

        for group, measure in zip(groups, names):
            levels = X.label_group(group)
            space, fitter = MODEL[measure]
            islog = (space == "log10")
            ys, vs, tags = sample_points(levels, ages_of, sex, measure)
            f, params = fitter(ys, vs)
            rms, mx = report(measure, ys, vs, tags, f, params, islog)
            if rms > 1.0:
                ok = False

            out["calibration"][measure] = {
                "space": space, "params": {k: float(v) for k, v in params.items()},
                "residualRMSpct": rms, "residualMaxPct": mx,
            }
            cur = {}
            for lvl, path in sorted(levels.items()):
                months = ages_of(path[:, 0])
                vals = f(path[:, 1])
                if islog:
                    vals = 10 ** vals
                o = np.argsort(months)
                key = "mean" if lvl == 0 else f"{lvl:+d}SD"
                cur[key] = np.interp(grid, months[o], vals[o]).round(4).tolist()
            m = np.array(cur["mean"]); p1 = np.array(cur["+1SD"])
            cur["sd"] = ((np.log10(p1) - np.log10(m)) if islog
                         else (p1 - m)).round(5).tolist()
            out["curves"][measure] = cur

    print("\n" + ("-" * 62))
    print("VERDICT:", "usable" if ok else
          "NOT usable — residuals exceed 1% RMS, calibration is wrong")
    if a.out:
        with open(a.out, "w") as fh:
            json.dump(out, fh, indent=2)
        print(f"wrote {a.out}")


if __name__ == "__main__":
    main()
