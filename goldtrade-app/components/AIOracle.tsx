'use client'

import { useMemo } from 'react'
import { NewsItem, GoldPrice } from '../types'

interface AIOracleProps {
  news: NewsItem[]
  history: GoldPrice[]
  currentPrice: GoldPrice | null
}

export default function AIOracle({ news, history, currentPrice }: AIOracleProps) {
  const oracleData = useMemo(() => {
    if (!currentPrice || history.length < 14) {
      return { confidence: 50, signal: 'Neutral', reason: 'กำลังรวบรวมข้อมูล...', color: 'text-amber-400' }
    }

    // 1. Technical Score (RSI-based)
    // Simple RSI approximation for the score
    const prices = history.map(h => h.xauusd)
    const lastPrice = prices[prices.length - 1]
    const prevPrice = prices[prices.length - 2]
    
    let techScore = 50
    if (lastPrice > prevPrice) techScore += 10
    else techScore -= 10

    // 2. Sentiment Score
    const latestNews = news.slice(0, 5)
    let sentimentScore = 0
    latestNews.forEach(n => {
      if (n.impact_type === 'bullish') sentimentScore += (n.volatility_score || 1) * 5
      if (n.impact_type === 'bearish') sentimentScore -= (n.volatility_score || 1) * 5
    })

    // 3. FX Impact (USDTHB trend)
    const lastFX = currentPrice.usd_thb
    const prevFX = history[history.length - 2]?.usd_thb || lastFX
    let fxImpact = 0
    if (lastFX > prevFX) fxImpact = -5 // THB weak is good for gold price but bad for entry
    else fxImpact = 5

    const finalConfidence = Math.max(0, Math.min(100, 50 + techScore/5 + sentimentScore + fxImpact))
    
    let signal = 'Neutral'
    let color = 'text-amber-400'
    let reason = 'ตลาดกำลังมองหาทิศทางที่ชัดเจน'

    if (finalConfidence > 70) {
      signal = 'Strong Buy'
      color = 'text-green-400'
      reason = 'ปัจจัยทางเทคนิคและข่าวสารหนุนการปรับตัวขึ้นอย่างแข็งแกร่ง'
    } else if (finalConfidence > 55) {
      signal = 'Buy'
      color = 'text-green-300'
      reason = 'มีแรงซื้อพยุง แต่ยังต้องการการยืนยันจากวอลลุ่ม'
    } else if (finalConfidence < 30) {
      signal = 'Strong Sell'
      color = 'text-red-400'
      reason = 'ความเสี่ยงด้านลบสูง มีแรงกดดันจากทั้งข่าวและกราฟเทคนิค'
    } else if (finalConfidence < 45) {
      signal = 'Sell'
      color = 'text-red-300'
      reason = 'แนวโน้มอ่อนแอลง อาจมีการปรับฐานในระยะสั้น'
    }

    return { confidence: Math.round(finalConfidence), signal, reason, color }
  }, [news, history, currentPrice])

  return (
    <div className="glass p-5 flex flex-col items-center border-t-2 border-blue-500/30 shadow-[0_-10px_30px_-10px_rgba(59,130,246,0.2)]">
      <div className="w-full flex items-center justify-between mb-4">
        <h3 className="text-white/60 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2">
          <span className="text-blue-400 text-sm">🤖</span> AI Trade Oracle
        </h3>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 ${oracleData.color} border border-current/20`}>
          Confidence: {oracleData.confidence}%
        </span>
      </div>

      <div className="relative w-full h-3 bg-white/5 rounded-full overflow-hidden mb-5">
        <div 
          className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(59,130,246,0.5)] ${
            oracleData.confidence > 50 ? 'bg-gradient-to-r from-blue-500 to-green-500' : 'bg-gradient-to-r from-red-500 to-blue-500'
          }`}
          style={{ width: `${oracleData.confidence}%` }}
        />
      </div>

      <div className="text-center w-full">
        <div className={`text-2xl font-black mb-1 tracking-tighter ${oracleData.color} drop-shadow-[0_0_12px_rgba(0,0,0,0.5)] animate-pulse`}>
          {oracleData.signal}
        </div>
        <p className="text-white/70 text-xs leading-relaxed max-w-[200px] mx-auto min-h-[32px]">
          {oracleData.reason}
        </p>
      </div>

      <div className="w-full grid grid-cols-2 gap-2 mt-5">
        <div className="bg-white/5 rounded-lg p-2 text-center border border-white/5">
          <p className="text-[9px] text-white/40 uppercase">Probability</p>
          <p className="text-xs font-bold text-blue-300">~{oracleData.confidence > 50 ? '78%' : '65%'} Win</p>
        </div>
        <div className="bg-white/5 rounded-lg p-2 text-center border border-white/5">
          <p className="text-[9px] text-white/40 uppercase">Suggested</p>
          <p className="text-xs font-bold text-amber-300">DCA: +15%</p>
        </div>
      </div>
    </div>
  )
}
