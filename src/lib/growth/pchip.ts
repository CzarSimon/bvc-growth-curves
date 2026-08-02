/**
 * Monotone cubic Hermite interpolation (PCHIP, Fritsch–Carlson).
 *
 * A natural cubic spline overshoots across the reference's wide intervals and
 * can produce a mean growth curve that dips — a curve that says a child's
 * expected weight falls between two months. PCHIP cannot do that: it passes
 * through every knot and preserves monotonicity of the data.
 *
 * Slopes use the Fritsch–Butland weighted harmonic mean, which satisfies the
 * Fritsch–Carlson monotonicity condition by construction, with a zero slope
 * wherever the data turns. Endpoints use the adjacent secant, which is the
 * conservative choice: never steeper than the data it sits next to.
 */

export type MonotoneSpline = {
  readonly xs: readonly number[];
  readonly ys: readonly number[];
  readonly slopes: readonly number[];
};

/** Precompute the interpolant for a series. Throws on malformed input. */
export function buildSpline(xs: readonly number[], ys: readonly number[]): MonotoneSpline {
  const n = xs.length;
  if (n !== ys.length) throw new Error("pchip: xs and ys must have the same length");
  if (n < 2) throw new Error("pchip: need at least two points");
  for (let i = 1; i < n; i++) {
    if (!(xs[i] > xs[i - 1])) throw new Error("pchip: xs must be strictly increasing");
  }

  const secant: number[] = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    secant[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  }

  const slopes: number[] = new Array(n);
  slopes[0] = secant[0];
  slopes[n - 1] = secant[n - 2];
  for (let i = 1; i < n - 1; i++) {
    const d0 = secant[i - 1];
    const d1 = secant[i];
    if (d0 * d1 <= 0) {
      // A turning point (or a flat segment): a zero slope is the only choice
      // that cannot overshoot either neighbour.
      slopes[i] = 0;
    } else {
      const h0 = xs[i] - xs[i - 1];
      const h1 = xs[i + 1] - xs[i];
      const w0 = 2 * h1 + h0;
      const w1 = h1 + 2 * h0;
      slopes[i] = (w0 + w1) / (w0 / d0 + w1 / d1);
    }
  }

  return { xs, ys, slopes };
}

/**
 * Evaluate the spline at `x`.
 *
 * Outside `[xs[0], xs[n-1]]` this returns the nearest endpoint value rather
 * than extrapolating. Callers must not rely on that: the reference lookup
 * checks the age range *before* calling here and refuses out-of-range ages
 * outright. The endpoint behaviour exists only so a floating-point hair past a
 * knot cannot produce a wild number.
 */
export function evaluateSpline(spline: MonotoneSpline, x: number): number {
  const { xs, ys, slopes } = spline;
  const n = xs.length;
  if (!Number.isFinite(x)) throw new Error("pchip: x must be finite");
  if (x <= xs[0]) return ys[0];
  if (x >= xs[n - 1]) return ys[n - 1];

  // Binary search for the interval containing x.
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }

  const h = xs[lo + 1] - xs[lo];
  const t = (x - xs[lo]) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * ys[lo] +
    (t3 - 2 * t2 + t) * h * slopes[lo] +
    (-2 * t3 + 3 * t2) * ys[lo + 1] +
    (t3 - t2) * h * slopes[lo + 1]
  );
}

/** Convenience for one-off evaluation. Prefer `buildSpline` when reusing. */
export function interpolateMonotone(
  xs: readonly number[],
  ys: readonly number[],
  x: number,
): number {
  return evaluateSpline(buildSpline(xs, ys), x);
}
