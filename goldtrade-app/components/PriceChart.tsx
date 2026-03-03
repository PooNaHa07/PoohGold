'use client'

import { useEffect, useRef } from 'react'
import type { GoldPrice, NewsItem } from '@/types'

interface PriceChartProps {
  history: GoldPrice[]
  currentPrice: GoldPrice | null
  news?: NewsItem[]
}

// คำนวณ MA (Moving Average)
function calcMA(data: number[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null
    const slice = data.slice(i - period + 1, i + 1)
    return slice.reduce((a, b) => a + b, 0) / period
  })
}

// คำนวณ RSI (Relative Strength Index)
function calcRSI(data: number[], period: number = 14): (number | null)[] {
  if (data.length <= period) return Array(data.length).fill(null)
  
  const rsi: (number | null)[] = Array(data.length).fill(null)
  const changes = data.map((val, i) => (i === 0 ? 0 : val - data[i - 1]))
  
  let gains = 0
  let losses = 0
  
  // Initial Average
  for (let i = 1; i <= period; i++) {
    if (changes[i] > 0) gains += changes[i]
    else losses -= changes[i]
  }
  
  let avgGain = gains / period
  let avgLoss = losses / period
  
  if (avgLoss === 0) rsi[period] = 100
  else rsi[period] = 100 - (100 / (1 + avgGain / avgLoss))
  
  // Smoothing
  for (let i = period + 1; i < data.length; i++) {
    const change = changes[i]
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period
      avgLoss = (avgLoss * (period - 1)) / period
    } else {
      avgGain = (avgGain * (period - 1)) / period
      avgLoss = (avgLoss * (period - 1) - change) / period
    }
    
    if (avgLoss === 0) rsi[i] = 100
    else rsi[i] = 100 - (100 / (1 + avgGain / avgLoss))
  }
  
  return rsi
}

export default function PriceChart({ history, currentPrice, news = [] }: PriceChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<unknown>(null)
  const seriesRef = useRef<unknown>(null)
  const ma7Ref = useRef<unknown>(null)
  const ma21Ref = useRef<unknown>(null)
  const rsiRef = useRef<unknown>(null)
  const rsiChartRef = useRef<HTMLDivElement>(null)
  const rsiInstanceRef = useRef<unknown>(null)

  useEffect(() => {
    if (!chartRef.current || history.length === 0) return

    let chart: any
    let mounted = true

    // Resize observer to handle container resizing
    const ro = new ResizeObserver(entries => {
      if (entries[0] && chartInstanceRef.current) {
        (chartInstanceRef.current as any).applyOptions({ width: entries[0].contentRect.width })
        if (rsiInstanceRef.current) {
          (rsiInstanceRef.current as any).applyOptions({ width: entries[0].contentRect.width })
        }
      }
    })

    const init = async () => {
      const { createChart, ColorType, LineStyle, LineSeries } = await import('lightweight-charts')
      if (!mounted || !chartRef.current) return

      // Destroy existing chart
      if (chartInstanceRef.current) {
        (chartInstanceRef.current as any).remove()
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
      const priceSeries = chart.addSeries(LineSeries, {
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
      const ma7Series = chart.addSeries(LineSeries, {
        color: '#facc15',
        lineWidth: 1,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
        title: 'MA7',
      })
      ma7Ref.current = ma7Series

      // ---- MA21 series ----
      const ma21Series = chart.addSeries(LineSeries, {
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
        time: t as any,
        value: prices[i],
      }))

      const ma7Values = calcMA(prices, 7)
      const ma21Values = calcMA(prices, 21)

      const ma7Data = uniqueTimes
        .map((t, i) => (ma7Values[i] !== null ? { time: t as any, value: ma7Values[i]! } : null))
        .filter(Boolean) as any[]

      const ma21Data = uniqueTimes
        .map((t, i) => (ma21Values[i] !== null ? { time: t as any, value: ma21Values[i]! } : null))
        .filter(Boolean) as any[]

      try {
        if (priceSeries) priceSeries.setData(priceData)
        if (ma7Series) ma7Series.setData(ma7Data)
        if (ma21Series) ma21Series.setData(ma21Data)

        // Add news markers
        if (news.length > 0 && priceSeries) {
          const markers = news
            .map(n => {
              const time = Math.floor(new Date(n.published_at).getTime() / 1000)
              // Only show markers within history range
              const minTime = uniqueTimes[0]
              const maxTime = uniqueTimes[uniqueTimes.length - 1]
              if (time < minTime || time > maxTime) return null

              return {
                time: time as any,
                position: 'aboveBar' as const,
                color: n.impact_type === 'bullish' ? '#4ade80' : n.impact_type === 'bearish' ? '#f87171' : '#fbbf24',
                shape: 'circle' as const,
                text: n.impact_type === 'bullish' ? '🟢' : n.impact_type === 'bearish' ? '🔴' : '🟡',
                size: 1,
              }
            })
            .filter(Boolean) as any[]
          
          if (priceSeries.setMarkers) {
            priceSeries.setMarkers(markers)
          }
        }

        chart.timeScale().fitContent()
      } catch (err) {
        console.error('Chart init error:', err)
      }

      if (chartRef.current) ro.observe(chartRef.current)

      // ---- RSI Chart Init ----
      if (rsiChartRef.current) {
        if (rsiInstanceRef.current) {
          (rsiInstanceRef.current as any).remove()
        }

        const rsiChart = createChart(rsiChartRef.current, {
          layout: {
            background: { type: ColorType.Solid, color: 'transparent' },
            textColor: 'rgba(255,255,255,0.4)',
            fontSize: 10,
          },
          grid: {
            vertLines: { visible: false },
            horzLines: { color: 'rgba(255,255,255,0.04)' },
          },
          rightPriceScale: {
            borderColor: 'rgba(255,255,255,0.08)',
            scaleMargins: { top: 0.1, bottom: 0.1 },
          },
          timeScale: { visible: false },
          width: chartRef.current.clientWidth,
          height: 80,
        })
        rsiInstanceRef.current = rsiChart

        const rsiSeries = rsiChart.addSeries(LineSeries, {
          color: '#a855f7',
          lineWidth: 2,
          lastValueVisible: true,
          title: 'RSI(14)',
        })
        rsiRef.current = rsiSeries

        // Overbought/Oversold lines
        const baseline70 = rsiChart.addSeries(LineSeries, {
          color: 'rgba(239, 68, 68, 0.2)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          lastValueVisible: false,
          priceLineVisible: false,
        })
        if (baseline70) baseline70.setData(uniqueTimes.map(t => ({ time: t as any, value: 70 })))

        const baseline30 = rsiChart.addSeries(LineSeries, {
          color: 'rgba(34, 197, 94, 0.2)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          lastValueVisible: false,
          priceLineVisible: false,
        })
        if (baseline30) baseline30.setData(uniqueTimes.map(t => ({ time: t as any, value: 30 })))

        const rsiValues = calcRSI(prices, 14)
        const rsiData = uniqueTimes
          .map((t, i) => (rsiValues[i] !== null ? { time: t as any, value: rsiValues[i]! } : null))
          .filter(Boolean) as any[]
        
        if (rsiSeries) rsiSeries.setData(rsiData)
        
        // Sync time scale
        chart.timeScale().subscribeVisibleTimeRangeChange(() => {
          const range = chart.timeScale().getVisibleRange()
          if (range) rsiChart.timeScale().setVisibleRange(range)
        })
      }
    }

    init()
    return () => {
      mounted = false
      ro.disconnect() // Clean up ResizeObserver
    }
  }, [history, news])

  // อัปเดต tick ใหม่แบบ real-time (ไม่ re-init chart)
  useEffect(() => {
    if (!currentPrice || !seriesRef.current) return
    const time = Math.floor(new Date(currentPrice.created_at).getTime() / 1000) as any
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
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-purple-500 inline-block rounded" />
            <span className="text-white/50">RSI</span>
          </span>
        </div>
      </div>
      {history.length < 3 ? (
        <div className="h-[360px] flex flex-col items-center justify-center text-white/30">
          <span className="text-3xl mb-2">📊</span>
          <p className="text-sm">กำลังรวบรวมข้อมูล...</p>
          <p className="text-xs mt-1">ต้องมีข้อมูลอย่างน้อย 3 ticks</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div ref={chartRef} className="w-full" />
          <div className="relative">
            <div ref={rsiChartRef} className="w-full" />
            <div className="absolute top-1 left-2 text-[9px] text-white/20 font-mono uppercase tracking-widest">Momentum (RSI)</div>
          </div>
        </div>
      )}
    </div>
  )
}
