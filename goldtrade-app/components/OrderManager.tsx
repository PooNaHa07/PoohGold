'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { GoldPrice, LimitOrder } from '@/types'

interface OrderManagerProps {
  currentPrice: GoldPrice | null
}

interface Alert {
  id: string
  goldType: '96.5%' | '99.99%'
  type: 'high' | 'low'
  targetPrice: number
  triggered: boolean
}

type AudioContextType = typeof window.AudioContext | (typeof window.AudioContext & { webkitAudioContext: typeof window.AudioContext })


export default function OrderManager({ currentPrice }: OrderManagerProps) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [limitOrders, setLimitOrders] = useState<LimitOrder[]>([])
  const [activeTab, setActiveTab] = useState<'alerts' | 'limit'>('alerts')
  
  // Form states
  const [alertForm, setAlertForm] = useState({ price: '', type: 'high' as 'high' | 'low', goldType: '96.5%' as '96.5%' | '99.99%' })
  const [limitForm, setLimitForm] = useState({ price: '', action: 'ซื้อ' as 'ซื้อ' | 'ขาย', goldType: '96.5%' as '96.5%' | '99.99%', volume: '1' })
  
  const [lastTriggered, setLastTriggered] = useState<string | null>(null)

  // 1. Load data
  useEffect(() => {
    // Load alerts (localStorage)
    const savedAlerts = localStorage.getItem('goldAlerts')
    if (savedAlerts) setAlerts(JSON.parse(savedAlerts))

    // Load limit orders (Supabase)
    const fetchLimitOrders = async () => {
      const { data } = await supabase
        .from('limit_orders')
        .select('*')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
      if (data) setLimitOrders(data)
    }
    fetchLimitOrders()

    // Realtime subscription for limit orders
    const channel = supabase.channel('limit-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'limit_orders' }, () => {
        fetchLimitOrders()
      })
      .subscribe()
    
    return () => { supabase.removeChannel(channel) }
  }, [])

  // 2. Sync alerts to localStorage
  useEffect(() => {
    localStorage.setItem('goldAlerts', JSON.stringify(alerts))
  }, [alerts])

  // 3. Audio Alert
  const playAlert = useCallback(() => {
    try {
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext
      const ctx = new AudioCtx()
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value = 880; o.type = 'sine'
      g.gain.setValueAtTime(0.3, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
      o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.8)
    } catch {}
  }, [])

  // 4. Execution Engine (Frontend fallback check)
  useEffect(() => {
    if (!currentPrice) return
    
    // Check Alerts
    setAlerts(prev => {
      let changed = false
      const next = prev.map(a => {
        if (a.triggered) return a
        const price = a.goldType === '99.99%' ? currentPrice.calculated_gold_9999 : currentPrice.calculated_thai_gold
        const hit = (a.type === 'high' && price >= a.targetPrice) || (a.type === 'low' && price <= a.targetPrice)
        if (hit) {
          changed = true
          // Use setTimeout for notification and sound to avoid blocking render
          setTimeout(() => {
            playAlert()
            setLastTriggered(`แจ้งเตือน: ${a.goldType} ${a.type === 'high' ? '▲' : '▼'} ฿${a.targetPrice.toLocaleString()}`)
            setTimeout(() => setLastTriggered(null), 5000)
          }, 0)
          return { ...a, triggered: true }
        }
        return a
      })
      return changed ? next : prev
    })

    // Check Limit Orders
    const checkLimitOrders = async () => {
      const pendingOrders = limitOrders.filter(o => o.status === 'pending')
      for (const order of pendingOrders) {
        const price = order.gold_type === '99.99%' ? currentPrice.calculated_gold_9999 : currentPrice.calculated_thai_gold
        
        // condition: Buy if price <= target, Sell if price >= target
        const hit = (order.action === 'ซื้อ' && price <= order.target_price) || 
                    (order.action === 'ขาย' && price >= order.target_price)
        
        if (hit) {
          // 1. Update status
          await supabase.from('limit_orders').update({ status: 'executed' }).eq('id', order.id)
          // 2. Insert into trade_journal
          await supabase.from('trade_journal').insert({
            action: order.action,
            gold_type: order.gold_type,
            entry_price: order.target_price,
            lot_size_baht: order.lot_size_baht,
            status: 'เปิด',
            notes: `Auto-Executed from Limit Order #${order.id.slice(0, 4)}`
          })
          
          setLastTriggered(`🤖 ออเดอร์ ${order.action} ${order.gold_type} ถูกสั่งงานแล้วที่ ฿${order.target_price.toLocaleString()}`)
          setTimeout(() => setLastTriggered(null), 7000)
          playAlert()
        }
      }
    }
    
    checkLimitOrders()
  }, [currentPrice, limitOrders, playAlert])

  // Handlers
  const addAlert = () => {
    const p = parseFloat(alertForm.price)
    if (!p) return
    const newAlert: Alert = {
      id: Date.now().toString(),
      goldType: alertForm.goldType,
      type: alertForm.type,
      targetPrice: p,
      triggered: false
    }
    setAlerts(prev => [...prev, newAlert])
    setAlertForm(prev => ({ ...prev, price: '' }))
  }

  const addLimitOrder = async () => {
    const p = parseFloat(limitForm.price)
    const v = parseFloat(limitForm.volume)
    if (!p || !v) return
    
    const { error } = await supabase.from('limit_orders').insert({
      action: limitForm.action,
      gold_type: limitForm.goldType,
      target_price: p,
      lot_size_baht: v,
      status: 'pending'
    })
    
    if (!error) {
      setLimitForm(prev => ({ ...prev, price: '' }))
    }
  }

  return (
    <div className="glass p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold text-base flex items-center gap-2">
          {activeTab === 'alerts' ? '🔔 แจ้งเตือนราคา' : '🤖 ออเดอร์ล่วงหน้า'}
        </h2>
        <div className="flex bg-white/5 p-1 rounded-lg">
          <button onClick={() => setActiveTab('alerts')} className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold transition-all ${activeTab === 'alerts' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'}`}>Alerts</button>
          <button onClick={() => setActiveTab('limit')} className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold transition-all ${activeTab === 'limit' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'}`}>Limit</button>
        </div>
      </div>

      {lastTriggered && (
        <div className="mb-4 p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] leading-tight font-medium animate-pulse">
          {lastTriggered}
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'alerts' ? (
          <>
            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-2 gap-2">
                <select 
                  value={alertForm.goldType} 
                  onChange={e => setAlertForm(p => ({ ...p, goldType: e.target.value as any }))}
                  className="glass-input text-[10px] py-1.5"
                >
                  <option value="96.5%">ทอง 96.5%</option>
                  <option value="99.99%">ทอง 99.99%</option>
                </select>
                <select 
                  value={alertForm.type} 
                  onChange={e => setAlertForm(p => ({ ...p, type: e.target.value as any }))}
                  className="glass-input text-[10px] py-1.5"
                >
                  <option value="high">สูงกว่า ▲</option>
                  <option value="low">ต่ำกว่า ▼</option>
                </select>
              </div>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  placeholder="ใส่ราคาเป้าหมาย..."
                  value={alertForm.price}
                  onChange={e => setAlertForm(p => ({ ...p, price: e.target.value }))}
                  className="glass-input text-xs flex-1"
                />
                <button onClick={addAlert} className="px-4 py-2 rounded-lg bg-amber-500 text-black text-[10px] font-bold">เพิ่ม</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {alerts.length === 0 ? (
                <p className="text-white/20 text-xs text-center py-6">ยังไม่มีการตั้งเตือน</p>
              ) : (
                alerts.map(a => (
                  <div key={a.id} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-[10px] ${a.triggered ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-white/5 bg-white/5 text-white/60'}`}>
                    <span>{a.goldType} • {a.type === 'high' ? '▲' : '▼'} ฿{a.targetPrice.toLocaleString()}</span>
                    <div className="flex items-center gap-2">
                      {a.triggered && (
                  <button
                    onClick={() => setAlerts(prev => prev.map(x => (x.id === a.id ? { ...x, triggered: false } : x)))}
                    className="text-white/30 hover:text-white/60 transition-colors text-xs px-1"
                    title="รีเซ็ต"
                  >
                    ↺
                  </button>
                )}
                      <button onClick={() => setAlerts(prev => prev.filter(x => x.id !== a.id))} className="text-white/20 hover:text-red-400">✕</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-2 gap-2">
                <select 
                  value={limitForm.goldType} 
                  onChange={e => setLimitForm(p => ({ ...p, goldType: e.target.value as any }))}
                  className="glass-input text-[10px] py-1.5"
                >
                  <option value="96.5%">ทอง 96.5%</option>
                  <option value="99.99%">ทอง 99.99%</option>
                </select>
                <select 
                  value={limitForm.action} 
                  onChange={e => setLimitForm(p => ({ ...p, action: e.target.value as any }))}
                  className="glass-input text-[10px] py-1.5"
                >
                  <option value="ซื้อ">สั่งซื้อ 🟢</option>
                  <option value="ขาย">สั่งขาย 🔴</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input 
                  type="number" 
                  placeholder="ราคาเป้าหมาย"
                  value={limitForm.price}
                  onChange={e => setLimitForm(p => ({ ...p, price: e.target.value }))}
                  className="glass-input text-xs"
                />
                <input 
                  type="number" 
                  placeholder="จำนวน (บาท)"
                  value={limitForm.volume}
                  onChange={e => setLimitForm(p => ({ ...p, volume: e.target.value }))}
                  className="glass-input text-xs"
                />
              </div>
              <button onClick={addLimitOrder} className="w-full py-2 rounded-lg bg-blue-500 text-white text-[10px] font-bold shadow-lg shadow-blue-500/20">ตั้งออเดอร์ล่วงหน้า</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {limitOrders.length === 0 ? (
                <p className="text-white/20 text-xs text-center py-6">ยังไม่มีออเดอร์ล่วงหน้า</p>
              ) : (
                limitOrders.map(o => (
                  <div key={o.id} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-[10px] ${o.status === 'executed' ? 'border-green-500/30 bg-green-500/10 text-green-300' : 'border-white/5 bg-white/5 text-white/60'}`}>
                    <div className="flex flex-col">
                      <span className="font-bold">{o.action} {o.lot_size_baht} บาท ({o.gold_type})</span>
                      <span>ที่ราคา ฿{o.target_price.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] ${o.status === 'executed' ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/30'}`}>
                        {o.status === 'executed' ? 'สำเร็จ' : 'รอราคา'}
                      </span>
                      {o.status === 'pending' && (
                        <button onClick={async () => await supabase.from('limit_orders').update({ status: 'cancelled' }).eq('id', o.id)} className="text-white/20 hover:text-red-400">✕</button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
