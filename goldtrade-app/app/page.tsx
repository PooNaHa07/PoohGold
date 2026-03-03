'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef, useCallback, Suspense, lazy } from 'react'
import { supabase } from '@/lib/supabase'
import type { GoldPrice, TradeJournal, TradeFormData } from '@/types'
import SignalPanel from '@/components/SignalPanel'
import OrderManager from '@/components/OrderManager'
import DCASimulator from '@/components/DCASimulator'
import BottomNav from '@/components/BottomNav'

// Lazy load chart (heavy lib)
const PriceChart = lazy(() => import('@/components/PriceChart'))

// ============================================================
// Helpers
// ============================================================
function PriceValue({
  value, flashClass, prefix = '', suffix = '', decimals = 2, size = 'xl',
}: { value: number | null; flashClass: string; prefix?: string; suffix?: string; decimals?: number; size?: 'xl' | '2xl' | '3xl' }) {
  const sizeClass =
    size === '3xl' ? 'text-4xl md:text-5xl font-bold' :
    size === '2xl' ? 'text-3xl md:text-4xl font-bold' :
    'text-2xl font-semibold'
  if (value === null) return <span className={`${sizeClass} text-white/30 animate-pulse`}>---</span>
  return (
    <span className={`${sizeClass} text-white ${flashClass} transition-colors duration-300 inline-block`}>
      {prefix}{value.toLocaleString('th-TH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </span>
  )
}

function TrendBadge({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'flat') return null
  const up = trend === 'up'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${up ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
      {up ? '▲' : '▼'} {up ? 'สูงขึ้น' : 'ลดลง'}
    </span>
  )
}

// คำนวณ Unrealized P&L
function calcPnL(trade: TradeJournal, currentPrice: GoldPrice): number {
  const price = trade.gold_type === '99.99%' ? currentPrice.calculated_gold_9999 : currentPrice.calculated_thai_gold
  const direction = trade.action === 'ซื้อ' ? 1 : -1
  return (price - trade.entry_price) * trade.lot_size_baht * direction
}

// ============================================================
// Main
// ============================================================
export default function Dashboard() {
  const [currentPrice, setCurrentPrice] = useState<GoldPrice | null>(null)
  const [prevPrice, setPrevPrice] = useState<GoldPrice | null>(null)
  const [priceHistory, setPriceHistory] = useState<GoldPrice[]>([])
  const [flashClass, setFlashClass] = useState('')
  const [priceFlashClass, setPriceFlashClass] = useState('')
  const [trades, setTrades] = useState<TradeJournal[]>([])
  const [formData, setFormData] = useState<TradeFormData>({
    action: 'ซื้อ',
    gold_type: '96.5%',
    entry_price: '',
    lot_size_baht: '',
    notes: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [selectedGoldType, setSelectedGoldType] = useState<'96.5%' | '99.99%'>('96.5%')
  const [lastUpdateTime, setLastUpdateTime] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const trend: 'up' | 'down' | 'flat' = (() => {
    if (!currentPrice || !prevPrice) return 'flat'
    const curr = selectedGoldType === '99.99%' ? currentPrice.calculated_gold_9999 : currentPrice.calculated_thai_gold
    const prev = selectedGoldType === '99.99%' ? prevPrice.calculated_gold_9999 : prevPrice.calculated_thai_gold
    if (curr > prev) return 'up'
    if (curr < prev) return 'down'
    return 'flat'
  })()

  const triggerFlash = useCallback((direction: 'up' | 'down') => {
    clearTimeout(flashTimeout.current)
    setFlashClass(direction === 'up' ? 'flash-green' : 'flash-red')
    setPriceFlashClass(direction === 'up' ? 'price-up' : 'price-down')
    flashTimeout.current = setTimeout(() => { setFlashClass(''); setPriceFlashClass('') }, 900)
  }, [])

  // โหลดข้อมูลเริ่มต้น
  useEffect(() => {
    const load = async () => {
      const { data: prices } = await supabase
        .from('gold_prices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      if (prices && prices.length > 0) {
        setCurrentPrice(prices[0])
        if (prices.length > 1) setPrevPrice(prices[1])
        setPriceHistory(prices)
        setLastUpdateTime(new Date(prices[0].created_at).toLocaleTimeString('th-TH'))
      }
      const { data: tradeData } = await supabase
        .from('trade_journal')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      if (tradeData) setTrades(tradeData)
    }
    load()
  }, [])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('gold-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gold_prices' }, (payload) => {
        const newRow = payload.new as GoldPrice
        setPrevPrice((p) => p)
        setCurrentPrice((prev) => { setPrevPrice(prev); return newRow })
        setPriceHistory((prev) => [newRow, ...prev].slice(0, 200))
        setLastUpdateTime(new Date(newRow.created_at).toLocaleTimeString('th-TH'))
        setConnectionStatus('connected')
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConnectionStatus('connected')
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setConnectionStatus('error')
      })
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (trend !== 'flat') triggerFlash(trend)
  }, [currentPrice, trend, triggerFlash])

  const handleSubmitTrade = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.entry_price || !formData.lot_size_baht) return
    setSubmitting(true)
    try {
      const { data, error } = await supabase.from('trade_journal').insert({
        action: formData.action,
        gold_type: formData.gold_type,
        entry_price: parseFloat(formData.entry_price),
        lot_size_baht: parseFloat(formData.lot_size_baht),
        status: 'เปิด',
        pnl: 0,
        notes: formData.notes || null,
      }).select().single()
      if (!error && data) {
        setTrades((prev) => [data, ...prev])
        setFormData({ action: 'ซื้อ', gold_type: '96.5%', entry_price: '', lot_size_baht: '', notes: '' })
        setSubmitSuccess(true)
        setTimeout(() => setSubmitSuccess(false), 3000)
      }
    } finally { setSubmitting(false) }
  }

  const openTrades = trades.filter((t) => t.status === 'เปิด')
  const totalUnrealizedPnL = currentPrice
    ? openTrades.reduce((sum, t) => sum + calcPnL(t, currentPrice), 0)
    : 0

  return (
    <div className="bg-orbs min-h-screen relative">
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }}
      />
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">

        {/* ====== Header ====== */}
        <header id="home" className="mb-6 slide-up">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold gold-text">🥇 Pooh Dev Gold Analytics</h1>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-white/50 text-sm font-light">ระบบวิเคราะห์ทองคำ Real-time</p>
                <div className="flex bg-white/5 p-1 rounded-lg">
                  {(['96.5%', '99.99%'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setSelectedGoldType(type)}
                      className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                        selectedGoldType === type 
                        ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' 
                        : 'text-white/40 hover:text-white/60'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
              connectionStatus === 'connected' ? 'border-green-500/30 bg-green-500/10 text-green-400' :
              connectionStatus === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-400' :
              'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-400 live-dot' :
                connectionStatus === 'error' ? 'bg-red-400' : 'bg-yellow-400 animate-pulse'
              }`} />
              {connectionStatus === 'connected' ? 'เชื่อมต่อสำเร็จ' :
               connectionStatus === 'error' ? 'ขาดการเชื่อมต่อ' : 'กำลังเชื่อมต่อ...'}
            </div>
          </div>
        </header>

        {/* ====== Price Cards ====== */}
        <section className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 ${flashClass}`}>
          <div className="glass-strong p-6 md:col-span-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-20" style={{ background: 'radial-gradient(circle, #f5a623, transparent)' }} />
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white/60 text-sm font-medium">ราคาทองไทย {selectedGoldType}</span>
                <TrendBadge trend={trend} />
              </div>
              <div className={priceFlashClass}>
                <PriceValue 
                  value={currentPrice ? (selectedGoldType === '99.99%' ? currentPrice.calculated_gold_9999 : currentPrice.calculated_thai_gold) : null} 
                  flashClass="" prefix="฿" size="3xl" 
                />
              </div>
              <p className="text-white/40 text-xs mt-2">บาท / บาท (หน่วยน้ำหนัก)</p>
            </div>
          </div>
          <div className="glass p-5">
            <p className="text-white/50 text-xs mb-1">ราคาทองโลก</p>
            <p className="text-white/70 text-xs mb-2 font-mono">XAU/USD</p>
            <PriceValue value={currentPrice?.xauusd ?? null} flashClass="" prefix="$" size="xl" />
            <p className="text-white/40 text-xs mt-1">ต่อทรอยออนซ์</p>
          </div>
          <div className="glass p-5">
            <p className="text-white/50 text-xs mb-1">อัตราแลกเปลี่ยน</p>
            <p className="text-white/70 text-xs mb-2 font-mono">USD/THB</p>
            <PriceValue value={currentPrice?.usd_thb ?? null} flashClass="" size="xl" decimals={4} />
            <p className="text-white/40 text-xs mt-1">บาทต่อ 1 ดอลลาร์</p>
          </div>
        </section>

        {/* ====== สูตรคำนวณ ====== */}
        <section className="glass p-4 mb-4">
          <div className="flex items-center flex-wrap gap-2 text-sm">
            <span className="text-white/40 text-xs">สูตร:</span>
            <span className="font-mono bg-white/5 px-3 py-1 rounded-lg text-amber-300 text-xs">
              XAUUSD × USDTHB × {selectedGoldType === '99.99%' ? '0.4874' : '0.4729'}
            </span>
            <span className="text-white/40">+</span>
            <span className="font-mono bg-white/5 px-3 py-1 rounded-lg text-blue-300 text-xs">Premium (฿{currentPrice?.premium ?? 0})</span>
            <span className="text-white/40">=</span>
            <span className="font-mono bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-lg text-amber-400 font-semibold text-xs">
              ฿{currentPrice ? (selectedGoldType === '99.99%' ? currentPrice.calculated_gold_9999 : currentPrice.calculated_thai_gold).toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '---'}
            </span>
            {lastUpdateTime && <span className="text-white/25 text-xs ml-auto">อัปเดตล่าสุด: {lastUpdateTime}</span>}
          </div>
        </section>

        {/* ====== Chart + Signal ====== */}
        <section id="chart" className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div className="lg:col-span-2">
            <Suspense fallback={
              <div className="glass p-5 h-[340px] flex items-center justify-center text-white/30">
                <div className="text-center">
                  <div className="text-3xl mb-2">📊</div>
                  <p className="text-sm">กำลังโหลดกราฟ...</p>
                </div>
              </div>
            }>
              <PriceChart history={priceHistory} currentPrice={currentPrice} />
            </Suspense>
          </div>
          <SignalPanel history={priceHistory} currentPrice={currentPrice} />
        </section>

        {/* ====== Unrealized P&L Banner (แสดงถ้ามี trade เปิดอยู่) ====== */}
        {openTrades.length > 0 && currentPrice && (
          <section className={`rounded-xl border p-4 mb-4 ${
            totalUnrealizedPnL >= 0
              ? 'border-green-500/25 bg-green-500/5'
              : 'border-red-500/25 bg-red-500/5'
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-white/50 text-xs mb-0.5">กำไร/ขาดทุนที่ยังไม่ปิด (Unrealized P&L)</p>
                <p className={`text-2xl font-bold ${totalUnrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totalUnrealizedPnL >= 0 ? '+' : ''}฿{totalUnrealizedPnL.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="flex gap-4 text-xs text-white/40">
                <span>{openTrades.length} trade เปิดอยู่</span>
                <span>ราคาทองขณะนี้ {selectedGoldType} ฿{(selectedGoldType === '99.99%' ? currentPrice.calculated_gold_9999 : currentPrice.calculated_thai_gold).toLocaleString('th-TH', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </section>
        )}

        {/* ====== Alert + Trade Journal ====== */}
        <div id="orders" className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
          {/* Order & Alert Manager */}
          <div className="lg:col-span-2">
            <OrderManager currentPrice={currentPrice} />
          </div>

          {/* Trade Journal Form */}
          <div id="journal" className="lg:col-span-3 glass p-6">
            <h2 className="text-white font-semibold text-lg mb-1">สมุดจดเทรด</h2>
            <p className="text-white/40 text-xs mb-4">บันทึกรายการซื้อ-ขายทองคำ</p>
            <form onSubmit={handleSubmitTrade} className="grid grid-cols-2 gap-3">
              {/* ซื้อ/ขาย และ ประเภททอง */}
              <div className="col-span-2 grid grid-cols-2 gap-2">
                {(['ซื้อ', 'ขาย'] as const).map((act) => (
                  <button key={act} type="button"
                    onClick={() => setFormData((p) => ({ ...p, action: act }))}
                    className={`py-2 rounded-xl text-xs font-semibold transition-all duration-200 border ${
                      formData.action === act
                        ? act === 'ซื้อ' ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-red-500/20 border-red-500/50 text-red-400'
                        : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
                    }`}>
                    {act === 'ซื้อ' ? '▲ ซื้อ' : '▼ ขาย'}
                  </button>
                ))}
              </div>
              <div className="col-span-2 grid grid-cols-2 gap-2">
                {(['96.5%', '99.99%'] as const).map((type) => (
                  <button key={type} type="button"
                    onClick={() => setFormData((p) => ({ ...p, gold_type: type }))}
                    className={`py-2 rounded-xl text-xs font-semibold transition-all duration-200 border ${
                      formData.gold_type === type
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                        : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
                    }`}>
                    ทอง {type}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-white/60 text-xs mb-1.5 block">ราคาเข้า (฿)</label>
                <input type="number" step="0.01"
                  placeholder={currentPrice?.calculated_thai_gold?.toFixed(0) ?? '45000'}
                  value={formData.entry_price}
                  onChange={(e) => setFormData((p) => ({ ...p, entry_price: e.target.value }))}
                  className="glass-input" required />
              </div>
              <div>
                <label className="text-white/60 text-xs mb-1.5 block">จำนวน (บาท)</label>
                <input type="number" step="0.5" min="0.5"
                  placeholder="1 (บาท)"
                  value={formData.lot_size_baht}
                  onChange={(e) => setFormData((p) => ({ ...p, lot_size_baht: e.target.value }))}
                  className="glass-input" required />
              </div>
              <div className="col-span-2">
                <label className="text-white/60 text-xs mb-1.5 block">หมายเหตุ (ไม่บังคับ)</label>
                <input type="text" placeholder="เช่น เทรดตามเส้น MA..."
                  value={formData.notes}
                  onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                  className="glass-input" />
              </div>
              <button type="submit" disabled={submitting} className="col-span-2 py-3 rounded-xl font-semibold text-sm transition-all duration-200"
                style={{
                  background: submitting ? 'rgba(245,166,35,0.2)' : 'linear-gradient(135deg, #f5a623, #e8940f)',
                  color: submitting ? 'rgba(255,255,255,0.5)' : '#000',
                  boxShadow: submitting ? 'none' : '0 4px 20px rgba(245,166,35,0.4)',
                }}>
                {submitting ? 'กำลังบันทึก...' : '+ เพิ่มข้อมูลการเทรด'}
              </button>
              {submitSuccess && <p className="col-span-2 text-center text-green-400 text-xs">✅ บันทึกสำเร็จ!</p>}
            </form>
          </div>
        </div>

        {/* DCA Simulator Section */}
        <section id="savings" className="grid grid-cols-1 mb-4">
          <DCASimulator currentPrice={currentPrice} />
        </section>

        {/* ====== Trade List with Unrealized P&L ====== */}
        <section className="glass p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white font-semibold text-lg">รายการเทรดล่าสุด</h2>
              <p className="text-white/40 text-xs mt-0.5">รวม Unrealized P&L แบบ Real-time</p>
            </div>
            <span className="text-white/30 text-xs bg-white/5 px-2 py-1 rounded-lg">{trades.length} รายการ</span>
          </div>

          {trades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-white/20">
              <span className="text-4xl mb-3">📋</span>
              <p className="text-sm">ยังไม่มีรายการเทรด</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {trades.map((trade) => {
                const pnl = currentPrice ? calcPnL(trade, currentPrice) : null
                const isOpen = trade.status === 'เปิด'
                return (
                  <div key={trade.id}
                    className="flex items-center gap-3 p-3.5 rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                    <span className={`flex-shrink-0 w-14 py-1 rounded-lg text-xs font-bold text-center ${
                      trade.action === 'ซื้อ' ? 'bg-green-500/15 text-green-400 border border-green-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/20'
                    }`}>
                      {trade.action === 'ซื้อ' ? '▲ ซื้อ' : '▼ ขาย'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-sm font-semibold">
                          ฿{trade.entry_price.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-white/40 text-xs">{trade.lot_size_baht} บาท</span>
                        <span className="text-amber-500/60 text-[10px] bg-amber-500/5 px-1.5 py-0.5 rounded border border-amber-500/10">ทอง {trade.gold_type}</span>
                      </div>
                      {trade.notes && <p className="text-white/40 text-xs mt-0.5 truncate">{trade.notes}</p>}
                    </div>
                    {/* Unrealized P&L */}
                    {isOpen && pnl !== null && (
                      <div className={`text-sm font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {pnl >= 0 ? '+' : ''}฿{pnl.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </div>
                    )}
                    <div className="flex-shrink-0 text-right">
                      <span className={`block text-xs mb-1 px-2 py-0.5 rounded-full ${
                        isOpen ? 'bg-blue-500/15 text-blue-400' : 'bg-white/10 text-white/40'
                      }`}>{trade.status}</span>
                      <span className="text-white/30 text-xs">
                        {new Date(trade.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <footer className="text-center text-white/20 text-xs">
          <p>Pooh Dev Gold Analytics • Real-time Thai Gold 96.5% • ข้อมูลจาก Tiingo + ExchangeRate API</p>
          <p className="mt-1">⚠️ ระบบนี้ใช้เพื่อช่วยตัดสินใจเท่านั้น ไม่ใช่คำแนะนำการลงทุน</p>
        </footer>
      </div>
      <BottomNav />
    </div>
  )
}
