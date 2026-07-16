import { describe, expect, it } from 'vitest'
import { downsampleColumnar } from './downsample'

describe('downsampleColumnar', () => {
  it('returns input unchanged when len <= maxPoints', () => {
    const cols = [
      [0, 1, 2, 3, 4],
      [10, 20, 30, 40, 50],
    ]
    expect(downsampleColumnar(cols, 5)).toBe(cols)
    expect(downsampleColumnar(cols, 10)).toBe(cols)
  })

  it('handles empty input gracefully', () => {
    expect(downsampleColumnar([[]], 100)).toEqual([[]])
  })

  it('always keeps first and last index', () => {
    const len = 1000
    const t = Array.from({ length: len }, (_, i) => i)
    const y = Array.from({ length: len }, (_, i) => Math.sin(i / 30))
    const [tOut, yOut] = downsampleColumnar([t, y], 100)

    expect(tOut[0]).toBe(t[0])
    expect(tOut[tOut.length - 1]).toBe(t[len - 1])
    expect(yOut[0]).toBe(y[0])
    expect(yOut[yOut.length - 1]).toBe(y[len - 1])
  })

  it('preserves the global min and max across all value columns', () => {
    const len = 500
    const t = Array.from({ length: len }, (_, i) => i)
    // Two columns; each has a distinct peak/valley the downsampler must keep.
    const a = new Array<number>(len).fill(0)
    const b = new Array<number>(len).fill(0)
    a[137] = 999 // global max lives in column A
    b[311] = -777 // global min lives in column B

    const [, aOut, bOut] = downsampleColumnar([t, a, b], 50)

    expect(aOut).toContain(999)
    expect(bOut).toContain(-777)
  })

  it('never returns more points than roughly 2 * maxPoints', () => {
    // Each bucket contributes up to 2 kept indices (min + max) plus first/last.
    const len = 10_000
    const t = Array.from({ length: len }, (_, i) => i)
    const y = Array.from({ length: len }, (_, i) => Math.sin(i / 100))
    const [tOut] = downsampleColumnar([t, y], 500)
    expect(tOut.length).toBeLessThanOrEqual(500 * 2 + 2)
    expect(tOut.length).toBeGreaterThan(0)
  })

  it('output indices remain monotonically increasing', () => {
    const len = 3000
    const t = Array.from({ length: len }, (_, i) => i)
    const y = Array.from({ length: len }, () => Math.random())
    const [tOut] = downsampleColumnar([t, y], 200)
    for (let i = 1; i < tOut.length; i++) {
      expect(tOut[i]).toBeGreaterThan(tOut[i - 1])
    }
  })

  it('handles single-column input (only x, no values)', () => {
    const len = 100
    const t = Array.from({ length: len }, (_, i) => i)
    // With only the x column, no min/max scan happens — first and last kept.
    const [tOut] = downsampleColumnar([t], 10)
    expect(tOut[0]).toBe(0)
    expect(tOut[tOut.length - 1]).toBe(len - 1)
  })
})
