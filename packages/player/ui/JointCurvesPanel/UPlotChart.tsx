'use client'
import { useCallback, useEffect, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'

export interface UPlotChartProps {
  data: uPlot.AlignedData
  series: uPlot.Series[]
  fps: number
  jointNames: string[]
  visibleJoints: number[]
  showState: boolean
  showAction: boolean
  onPlotReady: (plot: uPlot, setPlayhead: (t: number) => void) => void
  onSeek?: (frameIndex: number) => void
}

export function UPlotChart({
  data,
  series,
  fps,
  jointNames,
  visibleJoints,
  showState,
  showAction,
  onPlotReady,
  onSeek,
}: UPlotChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const plotRef = useRef<uPlot | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const playheadTRef = useRef<number | null>(null)
  const isLockedRef = useRef(false)
  const docListenerRef = useRef<((e: MouseEvent) => void) | null>(null)
  const prevSeriesShowRef = useRef<(boolean | undefined)[]>([])

  const onSeekRef = useRef(onSeek)
  const onPlotReadyRef = useRef(onPlotReady)
  const fpsRef = useRef(fps)
  const jointNamesRef = useRef(jointNames)
  const visibleJointsRef = useRef(visibleJoints)
  const showStateRef = useRef(showState)
  const showActionRef = useRef(showAction)
  const seriesRef = useRef(series)

  useEffect(() => { onSeekRef.current = onSeek })
  useEffect(() => { onPlotReadyRef.current = onPlotReady })
  useEffect(() => { fpsRef.current = fps })
  useEffect(() => { jointNamesRef.current = jointNames })
  useEffect(() => { visibleJointsRef.current = visibleJoints })
  useEffect(() => { showStateRef.current = showState })
  useEffect(() => { showActionRef.current = showAction })
  useEffect(() => { seriesRef.current = series })

  const setPlayhead = useCallback((t: number) => {
    playheadTRef.current = t
    plotRef.current?.redraw(false)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const escapeHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

    const initPlot = (width: number, height: number) => {
      plotRef.current?.destroy()
      plotRef.current = null
      isLockedRef.current = false

      const showTooltip = (u: uPlot, idx: number, cursorLeft: number, cursorTop?: number) => {
        const tooltipEl = tooltipRef.current
        if (!tooltipEl) return

        const fps = fpsRef.current
        const names = jointNamesRef.current
        const visible = visibleJointsRef.current
        const doState = showStateRef.current
        const doAction = showActionRef.current
        const N = names.length

        const frameIdx = u.data[0][idx] as number
        const seconds = (frameIdx / fps).toFixed(4)

        let rows = ''
        for (const ji of visible) {
          const color = (seriesRef.current[ji]?.stroke as string) || '#888'
          const sv = doState ? (u.data[ji + 1]?.[idx] as number | undefined) : undefined
          const av = doAction ? (u.data[N + ji + 1]?.[idx] as number | undefined) : undefined
          let valStr = ''
          if (sv != null) valStr = sv.toFixed(4)
          if (av != null) valStr = valStr ? `${valStr} / ${av.toFixed(4)}` : av.toFixed(4)
          rows += `
            <div style="display:flex;justify-content:space-between;gap:12px;padding:2px 0">
              <span style="color:${escapeHtml(color)};font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(names[ji])}</span>
              <span style="color:${escapeHtml(color)};font-size:11px;font-variant-numeric:tabular-nums;white-space:nowrap">${escapeHtml(valStr || '—')}</span>
            </div>`
        }

        tooltipEl.innerHTML = `
          <div style="font-size:10px;color:var(--ink-muted);margin-bottom:4px">
            <div style="display:flex;justify-content:space-between;gap:8px"><span>秒</span><span>${seconds}s</span></div>
            <div style="display:flex;justify-content:space-between;gap:8px"><span>帧</span><span>${frameIdx}</span></div>
          </div>
          <div style="height:1px;background:var(--line);margin:4px 0"></div>
          <div>${rows}</div>`

        const axisOffset = u.bbox.left / devicePixelRatio
        const cursorAbsLeft = axisOffset + cursorLeft
        const plotMid = axisOffset + u.bbox.width / devicePixelRatio / 2
        const ttWidth = tooltipEl.offsetWidth || 220
        const left = cursorAbsLeft < plotMid
          ? cursorAbsLeft + 16
          : cursorAbsLeft - ttWidth - 16

        const tooltipHeight = tooltipEl.offsetHeight || 260
        const containerHeight = el.clientHeight
        const top = cursorTop != null
          ? Math.max(8, Math.min(cursorTop - tooltipHeight / 2, containerHeight - tooltipHeight - 8))
          : 8

        tooltipEl.style.left = `${left}px`
        tooltipEl.style.top = `${top}px`
        tooltipEl.style.display = 'block'
      }

      const opts: uPlot.Options = {
        width,
        height,
        scales: { x: { time: false } },
        axes: [
          {
            stroke: 'rgba(180,180,180,0.7)',
            grid: { stroke: 'rgba(128,128,128,0.15)', width: 1 },
            ticks: { stroke: 'rgba(128,128,128,0.3)', width: 1, size: 4 },
            values: (_u, vals) => vals.map((v) => `${(v / fpsRef.current).toFixed(1)}s`),
          },
          {
            stroke: 'rgba(180,180,180,0.7)',
            grid: { stroke: 'rgba(128,128,128,0.15)', width: 1 },
            ticks: { stroke: 'rgba(128,128,128,0.3)', width: 1, size: 4 },
            size: 50,
          },
        ],
        series: [{}, ...series],
        cursor: { x: true, y: true, points: { show: false } },
        legend: { show: false },
        hooks: {
          init: [
            (u: uPlot) => {
              u.over.addEventListener('mousedown', (e: MouseEvent) => {
                if (e.button !== 0) return
                const rect = u.over.getBoundingClientRect()
                const clickX = e.clientX - rect.left
                const xVal = u.posToVal(clickX, 'x')
                const xs = u.data[0] as number[]
                let lo = 0; let hi = xs.length - 1
                while (lo < hi) {
                  const mid = (lo + hi) >> 1
                  if (xs[mid] < xVal) lo = mid + 1; else hi = mid
                }
                if (lo > 0 && Math.abs(xs[lo - 1] - xVal) < Math.abs(xs[lo] - xVal)) lo -= 1
                const frameIndex = xs[lo] as number
                playheadTRef.current = frameIndex
                u.redraw(false)
                isLockedRef.current = true
                const clickY = e.clientY - rect.top
                showTooltip(u, lo, clickX, clickY)
                if (tooltipRef.current) tooltipRef.current.style.border = '1px solid var(--primary)'
                onSeekRef.current?.(frameIndex)
              })

              if (docListenerRef.current) document.removeEventListener('mousedown', docListenerRef.current)
              const handleDocMousedown = (e: MouseEvent) => {
                if (!u.over.contains(e.target as Node)) {
                  isLockedRef.current = false
                  if (tooltipRef.current) {
                    tooltipRef.current.style.display = 'none'
                    tooltipRef.current.style.border = '1px solid var(--line)'
                  }
                }
              }
              document.addEventListener('mousedown', handleDocMousedown)
              docListenerRef.current = handleDocMousedown
            },
          ],
          draw: [
            (u: uPlot) => {
              if (playheadTRef.current === null) return
              const xCanvas = u.valToPos(playheadTRef.current, 'x', true)
              if (xCanvas < u.bbox.left || xCanvas > u.bbox.left + u.bbox.width) return
              const ctx = u.ctx
              ctx.save()
              ctx.strokeStyle = '#facc15'
              ctx.lineWidth = 1.5 * devicePixelRatio
              ctx.globalAlpha = 0.85
              ctx.setLineDash([4 * devicePixelRatio, 4 * devicePixelRatio])
              ctx.beginPath()
              ctx.moveTo(xCanvas, u.bbox.top)
              ctx.lineTo(xCanvas, u.bbox.top + u.bbox.height)
              ctx.stroke()
              ctx.restore()
            },
          ],
          setCursor: [
            (u: uPlot) => {
              const tooltipEl = tooltipRef.current
              if (!tooltipEl) return
              if (isLockedRef.current) return
              const idx = u.cursor.idx
              const cursorLeft = u.cursor.left ?? -1
              if (idx == null || cursorLeft < 0) {
                tooltipEl.style.display = 'none'
                return
              }
              showTooltip(u, idx, cursorLeft, u.cursor.top ?? undefined)
            },
          ],
        },
      }

      plotRef.current = new uPlot(opts, data, el)
      onPlotReadyRef.current(plotRef.current, setPlayhead)
    }

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width === 0 || height === 0) return
      if (!plotRef.current) {
        initPlot(width, height)
      } else {
        plotRef.current.setSize({ width, height })
      }
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      plotRef.current?.destroy()
      plotRef.current = null
      if (docListenerRef.current) {
        document.removeEventListener('mousedown', docListenerRef.current)
        docListenerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { plotRef.current?.setData(data) }, [data])

  useEffect(() => {
    if (!plotRef.current) return
    const prev = prevSeriesShowRef.current
    series.forEach((s, i) => {
      if (prev[i] !== s.show) plotRef.current!.setSeries(i + 1, { show: s.show })
    })
    prevSeriesShowRef.current = series.map((s) => s.show)
  }, [series])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        ref={tooltipRef}
        style={{
          display: 'none',
          position: 'absolute',
          zIndex: 10,
          background: 'var(--bg-surface)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          padding: '8px 10px',
          minWidth: 160,
          maxWidth: 240,
          pointerEvents: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        }}
      />
    </div>
  )
}
