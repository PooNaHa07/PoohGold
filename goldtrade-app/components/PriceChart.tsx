'use client'

import { useEffect, useRef } from 'react'
import type { GoldPrice } from '@/types'

interface PriceChartProps {
  history: GoldPrice[]
  currentPrice: GoldPrice | null
}

// คำนวณ MA (Moving Average)
function calcMA(data: number[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null
    const slice = data.slice(i - period + 1, i + 1)
    return slice.reduce((a, b) => a + b, 0) / period
  })
}

export default function PriceChart({ history, currentPrice }: PriceChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<unknown>(null)
  const seriesRef = useRef<unknown>(null)
  const ma7Ref = useRef<unknown>(null)
  const ma21Ref = useRef<unknown>(null)

  useEffect(() => {
    if (!chartRef.current || history.length === 0) return

    let chart: unknown
    let mounted = true

    const init = async () => {
      const { createChart, ColorType, LineStyle, LineSeries } = await import('lightweight-charts')
      if (!mounted || !chartRef.current) return

      // Destroy existing chart
      if (chartInstanceRef.current) {
        (chartInstanceRef.current as { remove: () => void }).remove()
      }

      chart = createChart(chartRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: 'rgba(255,255,255,0.5)',
          fontSize: 11,
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.04)' },
          horzLines: { color: 'rgba(255,255,255,0.04)' },
        },
        crosshair: {
          vertLine: { color: 'rgba(245,166,35,0.5)', style: LineStyle.Dashed },
          horzLine: { color: 'rgba(245,166,35,0.5)', style: LineStyle.Dashed },
        },
        rightPriceScale: {
          borderColor: 'rgba(255,255,255,0.08)',
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
        timeScale: {
          borderColor: 'rgba(255,255,255,0.08)',
          timeVisible: true,
          secondsVisible: false,
        },
        handleScale: { mouseWheel: true, pinch: true },
        handleScroll: { mouseWheel: true, pressedMouseMove: true },
        width: chartRef.current.clientWidth,
        height: 280,
      })

      chartInstanceRef.current = chart

      // ---- Price line series ----
      const priceSeries = (chart as any).addSeries(LineSeries, {
        color: '#f5a623',
        lineWidth: 2,
        priceLineVisible: true,
        priceLineColor: 'rgba(245,166,35,0.5)',
        lastValueVisible: true,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 5,
      })
      seriesRef.current = priceSeries

      // ---- MA7 series ----
      const ma7Series = (chart as any).addSeries(LineSeries, {
        color: '#facc15',
        lineWidth: 1,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
        title: 'MA7',
      })
      ma7Ref.current = ma7Series

      // ---- MA21 series ----
      const ma21Series = (chart as any).addSeries(LineSeries, {
        color: '#60a5fa',
        lineWidth: 1,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
        title: 'MA21',
      })
      ma21Ref.current = ma21Series

      // Map data (Deduplicate explicit identical times in seconds)
      const uniqueDataMap = new Map<number, number>();
      const sortedHistory = [...history].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      sortedHistory.forEach((row) => {
        uniqueDataMap.set(
          Math.floor(new Date(row.created_at).getTime() / 1000), 
          row.calculated_thai_gold
        );
      });

      const uniqueTimes = Array.from(uniqueDataMap.keys()).sort((a, b) => a - b)
      const prices = uniqueTimes.map((t) => uniqueDataMap.get(t)!)

      const priceData = uniqueTimes.map((t, i) => ({
        time: t as unknown,
        value: prices[i],
      }))

      const ma7Values = calcMA(prices, 7)
      const ma21Values = calcMA(prices, 21)

      const ma7Data = uniqueTimes
        .map((t, i) => (ma7Values[i] !== null ? { time: t as unknown, value: ma7Values[i]! } : null))
        .filter(Boolean)

      const ma21Data = uniqueTimes
        .map((t, i) => (ma21Values[i] !== null ? { time: t as unknown, value: ma21Values[i]! } : null))
        .filter(Boolean)

      try {
        ;(priceSeries as { setData: (d: unknown) => void }).setData(priceData)
        ;(ma7Series as { setData: (d: unknown) => void }).setData(ma7Data)
        ;(ma21Series as { setData: (d: unknown) => void }).setData(ma21Data)
        ;(chart as { timeScale: () => { fitContent: () => void } }).timeScale().fitContent()
      } catch (err) {
        console.error('Chart init error:', err)
      }

      // Resize observer
      const ro = new ResizeObserver(() => {
        if (chartRef.current && chartInstanceRef.current) {
          (chartInstanceRef.current as { applyOptions: (o: unknown) => void }).applyOptions({
            width: chartRef.current.clientWidth,
          })
        }
      })
      if (chartRef.current) ro.observe(chartRef.current)
    }

    init()
    return () => {
      mounted = false
    }
  }, [history])

  // อัปเดต tick ใหม่แบบ real-time (ไม่ re-init chart)
  useEffect(() => {
    if (!currentPrice || !seriesRef.current) return
    const time = Math.floor(new Date(currentPrice.created_at).getTime() / 1000) as unknown
    const value = currentPrice.calculated_thai_gold
    ;(seriesRef.current as { update: (d: unknown) => void }).update({ time, value })
  }, [currentPrice])

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white font-semibold text-base">กราฟราคาทองไทย 96.5%</h2>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-amber-400 inline-block rounded" />
            <span className="text-white/50">ราคา</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-yellow-400 inline-block rounded" />
            <span className="text-white/50">MA7</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-blue-400 inline-block rounded" />
            <span className="text-white/50">MA21</span>
          </span>
        </div>
      </div>
      {history.length < 3 ? (
        <div className="h-[280px] flex flex-col items-center justify-center text-white/30">
          <span className="text-3xl mb-2">📊</span>
          <p className="text-sm">กำลังรวบรวมข้อมูล...</p>
          <p className="text-xs mt-1">ต้องมีข้อมูลอย่างน้อย 3 ticks</p>
        </div>
      ) : (
        <div ref={chartRef} className="w-full" />
      )}
    </div>
  )
}
