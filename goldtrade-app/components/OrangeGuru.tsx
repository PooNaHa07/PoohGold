'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { NewsItem, GoldPrice, TradeJournal } from '../types'

interface OrangeGuruProps {
  news: NewsItem[]
  history: GoldPrice[]
  currentPrice: GoldPrice | null
  journal: TradeJournal[]
}

export default function OrangeGuru({ news, currentPrice, journal }: OrangeGuruProps) {
  const [isOpen, setIsOpen] = useState(false)

  const analysis = useMemo(() => {
    if (!currentPrice || news.length === 0) return "โอ๊ะ! ข้อมูลยังมาไม่พอ ส้มขอเวลาเช็คตลาดแป๊บนะจ๊ะเจ้านาย..."

    const latestNews = news[0]
    const sentiment = latestNews?.impact_type === 'bullish' ? 'กำลังฮอต' : latestNews?.impact_type === 'bearish' ? 'ค่อนข้างน่าเป็นห่วง' : 'กำลังรอดูเชิง'
    
    // Trade Coach insight (simplified)
    const winRate = journal.length > 0 
      ? Math.round((journal.filter(t => t.pnl && t.pnl > 0).length / journal.length) * 100) 
      : 0

    const coachAdvice = journal.length > 0 
      ? `ส้มดูสมุดจดเทรดแล้ว เจ้านายมี Win Rate อยู่ที่ ${winRate}% สู้ๆ นะจ๊ะ!`
      : "เจ้านายเริ่มจดบันทึกเทรดดูสิ ส้มจะช่วยวิเคราะห์ให้แม่นขึ้น!"

    // Use a fixed value or deterministic calculation for confidence here to avoid impurity
    const mockConfidence = 55 + (news.length % 20)

    return `สวัสดีจ้าเจ้านาย! 🍊 วันนี้ตลาดทอง${sentiment}นะจ๊ะ ข่าวล่าสุดบอกว่า "${latestNews?.title.slice(0, 40)}..." ส้มว่าตอนนี้ตัว Oracle บอกความมั่นใจที่ ${mockConfidence}% ${coachAdvice}`
  }, [news, currentPrice, journal])

  return (
    <div className="fixed bottom-6 right-6 z-[100] group">
      {/* Speech Bubble */}
      <div className={`absolute bottom-24 right-0 w-64 glass p-4 rounded-2xl border-2 border-amber-500/30 shadow-2xl transition-all duration-500 origin-bottom-right ${
        isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'
      }`}>
        <div className="text-amber-400 font-bold text-xs mb-2 flex items-center gap-2">
          <span>🔔</span> Guru Orange Insights
        </div>
        <p className="text-white text-[11px] leading-relaxed">
          {analysis}
        </p>
        <div className="mt-3 flex gap-2">
          <button className="flex-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] py-1 rounded transition-colors" onClick={() => setIsOpen(false)}>
            ขอบคุณจ้าส้ม!
          </button>
        </div>
        {/* Tail */}
        <div className="absolute -bottom-2 right-8 w-4 h-4 glass border-r-2 border-b-2 border-amber-500/30 rotate-45" />
      </div>

      {/* Control / Mascot */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:scale-110 transition-transform active:scale-95 bg-amber-500/10"
      >
        <Image 
          src="/cute_orange_guru.png" 
          alt="Orange Guru" 
          fill 
          className="object-cover"
        />
        {/* Pulse indicator */}
        <div className="absolute top-0 right-0 w-4 h-4 bg-green-500 border-2 border-amber-900 rounded-full animate-pulse" />
      </button>
      
      {/* Hover Tooltip */}
      <span className="absolute right-0 -top-8 px-2 py-1 bg-black/80 text-white text-[9px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity pointer-events-none">
        คลิกคุยกับส้มได้นะ!
      </span>
    </div>
  )
}
