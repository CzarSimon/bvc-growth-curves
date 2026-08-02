#!/usr/bin/env python3
"""
Structural and semantic checks on the generated curve JSON.

gridcal.py already gates its own output (log10 R^2, gridline pair counts, and
the held-out +/-3SD comparison). This script checks the artefact rather than
the extraction: that the file is internally consistent, that the published
z-score formula actually inverts the published curves, and that a couple of
hand-computable cases come out right.

    python extraction/verify.py src/data/boys-curves.json src/data/girls-curves.json
"""

import json
import sys

import numpy as np

SD_KEYS = ["-3SD", "-2SD", "-1SD", "median", "+1SD", "+2SD", "+3SD"]
LEVELS = [-3, -2, -1, 0, 1, 2, 3]

# Chart medians at 24 months, read off the calibrated curves. Independent of
# Table 4 (the chart and the table disagree early on; see SCHEMA.md).
SPOT_24MO = {
    "male":   {"weight": 13.36, "length": 88.08, "head": 49.96},
    "female": {"weight": 12.77, "length": 87.09, "head": 48.70},
}

fails = []


def check(cond, msg):
    if not cond:
        fails.append(msg)
    return cond


def zscore(measure, value, age, m):
    mu = np.interp(age, m["ageMonths"], m["mu"])
    sigma = np.interp(age, m["ageMonths"], m["sigma"])
    v = np.log10(value) if m["distribution"] == "log10-normal" else value
    return (v - mu) / sigma


def verify(path):
    print(f"\n{'=' * 62}\n{path}")
    doc = json.load(open(path))
    sex = doc["sex"]

    for measure, m in doc["measures"].items():
        ages = np.array(m["ageMonths"], float)
        n = len(ages)
        tag = f"{sex}/{measure}"

        # --- structure ---
        check(n >= 20, f"{tag}: only {n} vertices")
        check(len(m["mu"]) == n and len(m["sigma"]) == n,
              f"{tag}: mu/sigma length != ageMonths")
        for k in SD_KEYS:
            check(k in m["curves"], f"{tag}: missing curve {k}")
            check(len(m["curves"][k]) == n, f"{tag}: {k} length != ageMonths")

        check(np.all(np.diff(ages) > 0), f"{tag}: ages not increasing")
        check(abs(ages[0]) < 0.01, f"{tag}: does not start at birth")
        check(abs(ages[-1] - 24) < 0.15, f"{tag}: does not end at 24mo "
                                         f"({ages[-1]:.2f})")
        # The chart samples every 1.2 months (24/20), uniform in AGE. An
        # an earlier note claimed sub-month spacing early on
        # (0, 0.61, 1.24, ...); that is what you get if you assume the
        # vertices are evenly spaced in PIXELS. They are not — the x gaps
        # shrink from 37.0 to 10.8 px, exactly tracking the compressed age
        # axis, which is what makes the age spacing uniform.
        gaps = np.diff(ages)
        check(np.all(np.abs(gaps - 1.2) < 0.1),
              f"{tag}: vertex spacing is not the expected uniform 1.2 months "
              f"(got {gaps.min():.2f}..{gaps.max():.2f})")
        early = int(((ages > 0.05) & (ages < 3)).sum())
        check(early >= 2, f"{tag}: {early} vertices strictly between birth and "
                          f"3 months; Table 4 has none, so this is the gap the "
                          f"project exists to fill")

        # --- ordering and monotonicity ---
        stack = np.array([m["curves"][k] for k in SD_KEYS], float)
        check(np.all(np.diff(stack, axis=0) > 0),
              f"{tag}: SD curves not strictly ordered -3 < ... < +3 at every age")
        for k in SD_KEYS:
            check(np.all(np.diff(m["curves"][k]) > 0),
                  f"{tag}: {k} is not strictly increasing with age")
        check(np.all(np.array(m["sigma"]) > 0), f"{tag}: non-positive sigma")

        # --- the published z-score formula must invert the published curves ---
        # Tolerance is set by the rounding in the file, not by the maths: the
        # curves are stored to 4 dp, which for weight is ~1e-4 kg and works
        # out to ~2e-4 of an SD once divided by sigma ~= 0.04 log10 kg. A real
        # unit or formula error would be O(0.1) or worse, so this still bites.
        worst = 0.0
        for lvl, k in zip(LEVELS, SD_KEYS):
            got = zscore(measure, np.array(m["curves"][k], float), ages, m)
            worst = max(worst, float(np.max(np.abs(got - lvl))))
        check(worst < 1e-3, f"{tag}: z-score round-trip off by {worst:.2e}")

        # --- spot value at 24 months ---
        want = SPOT_24MO[sex][measure]
        got = float(np.interp(24, ages, m["curves"]["median"]))
        check(abs(got - want) / want < 0.005,
              f"{tag}: 24mo median {got:.2f} != expected {want:.2f}")

        v = m["validation"]
        print(f"  {measure:7s} {n:2d} vertices ({early} in the 0-3mo gap)  "
              f"24mo median {got:6.2f} {m['unit']}  "
              f"z round-trip {worst:.1e}  "
              f"3SD held-out max {v['sd3HeldOutMaxPx']:.2f}px  "
              f"R2log {m['calibration']['r2Log']:.6f}")

    return doc


def hand_check(boys):
    """A case a human can follow: a 12-month boy weighing 10.6 kg.

    The chart's median there is ~10.57 kg, so he should land just above it.
    """
    m = boys["measures"]["weight"]
    z = float(zscore("weight", 10.6, 12.0, m))
    med = float(np.interp(12, m["ageMonths"], m["curves"]["median"]))
    print(f"\nhand check: 12-month boy at 10.6 kg -> z = {z:+.3f} "
          f"(chart median {med:.2f} kg)")
    check(abs(z) < 0.1, f"12mo boy at 10.6kg should sit near the median, got z={z:+.3f}")

    # And the reverse: +1SD must round-trip to exactly z = +1.
    p1 = float(np.interp(12, m["ageMonths"], m["curves"]["+1SD"]))
    z1 = float(zscore("weight", p1, 12.0, m))
    print(f"            +1SD at 12mo is {p1:.2f} kg -> z = {z1:+.6f}")
    check(abs(z1 - 1) < 1e-3, f"+1SD did not round-trip to 1.0, got {z1}")


def main():
    docs = {}
    for path in sys.argv[1:] or ["src/data/boys-curves.json", "src/data/girls-curves.json"]:
        d = verify(path)
        docs[d["sex"]] = d
    if "male" in docs:
        hand_check(docs["male"])

    print()
    if fails:
        for f in fails:
            print(f"FAIL  {f}")
        raise SystemExit(f"{len(fails)} check(s) failed")
    print("all checks passed")


if __name__ == "__main__":
    main()
