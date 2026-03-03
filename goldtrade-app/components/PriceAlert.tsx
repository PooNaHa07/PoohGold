'use client'

import { useState, useEffect, useCallback } from 'react'
import type { GoldPrice } from '@/types'

interface PriceAlertProps {
  currentPrice: GoldPrice | null
}

interface Alert {
  id: string
  type: 'high' | 'low'
  targetPrice: number
  triggered: boolean
  label: string
}

export default function PriceAlert({ currentPrice }: PriceAlertProps) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [highInput, setHighInput] = useState('')
  const [lowInput, setLowInput] = useState('')
  const [lastTriggered, setLastTriggered] = useState<string | null>(null)

  // โหลด alerts จาก localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('goldAlerts')
      if (saved) setAlerts(JSON.parse(saved))
    } catch {}
  }, [])

  // บันทึกลง localStorage เมื่อ alerts เปลี่ยน
  useEffect(() => {
    localStorage.setItem('goldAlerts', JSON.stringify(alerts))
  }, [alerts])

  // เล่นเสียง alert (Web Audio API)
  const playAlert = useCallback((type: 'high' | 'low') => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g)
      g.connect(ctx.destination)
      o.frequency.value = type === 'high' ? 880 : 440
      o.type = 'sine'
      g.gain.setValueAtTime(0.3, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
      o.start(ctx.currentTime)
      o.stop(ctx.currentTime + 0.8)
    } catch {}
  }, [])

  // เช็ค alerts เมื่อราคาเปลี่ยน
  useEffect(() => {
    if (!currentPrice) return
    const price = currentPrice.calculated_thai_gold

    setAlerts((prev) =>
      prev.map((alert) => {
        if (alert.triggered) return alert
        const hit =
          (alert.type === 'high' && price >= alert.targetPrice) ||
          (alert.type === 'low' && price <= alert.targetPrice)
        if (hit) {
          playAlert(alert.type)
          setLastTriggered(alert.label)
          setTimeout(() => setLastTriggered(null), 5000)
          return { ...alert, triggered: true }
        }
        return alert
      })
    )
  }, [currentPrice, playAlert])

  const addAlert = (type: 'high' | 'low') => {
    const val = type === 'high' ? parseFloat(highInput) : parseFloat(lowInput)
    if (!val || isNaN(val)) return
    const newAlert: Alert = {
      id: Date.now().toString(),
      type,
      targetPrice: val,
      triggered: false,
      label: `${type === 'high' ? '▲' : '▼'} ฿${val.toLocaleString('th-TH')}`,
    }
    setAlerts((prev) => [...prev, newAlert])
    if (type === 'high') setHighInput('')
    else setLowInput('')
  }

  const removeAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  const resetAlert = (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, triggered: false } : a)))
  }

  return (
    <div className="glass p-5">
      <h2 className="text-white font-semibold text-base mb-4">🔔 ตั้งเตือนราคา</h2>

      {/* Toast Notification */}
      {lastTriggered && (
        <div className="mb-4 p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-sm font-medium animate-pulse">
          🔔 ราคาถึงเป้า: {lastTriggered}
        </div>
      )}

      {/* Input Section */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* High Alert */}
        <div>
          <label className="text-white/50 text-xs mb-1.5 block">แจ้งเมื่อสูงกว่า ▲</label>
          <div className="flex gap-1">
            <input
              type="number"
              placeholder={currentPrice ? `> ${(currentPrice.calculated_thai_gold + 200).toFixed(0)}` : '฿'}
              value={highInput}
              onChange={(e) => setHighInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addAlert('high')}
              className="glass-input text-xs flex-1"
            />
            <button
              onClick={() => addAlert('high')}
              className="px-2.5 py-1.5 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-bold hover:bg-green-500/30 transition-colors"
            >
              +
            </button>
          </div>
        </div>

        {/* Low Alert */}
        <div>
          <label className="text-white/50 text-xs mb-1.5 block">แจ้งเมื่อต่ำกว่า ▼</label>
          <div className="flex gap-1">
            <input
              type="number"
              placeholder={currentPrice ? `< ${(currentPrice.calculated_thai_gold - 200).toFixed(0)}` : '฿'}
              value={lowInput}
              onChange={(e) => setLowInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addAlert('low')}
              className="glass-input text-xs flex-1"
            />
            <button
              onClick={() => addAlert('low')}
              className="px-2.5 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/30 transition-colors"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Alert List */}
      {alerts.length === 0 ? (
        <p className="text-white/20 text-xs text-center py-3">ยังไม่มีการตั้งเตือน</p>
      ) : (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${
                alert.triggered
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                  : alert.type === 'high'
                  ? 'border-green-500/20 bg-green-500/5 text-green-300'
                  : 'border-red-500/20 bg-red-500/5 text-red-300'
              }`}
            >
              <span className="font-medium">{alert.label}</span>
              <div className="flex items-center gap-1.5">
                {alert.triggered && (
                  <span className="text-amber-400 text-xs">🔔 ถึงแล้ว!</span>
                )}
                {alert.triggered && (
                  <button
                    onClick={() => resetAlert(alert.id)}
                    className="text-white/30 hover:text-white/60 transition-colors text-xs px-1"
                    title="รีเซ็ต"
                  >
                    ↺
                  </button>
                )}
                <button
                  onClick={() => removeAlert(alert.id)}
                  className="text-white/30 hover:text-red-400 transition-colors"
                  title="ลบ"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
