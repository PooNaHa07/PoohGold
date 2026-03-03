'use client'

import { useMemo } from 'react'
import type { GoldPrice } from '@/types'

interface SignalPanelProps {
  history: GoldPrice[]
  currentPrice: GoldPrice | null
}

// คำนวณ RSI (14 periods)
function calcRSI(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null
  const changes = prices.slice(1).map((v, i) => v - prices[i])
  const recent = changes.slice(-period)
  const gains = recent.filter((c) => c > 0).reduce((a, b) => a + b, 0) / period
  const losses = recent.filter((c) => c < 0).map((c) => -c).reduce((a, b) => a + b, 0) / period
  if (losses === 0) return 100
  const rs = gains / losses
  return 100 - 100 / (1 + rs)
}

// คำนวณ MA
function calcMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null
  const slice = prices.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / period
}

export default function SignalPanel({ history, currentPrice }: SignalPanelProps) {
  const analysis = useMemo(() => {
    const sorted = [...history].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    const prices = sorted.map((r) => r.calculated_thai_gold)

    const rsi = calcRSI(prices)
    const ma7 = calcMA(prices, 7)
    const ma21 = calcMA(prices, 21)

    // Price momentum: เทียบราคาปัจจุบัน vs 4 ticks ที่แล้ว (~1 นาที)
    const momentumChange = prices.length >= 5
      ? ((prices[prices.length - 1] - prices[prices.length - 5]) / prices[prices.length - 5]) * 100
      : null

    // คำนวณ % change จาก tick แรกของวัน (approx ใช้ 96 ticks = 24 ชม.)
    const dayChange = prices.length >= 2
      ? ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100
      : null

    // สัญญาณ RSI
    let rsiSignal: 'ซื้อ' | 'ขาย' | 'รอ' = 'รอ'
    if (rsi !== null) {
      if (rsi < 30) rsiSignal = 'ซื้อ'
      else if (rsi > 70) rsiSignal = 'ขาย'
    }

    // สัญญาณ MA Cross
    let maSignal: 'ซื้อ' | 'ขาย' | 'รอ' = 'รอ'
    if (ma7 !== null && ma21 !== null) {
      if (ma7 > ma21) maSignal = 'ซื้อ'   // Bullish
      else if (ma7 < ma21) maSignal = 'ขาย' // Bearish
    }

    // สัญญาณ Momentum
    let momentumSignal: 'ซื้อ' | 'ขาย' | 'รอ' = 'รอ'
    if (momentumChange !== null) {
      if (momentumChange > 0.05) momentumSignal = 'ซื้อ'
      else if (momentumChange < -0.05) momentumSignal = 'ขาย'
    }

    // รวมสัญญาณ (majority vote)
    const signals = [rsiSignal, maSignal, momentumSignal]
    const buys = signals.filter((s) => s === 'ซื้อ').length
    const sells = signals.filter((s) => s === 'ขาย').length

    let overall: 'ซื้อ' | 'ขาย' | 'รอ' = 'รอ'
    let confidence = 0
    if (buys >= 2) { overall = 'ซื้อ'; confidence = buys }
    else if (sells >= 2) { overall = 'ขาย'; confidence = sells }
    else if (buys === 1) { overall = 'รอ'; confidence = 1 }
    else if (sells === 1) { overall = 'รอ'; confidence = 1 }

    return { rsi, ma7, ma21, momentumChange, dayChange, rsiSignal, maSignal, momentumSignal, overall, confidence, dataPoints: prices.length }
  }, [history])

  const overallColor =
    analysis.overall === 'ซื้อ' ? 'text-green-400 border-green-500/40 bg-green-500/10' :
    analysis.overall === 'ขาย' ? 'text-red-400 border-red-500/40 bg-red-500/10' :
    'text-yellow-400 border-yellow-500/40 bg-yellow-500/10'

  const overallIcon =
    analysis.overall === 'ซื้อ' ? '▲' : analysis.overall === 'ขาย' ? '▼' : '⏸'

  function SignalBadge({ signal }: { signal: 'ซื้อ' | 'ขาย' | 'รอ' }) {
    const cls =
      signal === 'ซื้อ' ? 'bg-green-500/15 text-green-400 border border-green-500/25' :
      signal === 'ขาย' ? 'bg-red-500/15 text-red-400 border border-red-500/25' :
      'bg-yellow-500/15 text-yellow-400 border border-yellow-500/25'
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
        {signal === 'ซื้อ' ? '▲ ซื้อ' : signal === 'ขาย' ? '▼ ขาย' : '⏸ รอ'}
      </span>
    )
  }

  const hasData = analysis.dataPoints >= 5

  return (
    <div className="glass p-5 flex flex-col gap-4">
      <h2 className="text-white font-semibold text-base">สัญญาณการเทรด</h2>

      {/* Overall Signal */}
      <div className={`border rounded-xl p-4 text-center ${overallColor}`}>
        <div className="text-3xl font-extrabold">
          {overallIcon} {analysis.overall}
        </div>
        <p className="text-xs mt-1 opacity-70">
          {hasData
            ? `${analysis.confidence}/3 สัญญาณเห็นด้วย`
            : 'กำลังรวบรวมข้อมูล...'}
        </p>
      </div>

      {/* Individual Signals */}
      <div className="space-y-2.5 text-sm">

        {/* RSI */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-white/70">RSI (14)</span>
            <span className="text-white/30 text-xs ml-2">
              {analysis.rsi !== null ? analysis.rsi.toFixed(1) : '—'}
            </span>
          </div>
          {hasData && analysis.rsi !== null ? (
            <SignalBadge signal={analysis.rsiSignal} />
          ) : (
            <span className="text-white/20 text-xs">ข้อมูลไม่พอ</span>
          )}
        </div>
        {analysis.rsi !== null && (
          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                analysis.rsi > 70 ? 'bg-red-400' : analysis.rsi < 30 ? 'bg-green-400' : 'bg-amber-400'
              }`}
              style={{ width: `${Math.min(analysis.rsi, 100)}%` }}
            />
          </div>
        )}

        {/* MA Cross */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-white/70">MA Cross</span>
            <span className="text-white/30 text-xs ml-2">
              {analysis.ma7 !== null ? `MA7 ${analysis.ma7 > (analysis.ma21 ?? 0) ? '>' : '<'} MA21` : '—'}
            </span>
          </div>
          {analysis.ma7 !== null && analysis.ma21 !== null ? (
            <SignalBadge signal={analysis.maSignal} />
          ) : (
            <span className="text-white/20 text-xs">ข้อมูลไม่พอ</span>
          )}
        </div>

        {/* Momentum */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-white/70">Momentum</span>
            <span className={`text-xs ml-2 ${
              (analysis.momentumChange ?? 0) > 0 ? 'text-green-400' : 
              (analysis.momentumChange ?? 0) < 0 ? 'text-red-400' : 
              'text-white/30'
            }`}>
              {analysis.momentumChange !== null
                ? `${analysis.momentumChange > 0 ? '+' : ''}${analysis.momentumChange.toFixed(3)}%`
                : '—'}
            </span>
          </div>
          {analysis.momentumChange !== null ? (
            <SignalBadge signal={analysis.momentumSignal} />
          ) : (
            <span className="text-white/20 text-xs">ข้อมูลไม่พอ</span>
          )}
        </div>

      </div>

      {/* Divider */}
      <div className="border-t border-white/5" />

      {/* MA Values */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-white/5 rounded-lg p-2.5">
          <p className="text-yellow-400 font-medium mb-0.5">MA7</p>
          <p className="text-white font-semibold">
            {analysis.ma7 !== null ? `฿${analysis.ma7.toLocaleString('th-TH', { maximumFractionDigits: 0 })}` : '—'}
          </p>
        </div>
        <div className="bg-white/5 rounded-lg p-2.5">
          <p className="text-blue-400 font-medium mb-0.5">MA21</p>
          <p className="text-white font-semibold">
            {analysis.ma21 !== null ? `฿${analysis.ma21.toLocaleString('th-TH', { maximumFractionDigits: 0 })}` : '—'}
          </p>
        </div>
      </div>

      <p className="text-white/20 text-xs">
        ⚠️ สัญญาณเป็นเพียงข้อมูลช่วยตัดสินใจ ไม่ใช่คำแนะนำลงทุน
      </p>
    </div>
  )
}
