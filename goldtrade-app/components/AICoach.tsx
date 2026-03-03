'use client'

import { useMemo } from 'react'
import { TradeJournal } from '../types'

interface AICoachProps {
  journal: TradeJournal[]
}

export default function AICoach({ journal }: AICoachProps) {
  const insight = useMemo(() => {
    if (journal.length === 0) {
      return { 
        title: 'เริ่มต้นบันทึกการเทรด', 
        advice: 'บันทึกการเทรดครั้งแรกของคุณเพื่อให้ AI ช่วยวิเคราะห์พฤติกรรมการเล่น',
        score: 'N/A'
      }
    }

    const wins = journal.filter(t => t.pnl && t.pnl > 0).length
    const winRate = Math.round((wins / journal.length) * 100)
    
    // Analyze patterns (Mock logic for demonstration)
    let advice = 'คุณทำได้ดีแล้ว! รักษาพอนัยและวินัยในการเทรดต่อไป'
    let title = 'วินัยการเทรดดีเยี่ยม'
    
    if (winRate < 50) {
      title = 'ควรปรับกลยุทธ์การเข้าซื้อ'
      advice = 'สถิติชี้ว่าคุณมักจะเข้าซื้อในช่วงที่ราคากำลังผันผวนสูง ลองรอจังหวะที่ RSI นิ่งกว่านี้'
    } else if (journal.length > 5 && winRate > 70) {
      title = 'Master of Timing'
      advice = 'คุณมีความแม่นยำสูงในการเลือกจุดกลับตัว ลองพิจารณาเพิ่มขนาด Lot เล็กน้อยในไม้ที่มั่นใจ'
    }

    return { title, advice, score: `${winRate}% Win Rate` }
  }, [journal])

  return (
    <div className="glass p-5 flex flex-col items-center border-t-2 border-purple-500/30 shadow-[0_-10px_30px_-10px_rgba(168,85,247,0.2)]">
      <div className="w-full flex items-center justify-between mb-3">
        <h3 className="text-white/60 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2">
          <span className="text-purple-400 text-sm">💡</span> AI Personal Coach
        </h3>
        <span className="text-[9px] font-mono text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
          {insight.score}
        </span>
      </div>

      <div className="w-full bg-gradient-to-br from-purple-500/10 to-transparent p-4 rounded-xl border border-purple-500/10">
        <h4 className="text-sm font-bold text-white mb-1">{insight.title}</h4>
        <p className="text-[11px] text-white/60 leading-relaxed italic">
          "{insight.advice}"
        </p>
      </div>

      <div className="w-full mt-4 flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        <span className="text-[8px] whitespace-nowrap bg-white/5 border border-white/10 text-white/40 px-2 py-1 rounded-full">#วินัยดี</span>
        <span className="text-[8px] whitespace-nowrap bg-white/5 border border-white/10 text-white/40 px-2 py-1 rounded-full">#RSI_Master</span>
        <span className="text-[8px] whitespace-nowrap bg-white/5 border border-white/10 text-white/40 px-2 py-1 rounded-full">#เน้นระยะสั้น</span>
      </div>
    </div>
  )
}
