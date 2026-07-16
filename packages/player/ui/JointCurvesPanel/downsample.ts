/**
 * LTTB-inspired min/max downsampling for columnar time-series data.
 *
 * Divides the data into `maxPoints` equal-width buckets.
 * Within each bucket it finds the global min and max index across
 * all value columns and retains both, preserving visual extremes.
 *
 * Tradeoff vs true LTTB: simpler (O(n·cols)), but finds a shared
 * min/max index rather than per-column extremes. Good enough when
 * joints are correlated (same robot); swap for per-column sampling
 * if joints move independently at very different scales.
 */
export function downsampleColumnar(cols: number[][], maxPoints: number): number[][] {
  const len = cols[0]?.length ?? 0
  if (len <= maxPoints) return cols

  const bucketSize = len / maxPoints
  const kept = new Set<number>([0, len - 1])

  for (let b = 0; b < maxPoints; b++) {
    const start = Math.floor(b * bucketSize)
    const end = Math.min(Math.floor((b + 1) * bucketSize), len)
    if (start >= end) continue

    let minVal = Infinity,
      maxVal = -Infinity
    let minIdx = start,
      maxIdx = start

    for (let i = start; i < end; i++) {
      for (let c = 1; c < cols.length; c++) {
        const v = cols[c][i]
        if (v < minVal) {
          minVal = v
          minIdx = i
        }
        if (v > maxVal) {
          maxVal = v
          maxIdx = i
        }
      }
    }

    kept.add(minIdx)
    kept.add(maxIdx)
  }

  const sorted = Array.from(kept).sort((a, b) => a - b)
  return cols.map((col) => sorted.map((i) => col[i]))
}
