#!/usr/bin/env python3
"""
Extraction primitives for the Swedish 0-2y growth chart PDFs (PCPAL).

This module is a LIBRARY: it recovers curves, groups them into bundles,
reads the age axis and assigns SD levels. It does not calibrate. Run
`gridcal.py`, which calibrates from the chart's own gridlines and writes
the JSON.

Design notes (learned the hard way from the real file)
------------------------------------------------------
* Each bundle draws FIVE curves, not seven: -2SD, -1SD, M, +1SD, +2SD. The
  mean is drawn thicker (lw 1.92 vs 0.72), which identifies it directly.
  The +/-3SD lines are dashed and land in page.lines as hundreds of tiny
  segments. Nothing in this module uses them, which is precisely why
  gridcal.py can use them as a held-out validation set.

* The chart is ONE shared plot area, not three stacked panels. All three
  bundles are drawn diagonally across the same x 176..555 region and they
  overlap heavily in y (head 106..323, length 261..569, weight 452..737).
  Do not try to separate them by y band; there is no such band.

* Bundle order top to bottom is HEAD, LENGTH, WEIGHT. An earlier version of
  this file recorded weight/length/head as an established fact. It was
  backwards. See identify_panels() for how that happened.

* ALL THREE vertical axes are logarithmic (head 1089, length 1012, weight
  374 px/decade): log10(value) vs pixel is linear to R^2 = 1.000000. The
  length axis has NO dual-scale break at 60 cm. An earlier piecewise fit
  that "found" a break at 69.7 cm was absorbing the unmodelled log.

* Being drawn on a log axis is not the same as being log-normally
  distributed. Weight is log-normal (SD lines equidistant in log10 kg);
  length and head are normal (equidistant in cm). gridcal.py measures this
  rather than assuming it.

* The AGE axis is compressed (31 px/month at birth falling to ~10 by 21
  months) and is interpolated through the printed tick row, not modelled.

Usage
    pip install pdfplumber numpy
    python gridcal.py PCPAL-0-2ar-pojke.pdf --sex male -o boys-curves.json
"""

import re
import sys
from collections import defaultdict
from itertools import permutations

import numpy as np

# Niklasson & Albertsson-Wikland, BMC Pediatrics 2008;8:8, Table 4.
# (mean, SD). Weight is on the log10(kg) scale, as published; length and head
# are in cm. That unit split is what broke the old identify_panels().
#
# DIAGNOSTIC ONLY. Nothing in the calibration path may read this. The chart is
# ground truth; this table is an independent reference we report divergence
# against. It is also an unverified transcription (see HANDOFF.md).
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


def identify_panels(groups, axes, ages_of):
    """Match each curve bundle to a measure using the chart's own geometry.

    NOTE ON THE PREVIOUS VERSION. This used to score panels by "scale
    consistency": pixels-per-SD at birth vs at 24 months, divided by the
    TABLE4 SD at those ages. That test was wrong and confidently so — it
    reported the WRONG answer at 0.2%. TABLE4 stores weight SDs in log10
    units and length/head SDs in centimetres, so the ratio compared
    incompatible units. On a log axis the head bundle's pixel spacing
    happens to shrink at almost exactly weight's log-SD ratio (0.813 vs
    0.811), so head was identified as weight and vice versa. It is the
    canonical example of trap #4: a check that cannot fail is not a check.

    The replacement uses no external data at all.

    Primary test — GRIDLINE-SPAN OVERLAP. Each measure's axis is defined by
    its own labelled gridlines, which cover a known y-range. A bundle drawn
    against that axis must lie in that range. This is decisive: the correct
    measure scores 84-98% overlap, the alternatives ~0%.

    Corroborating test — SD EQUIDISTANCE. The five curves are +/-2, +/-1 and
    M, so once mapped through the right axis their four gaps must be equal.
    Reported per measure, but NOT used to choose: the head and length axes
    have similar px/decade (1089 vs 1012), so swapping them barely changes
    equidistance and the test cannot separate them on its own. It is a
    sanity floor, not a discriminator, and it is labelled as such below.

    The real out-of-sample check on this assignment is the +/-3SD dashed
    lines, which nothing here touches — see gridcal.check_3sd().
    """
    measures = ("weight", "length", "head")

    def extent(group):
        ys = np.concatenate([c["pts"][:, 1] for c in group])
        return float(ys.min()), float(ys.max())

    overlap = {}
    for gi, g in enumerate(groups):
        lo, hi = extent(g)
        for m in measures:
            s0, s1 = axes[m]["span"]
            overlap[(gi, m)] = max(0.0, min(hi, s1) - max(lo, s0)) / (hi - lo)

    best, best_score = None, -np.inf
    for perm in permutations(measures):
        score = sum(overlap[(i, m)] for i, m in enumerate(perm))
        if score > best_score:
            best, best_score = perm, score

    print("\npanel identification (gridline-span overlap, higher is better):")
    for gi, m in enumerate(best):
        others = " ".join(f"{o}:{overlap[(gi, o)] * 100:.0f}%"
                          for o in measures if o != m)
        print(f"  bundle {gi} -> {m:7s} {overlap[(gi, m)] * 100:5.1f}%   "
              f"(rejected: {others})")

    # The margin is what makes this decisive; assert it rather than assume it.
    for gi, m in enumerate(best):
        rival = max(overlap[(gi, o)] for o in measures if o != m)
        if overlap[(gi, m)] < 0.60 or rival > 0.50:
            raise SystemExit(
                f"panel identification is not decisive for bundle {gi}: "
                f"{m} scores {overlap[(gi, m)]:.2f} against a rival at "
                f"{rival:.2f}. Refusing to guess.")

    print("  corroboration — SD-gap CV in each measure's own space "
          "(floor check only, cannot separate head from length):")
    for gi, m in enumerate(best):
        cv, space = sd_gap_cv(groups[gi], axes[m], ages_of)
        flag = "ok" if cv < 0.02 else "CHECK"
        print(f"    {m:7s} CV={cv:.4f} in {space:6s} {flag}")
        if cv >= 0.05:
            raise SystemExit(
                f"{m}: SD lines are not equidistant under this axis "
                f"(CV {cv:.3f}) — assignment or calibration is wrong.")

    return list(best)


def sd_gap_cv(group, axis, ages_of, months=(0, 6, 12, 18, 24)):
    """Coefficient of variation of the four inter-curve gaps.

    Tries both linear and log10 space and returns the better one, so the
    distribution space is measured rather than assumed.
    """
    levels = label_group(group)
    per_space = {}
    for space in ("linear", "log10"):
        cvs = []
        for month in months:
            vals = []
            for lvl in (-2, -1, 0, 1, 2):
                p = levels[lvl]
                y = np.interp(month, ages_of(p[:, 0]), p[:, 1])
                vals.append(axis["value"](y))
            v = np.sort(np.asarray(vals, float))
            if space == "log10":
                v = np.log10(v)
            gaps = np.diff(v)
            cvs.append(np.std(gaps) / np.mean(gaps))
        per_space[space] = float(np.mean(cvs))
    space = min(per_space, key=per_space.get)
    return per_space[space], space
