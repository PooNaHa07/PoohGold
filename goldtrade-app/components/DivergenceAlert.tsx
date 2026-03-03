'use client'

import { useMemo } from 'react'
import { GoldPrice, NewsItem } from '@/types'

interface DivergenceAlertProps {
  currentPrice: GoldPrice | null
  prevPrice: GoldPrice | null
  news: NewsItem[]
}

export default function DivergenceAlert({ currentPrice, prevPrice, news }: DivergenceAlertProps) {
  const alert = useMemo(() => {
    if (!currentPrice || !prevPrice || news.length === 0) return null

    // 1. Get price trend (last update)
    const priceDiff = currentPrice.calculated_thai_gold - prevPrice.calculated_thai_gold
    const isPriceFalling = priceDiff < -10 // Threshold for significant move
    const isPriceRising = priceDiff > 10

    // 2. Get latest news impact (within 1 hour)
    const now = new Date()
    const latestNews = news.filter(n => {
      const pubDate = new Date(n.published_at)
      return (now.getTime() - pubDate.getTime()) < 60 * 60 * 1000
    })

    if (latestNews.length === 0) return null

    const hasBullishNews = latestNews.some(n => n.impact_type === 'bullish')
    const hasBearishNews = latestNews.some(n => n.impact_type === 'bearish')

    // 3. Detect Divergence
    if (hasBullishNews && isPriceFalling) {
      return {
        type: 'bullish_divergence',
        title: '⚠️ ตลาดสวนทาง (Bullish Divergence)',
        message: 'มีข่าวเชิงบวกต่อทองคำ แต่ราคากลับลดลง เป็นโอกาสพิจารณาช้อนซื้อ!',
        color: 'border-green-500 bg-green-500/10 text-green-400'
      }
    }

    if (hasBearishNews && isPriceRising) {
      return {
        type: 'bearish_divergence',
        title: '⚠️ ตลาดสวนทาง (Bearish Divergence)',
        message: 'มีข่าวเชิงลบต่อทองคำ แต่ราคากลับสูงขึ้น ระวังแรงเทขายทำกำไร!',
        color: 'border-red-500 bg-red-500/10 text-red-400'
      }
    }

    return null
  }, [currentPrice, prevPrice, news])

  if (!alert) return null

  return (
    <div className={`p-4 rounded-2xl border-2 mb-6 flex items-center gap-4 transition-all duration-500 shadow-lg ${alert.color} overflow-hidden relative group`}>
      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-white/10 text-2xl animate-pulse">
        {alert.type === 'bullish_divergence' ? '🚀' : '⚠️'}
      </div>
      <div className="relative z-10 border-l border-white/10 pl-4">
        <h4 className="font-black text-sm uppercase tracking-tighter">{alert.title}</h4>
        <p className="text-xs font-medium opacity-90 leading-relaxed mt-0.5">{alert.message}</p>
      </div>
      <div className="ml-auto opacity-20 text-4xl font-black italic select-none">
        SIGNAL
      </div>
    </div>
  )
}
