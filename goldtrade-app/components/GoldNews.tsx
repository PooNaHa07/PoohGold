'use client'

import { NewsItem } from '@/types'

interface GoldNewsProps {
  news: NewsItem[]
}

export default function GoldNews({ news }: GoldNewsProps) {
  return (
    <div className="glass p-6 flex flex-col overflow-hidden">
      <div className="mb-4 flex items-center justify-between flex-shrink-0">
        <h2 className="text-white font-semibold text-lg flex items-center gap-2">
          <span className="text-xl">📰</span> ข่าวกรองราคาทอง
        </h2>
        <span className="text-[10px] text-white/30 uppercase tracking-widest">Live Updates</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
        {news.length === 0 ? (
          <div className="text-center py-10 text-white/20 text-xs">
            ไม่พบข่าวสารในขณะนี้...
          </div>
        ) : (
          news.map((item) => (
            <a 
              key={item.id} 
              href={item.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] font-bold text-amber-500/80 uppercase">{item.source}</span>
                <div className="flex items-center gap-2">
                  {item.impact_type === 'bullish' && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-bold">🟢 BULLISH</span>
                  )}
                  {item.impact_type === 'bearish' && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">🔴 BEARISH</span>
                  )}
                  <span className="text-[9px] text-white/30">
                    {new Date(item.published_at).toLocaleString('th-TH', { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      day: 'numeric',
                      month: 'short'
                    })}
                  </span>
                </div>
              </div>
              <h3 className="text-white text-xs font-semibold mb-1 group-hover:text-amber-400 transition-colors line-clamp-2 leading-snug">
                {item.title}
              </h3>
              {item.impact_summary && (
                <div className="mb-2 p-2 rounded-lg bg-white/5 border-l-2 border-amber-500/50">
                  <p className="text-[10px] text-amber-200/80 leading-relaxed font-medium">
                    🔍 วิเคราะห์: {item.impact_summary}
                  </p>
                </div>
              )}
              <p className="text-white/40 text-[10px] line-clamp-1 leading-relaxed italic">
                {item.snippet}
              </p>
            </a>
          ))
        )}
      </div>
    </div>
  )
}
