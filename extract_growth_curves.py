#!/usr/bin/env python3
"""
Extract SD curves from the Swedish 0-2y growth chart PDFs (PCPAL).

Design notes (learned the hard way from the real file)
------------------------------------------------------
* Each panel draws FIVE curves, not seven: -2SD, -1SD, M, +1SD, +2SD. The
  mean is drawn thicker (lw 1.92 vs 0.72), which identifies it directly.
  The +/-3SD lines are dashed and land in page.lines as hundreds of tiny
  segments; we don't need them, since mean and SD determine everything.

* Panels are NOT identified from titles or tick sets. Both are unreliable
  here: the printed titles sit at coordinates that don't track their own
  panel, and the tick sets overlap (50 appears on two axes). Instead we
  identify panels by physics — for the correct measure, pixels-per-data-unit
  must agree at birth and at 24 months. On the real chart this is decisive:
  weight matches to 0.3%, everything else is off by 20%+.

* The AGE axis is compressed (31 px/month at birth falling to ~10 by 21
  months) and the LENGTH axis is dual-scale (magnified below 60 cm). Neither
  is assumed. Age is interpolated through the printed tick row; the vertical
  axis is fitted to the published Table 4 values, which absorbs whatever
  nonlinearity the chart uses.

* Calibration therefore takes absolute levels from the published table and
  only the SHAPE BETWEEN ANCHORS from the PDF. That is the honest split: the
  extra resolution is what you came for, the absolute values remain those of
  the published reference.

Usage
    pip install pdfplumber numpy
    python extract_growth_curves.py PCPAL-0-2ar-pojke.pdf --sex male -o boys.json
"""

import argparse
import json
import re
import sys
from collections import defaultdict
from itertools import permutations

import numpy as np
import pdfplumber

# Niklasson & Albertsson-Wikland, BMC Pediatrics 2008;8:8, Table 4.
# (mean, SD). Weight is on the log10(kg) scale, as published.
TABLE4 = {
  "male": {
    0:  {"weight": (0.570, 0.053), "length": (51.6, 1.6), "head": (35.8, 1.3)},
    3:  {"weight": (0.798, 0.048), "length": (61.3, 1.8), "head": (41.1, 1.2)},
    6:  {"weight": (0.909, 0.044), "length": (68.1, 2.0), "head": (44.1, 1.2)},
    9:  {"weight": (0.974, 0.042), "length": (72.5, 2.2), "head": (46.0, 1.1)},
    12: {"weight": (1.018, 0.041), "length": (76.1, 2.4), "head": (47.2, 1.3)},
    15: {"weight": (1.053, 0.041), "length": (79.6, 2.6), "head": (48.1, 1.4)},
    18: {"weight": (1.081, 0.041), "length": (82.8, 2.8), "head": (48.9, 1.3)},
    21: {"weight": (1.106, 0.042), "length": (85.7, 2.9), "head": (49.5, 1.3)},
    24: {"weight": (1.128, 0.043), "length": (88.3, 3.1), "head": (50.0, 1.3)},
  },
  "female": {
    0:  {"weight": (0.551, 0.054), "length": (50.8, 1.5), "head": (35.0, 1.3)},
    3:  {"weight": (0.775, 0.048), "length": (60.0, 1.8), "head": (40.1, 1.2)},
    6:  {"weight": (0.884, 0.045), "length": (66.6, 2.0), "head": (43.0, 1.1)},
    9:  {"weight": (0.947, 0.044), "length": (71.0, 2.2), "head": (44.8, 1.1)},
    12: {"weight": (0.991, 0.043), "length": (74.7, 2.4), "head": (46.0, 1.3)},
    15: {"weight": (1.026, 0.043), "length": (78.2, 2.6), "head": (46.9, 1.3)},
    18: {"weight": (1.056, 0.043), "length": (81.5, 2.8), "head": (47.6, 1.4)},
    21: {"weight": (1.082, 0.043), "length": (84.5, 3.0), "head": (48.2, 1.3)},
    24: {"weight": (1.105, 0.042), "length": (87.2, 3.1), "head": (48.7, 1.3)},
  },
}

ANCHORS = [0, 3, 6, 9, 12, 15, 18, 21, 24]
SD_ORDER = [2, 1, 0, -1, -2]     # top of page downwards = high value to low


def _num(t):
    t = t.strip().replace(",", ".")
    return float(t) if re.fullmatch(r"-?\d+(\.\d+)?", t) else None


# --- curves ------------------------------------------------------------------

def main_curves(page, min_pts=15, min_span=0.5):
    """The five-per-panel SD curves spanning the main plot."""
    out = []
    for c in page.curves:
        pts = c.get("pts") or []
        if len(pts) >= min_pts and (c["x1"] - c["x0"]) >= min_span * page.width:
            a = np.array(pts, dtype=float)
            out.append({"pts": a[np.argsort(a[:, 0])],
                        "lw": c.get("linewidth") or 0.0})
    return out


def group_curves(curves, expect=5):
    """Cluster curves into panels by their right-hand endpoint."""
    curves = sorted(curves, key=lambda c: c["pts"][-1, 1])
    ends = np.array([c["pts"][-1, 1] for c in curves])
    gaps = np.diff(ends)
    thr = 3 * np.median(gaps)
    groups, cur = [], [curves[0]]
    for c, g in zip(curves[1:], gaps):
        if g > thr:
            groups.append(cur); cur = [c]
        else:
            cur.append(c)
    groups.append(cur)
    return [g for g in groups if len(g) == expect]


def label_group(group):
    """Assign SD levels. The mean is the thickest stroke; the rest follow by
    vertical order. Falls back to positional order if linewidths are equal."""
    group = sorted(group, key=lambda c: c["pts"][-1, 1])
    lws = [c["lw"] for c in group]
    mid = int(np.argmax(lws)) if max(lws) - min(lws) > 0.3 else len(group) // 2
    if mid != len(group) // 2:
        print(f"  warning: thickest curve at index {mid}, expected "
              f"{len(group)//2} — check panel", file=sys.stderr)
    return {lvl: c["pts"] for lvl, c in zip(SD_ORDER, group)}


# --- axes --------------------------------------------------------------------

def age_axis(page, words, x_lo, x_hi):
    def elig(w):
        t = w["text"].strip()
        xc = (w["x0"] + w["x1"]) / 2
        if not (x_lo - 15 <= xc <= x_hi + 15):
            return None
        if t == "F":
            return (xc, 0.0)
        v = _num(t)
        return (xc, float(v)) if v is not None and 1 <= v <= 24 and float(v).is_integer() else None

    rows = defaultdict(list)
    for w in words:
        e = elig(w)
        if e:
            rows[round(((w["top"] + w["bottom"]) / 2) / 6)].append(e)
    keys = sorted(rows)
    merged, cur = [], list(rows[keys[0]])
    for a, b in zip(keys, keys[1:]):
        (cur.extend(rows[b]) if b - a <= 1 else (merged.append(cur), cur.clear(), cur.extend(rows[b])))
    merged.append(cur)
    cands = sorted(max(merged, key=len))

    # dedupe, enforce monotonicity
    seen, clean = set(), []
    for x, v in cands:
        if v not in seen:
            seen.add(v); clean.append((x, v))
    clean = [c for i, c in enumerate(clean)
             if i == 0 or c[1] > clean[i - 1][1]]

    # The '24' label is often absent from the tick row; the plot's right edge
    # is 24 months by construction. Only add it if the implied spacing
    # continues the axis's decreasing trend rather than contradicting it.
    if clean[-1][1] < 24:
        last_v, last_x = clean[-1][1], clean[-1][0]
        implied = (x_hi - last_x) / (24 - last_v)
        prev = (last_x - clean[-2][0]) / (last_v - clean[-2][1])
        if 0.5 * prev <= implied <= prev * 1.05:
            clean.append((x_hi, 24.0))
            print(f"  age axis: added 24mo tick at x={x_hi:.0f} "
                  f"({implied:.1f} u/mo, prev {prev:.1f}) ", file=sys.stderr)
        else:
            print(f"  age axis: NOT extrapolating to 24mo "
                  f"(implied {implied:.1f} vs prev {prev:.1f})", file=sys.stderr)

    xs = np.array([c[0] for c in clean]); vs = np.array([c[1] for c in clean])
    return lambda x: np.interp(x, xs, vs), len(clean)


def identify_panels(groups, ages_of, sex):
    """Match each panel to a measure by scale consistency.

    For the right measure, pixels-per-data-unit is the same at birth and at
    24 months. For a wrong one it is not, by a wide margin. Length is scored
    but expected to be poor (its axis is deliberately nonlinear below 60 cm),
    so it is effectively assigned by elimination.
    """
    def px_per_sd(group, month, ages):
        lvl = label_group(group)
        vals = []
        for l in (-2, -1, 0, 1, 2):
            p = lvl[l]
            vals.append(np.interp(month, ages(p[:, 0]), p[:, 1]))
        return abs(np.mean(np.diff(sorted(vals))))

    scores = {}
    for gi, g in enumerate(groups):
        s0 = px_per_sd(g, 0, ages_of)
        s24 = px_per_sd(g, 24, ages_of)
        for m in ("weight", "length", "head"):
            sd0 = TABLE4[sex][0][m][1]
            sd24 = TABLE4[sex][24][m][1]
            if not np.isfinite(s0) or not np.isfinite(s24) or s0 <= 0 or s24 <= 0:
                scores[(gi, m)] = np.inf
                print(f"  warning: panel {gi} gave degenerate spacing "
                      f"({s0:.2f}, {s24:.2f}) — check curve grouping",
                      file=sys.stderr)
            else:
                scores[(gi, m)] = abs((s0 / sd0) / (s24 / sd24) - 1)

    best, best_cost = tuple(("weight", "length", "head")), np.inf
    for perm in permutations(("weight", "length", "head")):
        cost = sum(scores[(i, m)] for i, m in enumerate(perm) if m != "length")
        if not np.isfinite(cost):
            continue
        if cost < best_cost:
            best, best_cost = perm, cost

    print("\npanel identification (scale consistency, lower is better):")
    for gi, m in enumerate(best):
        note = "  <- nonlinear axis, assigned by elimination" if m == "length" else ""
        s = scores[(gi, m)]
        shown = "  n/a" if not np.isfinite(s) else f"{s * 100:6.1f}%"
        print(f"  panel {gi} -> {m:7s}  {shown}{note}")
    return list(best)


def fit_y_axis(levels, ages_of, sex, measure, holdout=None):
    """Learn pixel -> value from the published anchors.

    Uses all five curves at all nine anchor ages (45 points), so the fit
    covers the full plotted range rather than extrapolating past the mean
    line. Monotone interpolation, so a nonlinear axis (length) is absorbed
    rather than assumed away.
    """
    pairs = []
    for month in ANCHORS:
        if holdout is not None and month == holdout:
            continue
        mean, sd = TABLE4[sex][month][measure]
        for lvl, path in levels.items():
            y = np.interp(month, ages_of(path[:, 0]), path[:, 1])
            pairs.append((y, mean + lvl * sd))
    pairs.sort()
    ys = np.array([p[0] for p in pairs]); vs = np.array([p[1] for p in pairs])
    order = np.argsort(ys)
    return lambda y: np.interp(y, ys[order], vs[order])


def validate(levels, ages_of, sex, measure):
    """Leave-one-age-out: refit without an anchor, then predict it."""
    worst = 0.0
    for hold in (3, 9, 15, 21):
        f = fit_y_axis(levels, ages_of, sex, measure, holdout=hold)
        mean, sd = TABLE4[sex][hold][measure]
        for lvl in (-2, 0, 2):
            path = levels[lvl]
            y = np.interp(hold, ages_of(path[:, 0]), path[:, 1])
            got, want = f(y), mean + lvl * sd
            if measure == "weight":
                got, want = 10 ** got, 10 ** want
            worst = max(worst, abs(got - want) / want * 100)
    return worst


def run(pdf_path, sex, out_path, step):
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[0]
        words = page.extract_words()
        curves = main_curves(page)
        groups = group_curves(curves)
        if len(groups) != 3:
            raise SystemExit(f"expected 3 panels of 5 curves, got {len(groups)}")

        xs = np.concatenate([c["pts"][:, 0] for c in curves])
        ages_of, ntick = age_axis(page, words, xs.min(), xs.max())
        print(f"age axis: {ntick} ticks over x {xs.min():.0f}..{xs.max():.0f}")

        names = identify_panels(groups, ages_of, sex)

        grid = np.arange(0, 24 + 1e-9, step)
        result = {
            "sex": sex,
            "source": "PCPAL chart paths, levels pinned to Niklasson & "
                      "Albertsson-Wikland 2008 Table 4 (doi:10.1186/1471-2431-8-8)",
            "ageMonths": grid.round(3).tolist(),
            "curves": {},
        }

        print("\nleave-one-age-out validation (worst error at held-out anchors):")
        for group, measure in zip(groups, names):
            levels = label_group(group)
            err = validate(levels, ages_of, sex, measure)
            flag = "ok" if err < 1.0 else "CHECK"
            print(f"  {measure:7s}  {err:5.2f}%   {flag}")

            f = fit_y_axis(levels, ages_of, sex, measure)
            out = {}
            for lvl, path in sorted(levels.items()):
                months = ages_of(path[:, 0])
                vals = f(path[:, 1])
                if measure == "weight":
                    vals = 10 ** vals
                o = np.argsort(months)
                key = "mean" if lvl == 0 else f"{lvl:+d}SD"
                out[key] = np.interp(grid, months[o], vals[o]).round(4).tolist()
            # SD implied by the extracted spacing, at every grid age
            m = np.array(out["mean"]); p1 = np.array(out["+1SD"])
            out["sd"] = (np.log10(p1) - np.log10(m) if measure == "weight"
                         else p1 - m).round(5).tolist()
            result["curves"][measure] = out
            result.setdefault("nativeSamplePoints", {})[measure] = \
                sorted(np.round(ages_of(levels[0][:, 0]), 3).tolist())

    with open(out_path, "w") as fh:
        json.dump(result, fh, indent=2)
    print(f"\nwrote {out_path}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--sex", choices=["male", "female"], required=True)
    ap.add_argument("--step", type=float, default=0.5)
    ap.add_argument("-o", "--out", default="extracted.json")
    a = ap.parse_args()
    run(a.pdf, a.sex, a.out, a.step)


if __name__ == "__main__":
    main()
