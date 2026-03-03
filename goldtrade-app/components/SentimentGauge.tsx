'use client'

import { useMemo } from 'react'
import { NewsItem } from '@/types'

interface SentimentGaugeProps {
  news: NewsItem[]
}

export default function SentimentGauge({ news }: SentimentGaugeProps) {
  const sentiment = useMemo(() => {
    if (news.length === 0) return { score: 0, label: 'Neutral', color: 'text-white/40', bg: 'bg-white/5', title: 'ไม่มีข้อมูลข่าว', count: 0 }
    
    // Use only the latest 10 news items for a "current" state
    const targetNews = news.slice(0, 10)
    
    let totalScore = 0
    let totalWeight = 0
    
    targetNews.forEach((n, i) => {
      // Weight: first 3 items (latest) get double weight
      const weight = i < 3 ? 2 : 1
      
      let itemScore = 0
      if (n.impact_type === 'bullish') itemScore = 1
      if (n.impact_type === 'bearish') itemScore = -1
      
      totalScore += itemScore * weight
      totalWeight += weight
    })

    const avgScore = totalScore / totalWeight
    
    if (avgScore > 0.15) return { score: avgScore, label: 'Bullish', color: 'text-green-400', bg: 'bg-green-500/10', title: 'แรงซื้อหนุน', count: targetNews.length }
    if (avgScore < -0.15) return { score: avgScore, label: 'Bearish', color: 'text-red-400', bg: 'bg-red-500/10', title: 'แรงขายกดดัน', count: targetNews.length }
    return { score: avgScore, label: 'Neutral', color: 'text-amber-400', bg: 'bg-amber-500/10', title: 'ตลาดรอเลือกทาง', count: targetNews.length }
  }, [news])

  // Scale score (-1 to 1) to rotation (0 to 180 deg)
  // -1 -> 0 deg, 0 -> 90 deg, 1 -> 180 deg
  const rotation = ((sentiment.score + 1) / 2) * 180

  return (
    <div className={`glass p-4 flex flex-col items-center justify-between border-t-2 transition-colors duration-500 min-h-[180px] ${
      sentiment.label === 'Bullish' ? 'border-green-500/50 shadow-[0_-10px_30px_-10px_rgba(74,222,128,0.2)]' : 
      sentiment.label === 'Bearish' ? 'border-red-500/50 shadow-[0_-10px_30px_-10px_rgba(248,113,113,0.2)]' : 
      'border-amber-500/50 shadow-[0_-10px_30px_-10px_rgba(251,191,36,0.2)]'
    }`}>
      <div className="w-full flex items-center justify-between mb-4">
        <h3 className="text-white/60 text-[10px] font-bold uppercase tracking-wider">Market Sentiment</h3>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${sentiment.bg} ${sentiment.color} animate-pulse`}>
          {sentiment.label}
        </span>
      </div>
      
      <div className="relative w-36 h-20 flex items-center justify-center overflow-hidden">
        {/* SVG Semi-Circle Gauge */}
        <svg viewBox="0 0 100 50" className="w-full h-full overflow-visible">
          {/* Background Track */}
          <path 
            d="M 10 50 A 40 40 0 0 1 90 50" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="8" 
            className="text-white/5"
            strokeLinecap="round"
          />
          {/* Active Gradient Path */}
          <path 
            d="M 10 50 A 40 40 0 0 1 90 50" 
            fill="none" 
            stroke="url(#sentimentGradient)" 
            strokeWidth="8" 
            strokeLinecap="round"
            className="opacity-20"
          />
          <defs>
            <linearGradient id="sentimentGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="50%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#4ade80" />
            </linearGradient>
          </defs>
        </svg>

        {/* Needle */}
        <div 
          className="absolute bottom-1 left-1/2 w-1.5 h-16 origin-bottom -translate-x-1/2 transition-all duration-1000 cubic-bezier(0.34, 1.56, 0.64, 1) z-10"
          style={{ transform: `translateX(-50%) rotate(${rotation - 90}deg)` }}
        >
          <div className="w-full h-full bg-gradient-to-t from-white to-transparent rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
        </div>
        
        {/* Center Cap */}
        <div className="absolute bottom-0 left-1/2 w-4 h-4 bg-white rounded-full -translate-x-1/2 translate-y-1/2 z-20 shadow-lg" />
      </div>

      <div className="text-center mt-3">
        <p className={`text-base font-bold ${sentiment.color} drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]`}>{sentiment.title}</p>
        <p className="text-white/30 text-[9px] mt-1 italic leading-tight">
          วิเคราะห์ถ่วงน้ำหนักจาก {sentiment.count} ข่าวล่าสุด
        </p>
      </div>
    </div>
  )
}
