#!/usr/bin/env python3
"""
Calibrate the Swedish 0-2y growth chart from the CHART'S OWN gridlines, and
emit the SD curves as JSON.

Why the chart and not the table
-------------------------------
The chart is what BVC actually plots on, so the chart is ground truth. The
published Table 4 is an independent reference that may or may not agree.
Earlier versions anchored pixel->value to Table 4, which made a genuine
chart/table disagreement indistinguishable from a calibration bug.

Gridlines carry the chart's own scale. Pairing each horizontal rule with the
tick value printed at its own end gives a calibration that needs no external
data, and a self-check that needs none either: pixel vs log10(value) must be
linear. It comes out at R^2 = 1.000000 on all three axes.

What the chart actually looks like (verified by rendering it)
-------------------------------------------------------------
* ONE shared plot area, not three stacked panels. The head, length and
  weight bundles are drawn diagonally across the same region and overlap
  heavily in y. Splitting the page into y bands per panel does not work and
  was why this script previously calibrated zero panels.
* Bundle order top to bottom is HEAD, LENGTH, WEIGHT.
* All three axes are logarithmic, at different scales: head 1089, length
  1012, weight 374 px/decade. Length has no dual-scale break at 60 cm.
* Most gridlines are labelled at the gridline's OWN end, often mid-plot,
  not at the plot margin. Anything hunting for labels at the left margin
  also swallows the "Prematurkurvor" side chart at x0~19, which is a
  different chart entirely.

Validation
----------
The +/-3SD lines are drawn dashed and nothing in the fit touches them, so
they are a genuine held-out check: predict them from the fitted mu/sigma and
compare against where the chart actually drew them. See check_3sd(). Table 4
is reported afterwards as a diagnostic, never used as an input.

Usage
    python gridcal.py PCPAL-0-2ar-pojke.pdf  --sex male   -o boys-curves.json
    python gridcal.py PCPAL-0-2ar-flicka.pdf --sex female -o girls-curves.json
"""

import argparse
import json
from collections import defaultdict

import numpy as np
import pdfplumber

import extract_growth_curves as X

# Tick values printed on each axis. Only a seed for the consensus fit below:
# 50 appears on both the head and length axes, so membership is decided by
# residual against the fitted line, not by the value alone.
TICKS = {
    "weight": {2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20},
    "length": {46, 48, 50, 52, 54, 56, 58, 60, 70, 80, 90, 100},
    "head":   {30, 35, 40, 45, 50, 55},
}

MEASURES = ("weight", "length", "head")
SD_LEVELS = (-3, -2, -1, 0, 1, 2, 3)

MIN_R2_LOG = 0.9999      # the calibration gate
MIN_PAIRS = 4            # below this a "fit" is not a fit

# Held-out tolerance against the dashed +/-3SD lines. The correct model lands
# at 0.25 px, so this leaves 4x headroom while still rejecting real errors.
# Measured by deliberately breaking the model (see HANDOFF.md):
#   sigma +1%                     0.77 px
#   sigma +2%                     1.36 px  -> rejected
#   length/head forced log-normal 3.14 px  -> rejected
#   head/weight assignment swapped  172 px  -> rejected, and starves a track
MAX_3SD_ERR_PX = 1.0


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

def rules(page, x_lo, x_hi, min_len=40.0, pad=10.0):
    """Horizontal rules lying INSIDE the main plot area.

    Requiring containment (not just overlap) is what keeps the Prematurkurvon
    side chart out. Length threshold is deliberately low: many gridlines here
    are short, so the old ">= 50% of page width" filter discarded most of them.
    """
    out = []
    for ln in page.lines:
        if abs(ln["top"] - ln["bottom"]) > 1.0:
            continue                                  # not horizontal
        if (ln["x1"] - ln["x0"]) < min_len:
            continue
        if ln["x0"] < x_lo - pad or ln["x1"] > x_hi + pad:
            continue                                  # outside the main plot
        out.append(((ln["top"] + ln["bottom"]) / 2, ln["x0"], ln["x1"]))
    return sorted(out)


def pair_rules(page, x_lo, x_hi, y_tol=4.0, x_gap=14.0):
    """Pair each rule with the numeric label drawn at its own end.

    This is the chart's actual convention: a gridline carries its value just
    off its left end or just off its right end, wherever that happens to fall
    on the page.
    """
    toks = [t for t in tokens(page) if numeric(t) is not None]
    found = {}
    for gy, gx0, gx1 in rules(page, x_lo, x_hi):
        for t in toks:
            if abs(t["y"] - gy) > y_tol:
                continue
            v = numeric(t)
            if v != int(v):
                continue
            at_left = 0 <= gx0 - t["x1"] <= x_gap
            at_right = 0 <= t["x0"] - gx1 <= x_gap
            if at_left or at_right:
                found[(round(gy, 1), int(v))] = None
    return sorted(found)


def consensus_axis(pairs, want, tol_px=1.2):
    """Largest set of pairs consistent with a single log10-linear axis.

    Values shared between two axes (50 is on both head and length, ~410 px
    apart) fall out on residual. Ties break on tightness, not on order.
    """
    cands = [(y, v) for y, v in pairs if v in want]
    best, best_res = [], np.inf
    for i in range(len(cands)):
        for j in range(i + 1, len(cands)):
            (y1, v1), (y2, v2) = cands[i], cands[j]
            if y1 == y2 or v1 == v2:
                continue
            a = (np.log10(v2) - np.log10(v1)) / (y2 - y1)
            b = np.log10(v1) - a * y1
            inl = [(y, v) for y, v in cands
                   if abs((a * y + b) - np.log10(v)) / abs(a) <= tol_px]
            if len(inl) < 2:
                continue
            res = float(np.mean([abs((a * y + b) - np.log10(v)) / abs(a)
                                 for y, v in inl]))
            if len(inl) > len(best) or (len(inl) == len(best) and res < best_res):
                best, best_res = inl, res
    return sorted(best)


def linfit(y, v):
    a, b = np.polyfit(y, v, 1)
    pred = a * np.asarray(y) + b
    ss = np.sum((np.asarray(v) - np.mean(v)) ** 2)
    r2 = 1 - np.sum((pred - v) ** 2) / ss if ss > 0 else float("nan")
    return float(r2), float(a), float(b)


def build_axes(page, x_lo, x_hi):
    """Fit pixel -> value for each measure from gridlines alone."""
    pairs = pair_rules(page, x_lo, x_hi)
    print(f"\ngridline/label pairs recovered inside the plot: {len(pairs)}")

    axes = {}
    for m in MEASURES:
        inl = consensus_axis(pairs, TICKS[m])
        if len(inl) < MIN_PAIRS:
            raise SystemExit(f"{m}: only {len(inl)} gridline pairs, need "
                             f"{MIN_PAIRS}. Refusing to calibrate.")
        ys = np.array([p[0] for p in inl], float)
        vs = np.array([p[1] for p in inl], float)
        r2_lin, _, _ = linfit(ys, vs)
        r2_log, a, b = linfit(ys, np.log10(vs))

        print(f"\n{'=' * 62}\n{m.upper()}   {len(inl)} gridline/label pairs")
        for y, v in inl:
            print(f"    y={y:7.2f}  ->  {v:g}")
        print(f"  linear fit  R2={r2_lin:.6f}")
        print(f"  log10 fit   R2={r2_log:.6f}   ({abs(1 / a):.1f} px/decade)")

        if r2_log < MIN_R2_LOG:
            raise SystemExit(f"{m}: log10 R2 {r2_log:.6f} < {MIN_R2_LOG}. "
                             f"The axis is not what we think it is.")
        if r2_log <= r2_lin:
            raise SystemExit(f"{m}: linear fit ({r2_lin:.6f}) beats log "
                             f"({r2_log:.6f}) — re-examine this axis.")

        axes[m] = {
            "value": lambda yy, a=a, b=b: 10 ** (a * np.asarray(yy, float) + b),
            "pixel": lambda vv, a=a, b=b: (np.log10(np.asarray(vv, float)) - b) / a,
            "a": a, "b": b, "r2_log": r2_log, "r2_lin": r2_lin,
            "pairs": [(float(y), int(v)) for y, v in inl],
            "span": (float(ys.min()), float(ys.max())),
            "px_per_decade": float(abs(1 / a)),
        }
    return axes


# --- curve values ------------------------------------------------------------

def native_vertices(group, ages_of, tol_px=1.0):
    """The polyline vertices shared by the five curves of a bundle.

    These are the chart's own sample points (~0, 0.61, 1.24, 1.92, 2.66,
    3.43 months ...) — four of them below 3 months, where Table 4 has none.
    That finer early-infancy resolution is the entire point of the project.
    """
    levels = X.label_group(group)
    counts = {lvl: len(p) for lvl, p in levels.items()}
    if len(set(counts.values())) != 1:
        raise SystemExit(f"curves in a bundle have different vertex counts: "
                         f"{counts}")
    xs = np.stack([levels[lvl][:, 0] for lvl in sorted(levels)])
    spread = float(np.max(xs.max(axis=0) - xs.min(axis=0)))
    if spread > tol_px:
        raise SystemExit(f"the five curves do not share x positions "
                         f"(max spread {spread:.2f} px) — cannot treat the "
                         f"vertices as one age grid.")
    return levels, xs.mean(axis=0), spread


def distribution_space(levels, axis, idx):
    """Decide whether the SD lines are equidistant in value or in log10.

    Drawn on a log axis is not the same as log-normally distributed, so this
    is measured, not assumed. Weight comes out log-normal, length and head
    normal — which is also how Table 4 publishes them.
    """
    best, chosen = np.inf, None
    for space in ("linear", "log10"):
        cvs = []
        for k in range(len(idx)):
            v = np.sort([axis["value"](levels[lvl][k, 1]) for lvl in sorted(levels)])
            if space == "log10":
                v = np.log10(v)
            gaps = np.diff(v)
            cvs.append(np.std(gaps) / np.mean(gaps))
        cv = float(np.mean(cvs))
        if cv < best:
            best, chosen = cv, space
    return chosen, best


def derive(group, axis, ages_of):
    """mu, sigma and the -3..+3 SD curves at the chart's native vertices."""
    levels, xs, spread = native_vertices(group, ages_of)
    ages = np.asarray(ages_of(xs), float)
    space, cv = distribution_space(levels, axis, xs)

    # Values of the five drawn curves at every vertex, low to high.
    vals = np.sort(np.stack([axis["value"](levels[lvl][:, 1])
                             for lvl in sorted(levels)]), axis=0)
    work = np.log10(vals) if space == "log10" else vals

    mu = work[2]                                  # the M curve
    sigma = (work[4] - work[0]) / 4.0             # mean of the four gaps
    # The mean should sit midway between +/-2SD if the bundle is symmetric.
    asym = float(np.max(np.abs((work[4] + work[0]) / 2 - mu) / sigma))

    curves = {}
    for lvl in SD_LEVELS:
        w = mu + lvl * sigma
        out = 10 ** w if space == "log10" else w
        curves["median" if lvl == 0 else f"{lvl:+d}SD"] = out

    return {
        "ages": ages, "xs": xs, "mu": mu, "sigma": sigma, "curves": curves,
        "space": space, "gap_cv": cv, "asymmetry_sd": asym,
        "x_spread_px": spread, "levels": levels,
    }


# --- held-out validation: the dashed +/-3SD lines ----------------------------

def dash_points(page, x_lo, x_hi, lw=0.24, max_len=40.0):
    """Midpoints of the dashed +/-3SD fragments.

    These live in page.lines as hundreds of tiny segments. Nothing in the
    calibration or the mu/sigma fit reads them, which is what makes them a
    real out-of-sample check rather than a restatement of the fit.
    """
    pts = []
    for ln in page.lines:
        if abs((ln.get("linewidth") or 0.0) - lw) > 0.05:
            continue
        if (ln["x1"] - ln["x0"]) > max_len:
            continue
        if ln["x0"] < x_lo - 1 or ln["x1"] > x_hi + 1:
            continue
        if abs(ln["top"] - ln["bottom"]) < 0.2:
            continue                       # horizontal stub, not a curve dash
        pts.append(((ln["x0"] + ln["x1"]) / 2,
                    (ln["top"] + ln["bottom"]) / 2))
    return np.array(sorted(pts)) if pts else np.empty((0, 2))


def check_3sd(results, axes, dashes, min_per_track=30):
    """Compare predicted +/-3SD against where the chart actually drew them.

    mu/sigma were fitted to the five SOLID curves only, so the dashed lines
    are held out and this check can fail. It is run over all three measures
    at once: every dash fragment is assigned to whichever of the six
    predicted tracks (3 measures x +/-3SD) passes closest to it, and we then
    ask how far the assigned dashes sit from their track.

    Doing it this way rather than "nearest dash to each predicted point"
    matters. The latter silently snaps a vertex with no dash nearby onto a
    different track and reports that gap as model error — on the first run
    it produced a 76 px "failure" that was purely a matching artifact.

    Assignment counts are returned too: a model that fitted only some of the
    curves would starve a track, so the counts have to be checked, not just
    the residuals.
    """
    if len(dashes) == 0:
        return None

    tracks = []
    for measure, res in results.items():
        for key in ("-3SD", "+3SD"):
            y_px = np.asarray(axes[measure]["pixel"](res["curves"][key]), float)
            tracks.append((measure, key, res["xs"], y_px))

    dist = np.array([[abs(float(np.interp(x, t[2], t[3])) - y) for t in tracks]
                     for x, y in dashes])
    owner = np.argmin(dist, axis=1)
    resid = dist[np.arange(len(dashes)), owner]

    stats = {}
    for ti, (measure, key, _, _) in enumerate(tracks):
        sel = owner == ti
        r = resid[sel]
        s = stats.setdefault(measure, {"n": 0, "max_px": 0.0, "_sq": 0.0,
                                       "perTrack": {}})
        s["perTrack"][key] = int(sel.sum())
        s["n"] += int(sel.sum())
        if len(r):
            s["max_px"] = max(s["max_px"], float(r.max()))
            s["_sq"] += float(np.sum(np.square(r)))
    for s in stats.values():
        s["rms_px"] = float(np.sqrt(s["_sq"] / s["n"])) if s["n"] else float("nan")
        s["starved"] = min(s["perTrack"].values()) < min_per_track
        del s["_sq"]
    return stats


# --- Table 4 divergence (diagnostic only) ------------------------------------

def table4_divergence(res, sex, measure, ages_of):
    """Chart minus table, as a percentage. Reported, never applied."""
    out = {}
    for month in X.ANCHORS:
        got = float(np.interp(month, res["ages"], res["curves"]["median"]))
        mean, _ = X.TABLE4[sex][month][measure]
        want = 10 ** mean if measure == "weight" else mean
        out[str(month)] = round((got - want) / want * 100, 2)
    return out


# --- main --------------------------------------------------------------------

def run(pdf_path, sex, out_path):
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[0]
        words = page.extract_words()
        curves = X.main_curves(page)
        groups = X.group_curves(curves)
        if len(groups) != 3:
            raise SystemExit(f"expected 3 bundles of 5 curves, got {len(groups)}")

        xs = np.concatenate([c["pts"][:, 0] for c in curves])
        x_lo, x_hi = float(xs.min()), float(xs.max())
        ages_of, ntick = X.age_axis(page, words, x_lo, x_hi)
        print(f"age axis: {ntick} ticks over x {x_lo:.0f}..{x_hi:.0f}")

        axes = build_axes(page, x_lo, x_hi)
        names = X.identify_panels(groups, axes, ages_of)
        dashes = dash_points(page, x_lo, x_hi)
        print(f"\ndashed +/-3SD fragments recovered: {len(dashes)}")

        result = {
            "sex": sex,
            "source": {
                "pdf": pdf_path,
                "chartCitation": "Niklasson & Karlberg 1999; Albertsson-Wikland "
                                 "et al, Acta Paediatr 91:739-754, 2002",
                "method": "Values read from the chart's own vector paths, "
                          "calibrated against its own gridlines. No external "
                          "data enters the calibration. The chart is ground "
                          "truth; see table4DivergencePct.",
                "ageRangeMonths": [0, 24],
            },
            "measures": {},
        }

        results = {m: derive(g, axes[m], ages_of)
                   for g, m in zip(groups, names)}

        checks = check_3sd(results, axes, dashes)
        if checks is None:
            raise SystemExit("no dashed +/-3SD fragments found — the held-out "
                             "check cannot run, so nothing here is validated.")

        print("\nvalidation against the held-out dashed +/-3SD lines:")
        for measure in names:
            chk = checks.get(measure)
            if chk is None:
                raise SystemExit(f"{measure}: no dashes claimed by its +/-3SD "
                                 f"tracks — the held-out check cannot run.")
            bad = chk["max_px"] > MAX_3SD_ERR_PX or chk["starved"]
            counts = " ".join(f"{k}:{v}" for k, v in sorted(chk["perTrack"].items()))
            print(f"  {measure:7s} n={chk['n']:3d} ({counts})  "
                  f"max {chk['max_px']:.2f} px  rms {chk['rms_px']:.2f} px   "
                  f"{'FAIL' if bad else 'ok'}")
            if chk["starved"]:
                raise SystemExit(
                    f"{measure}: a +/-3SD track claimed almost no dashes "
                    f"({counts}) — the prediction is not where the chart drew "
                    f"that curve.")
            if chk["max_px"] > MAX_3SD_ERR_PX:
                raise SystemExit(
                    f"{measure}: predicted +/-3SD is {chk['max_px']:.2f} px "
                    f"from where the chart drew it (limit {MAX_3SD_ERR_PX}). "
                    f"The model does not match the chart.")

        for measure in names:
            res, axis, chk = results[measure], axes[measure], checks[measure]
            unit = "kg" if measure == "weight" else "cm"
            result["measures"][measure] = {
                "unit": unit,
                "distribution": "log10-normal" if res["space"] == "log10" else "normal",
                "zscore": (f"z = (log10({unit}) - mu) / sigma"
                           if res["space"] == "log10"
                           else f"z = ({unit} - mu) / sigma"),
                "muUnit": f"log10({unit})" if res["space"] == "log10" else unit,
                "ageMonths": [round(float(v), 4) for v in res["ages"]],
                "mu": [round(float(v), 6) for v in res["mu"]],
                "sigma": [round(float(v), 6) for v in res["sigma"]],
                "curves": {k: [round(float(x), 4) for x in v]
                           for k, v in res["curves"].items()},
                "calibration": {
                    "space": "log10",
                    "pxPerDecade": round(axis["px_per_decade"], 1),
                    "gridlinePairs": len(axis["pairs"]),
                    "r2Log": round(axis["r2_log"], 6),
                    "r2Linear": round(axis["r2_lin"], 6),
                    "ticks": axis["pairs"],
                },
                "validation": {
                    "sd3HeldOutMaxPx": round(chk["max_px"], 3),
                    "sd3HeldOutRmsPx": round(chk["rms_px"], 3),
                    "sd3DashesMatched": chk["n"],
                    "sd3PerTrack": chk["perTrack"],
                    "sdGapCV": round(res["gap_cv"], 5),
                    "meanAsymmetrySD": round(res["asymmetry_sd"], 4),
                    "curveXSpreadPx": round(res["x_spread_px"], 3),
                },
                "table4DivergencePct": table4_divergence(res, sex, measure, ages_of),
            }

    with open(out_path, "w") as fh:
        json.dump(result, fh, indent=2)
    print(f"\nwrote {out_path}")
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--sex", choices=["male", "female"], required=True)
    ap.add_argument("-o", "--out", required=True)
    a = ap.parse_args()
    run(a.pdf, a.sex, a.out)


if __name__ == "__main__":
    main()
