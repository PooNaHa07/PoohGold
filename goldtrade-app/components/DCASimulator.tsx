'use client'

import { useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { GoldPrice } from '@/types'

interface DCASimulatorProps {
  currentPrice: GoldPrice | null
}

export default function DCASimulator({ currentPrice }: DCASimulatorProps) {
  const [monthlyAmount, setMonthlyAmount] = useState('5000')
  const [periodMonths, setPeriodMonths] = useState('12')
  const [buyDay, setBuyDay] = useState('1')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{
    totalInvested: number
    totalGoldBaht: number
    currentValue: number
    profit: number
    profitPercent: number
  } | null>(null)

  const calculateDCA = async () => {
    if (!currentPrice) return
    setIsLoading(true)
    
    try {
      // ดึงข้อมูลราคาทองย้อนหลัง (ในความเป็นจริงอาจต้องมี API แยกสำหรับข้อมูลรายวัน/รายเดือนที่ไกลกว่านี้)
      // แต่ในที่นี้เราจะดึงจาก gold_prices เท่าที่มี
      const { data: history } = await supabase
        .from('gold_prices')
        .select('calculated_thai_gold, created_at')
        .order('created_at', { ascending: true })
      
      if (!history || history.length === 0) {
        alert('ยังไม่มีข้อมูลย้อนหลังเพียงพอสำหรับการคำนวณ')
        return
      }

      const amount = parseFloat(monthlyAmount)
      const months = parseInt(periodMonths)
      const day = parseInt(buyDay)
      
      let totalInvested = 0
      let totalGoldBaht = 0

      // จำลองการซื้อรายเดือน (Logic ง่ายๆ: หาจุดใน history ที่ใกล้เคียงกับวันที่ระบุที่สุดในแต่ละเดือน)
      const monthlyPicks: number[] = []
      const processedMonths = new Set<string>()

      for (const row of history) {
        const date = new Date(row.created_at)
        const monthYear = `${date.getMonth()}-${date.getFullYear()}`
        
        if (!processedMonths.has(monthYear) && date.getDate() >= day) {
          monthlyPicks.push(row.calculated_thai_gold)
          processedMonths.add(monthYear)
          if (monthlyPicks.length >= months) break
        }
      }

      if (monthlyPicks.length === 0) {
        // Fallback: ใช้ราคาเฉลี่ยถ้าหาจุดซื้อไม่เจอ
        const avg = history.reduce((s, r) => s + r.calculated_thai_gold, 0) / history.length
        monthlyPicks.push(...Array(months).fill(avg))
      }

      monthlyPicks.forEach(price => {
        totalInvested += amount
        totalGoldBaht += amount / price
      })

      const currentValue = totalGoldBaht * currentPrice.calculated_thai_gold
      const profit = currentValue - totalInvested
      const profitPercent = (profit / totalInvested) * 100

      setResult({
        totalInvested,
        totalGoldBaht,
        currentValue,
        profit,
        profitPercent
      })
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="glass p-6 h-full flex flex-col">
      <div className="mb-4">
        <h2 className="text-white font-semibold text-lg flex items-center gap-2">
          <span className="text-xl">🐖</span> DCA Simulator
        </h2>
        <p className="text-white/40 text-xs">จำลองการออมทองรายเดือน (ออมสม่ำเสมอ)</p>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="text-white/60 text-[10px] mb-1.5 block uppercase tracking-wider">เงินออมต่อเดือน (บาท)</label>
          <input 
            type="number" 
            value={monthlyAmount} 
            onChange={e => setMonthlyAmount(e.target.value)}
            className="glass-input text-sm w-full"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-white/60 text-[10px] mb-1.5 block uppercase tracking-wider">ระยะเวลา (เดือน)</label>
            <select 
              value={periodMonths} 
              onChange={e => setPeriodMonths(e.target.value)}
              className="glass-input text-xs w-full"
            >
              <option value="3">3 เดือน</option>
              <option value="6">6 เดือน</option>
              <option value="12">12 เดือน</option>
              <option value="24">24 เดือน</option>
            </select>
          </div>
          <div>
            <label className="text-white/60 text-[10px] mb-1.5 block uppercase tracking-wider">วันที่เข้าซื้อ</label>
            <select 
              value={buyDay} 
              onChange={e => setBuyDay(e.target.value)}
              className="glass-input text-xs w-full"
            >
              <option value="1">วันที่ 1</option>
              <option value="15">วันที่ 15</option>
              <option value="28">ปลายเดือน</option>
            </select>
          </div>
        </div>

        <button 
          onClick={calculateDCA}
          disabled={isLoading || !currentPrice}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
        >
          {isLoading ? 'กำลังคำนวณ...' : 'เริ่มจำลองการออม'}
        </button>
      </div>

      {result ? (
        <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/5 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-white/40 text-[10px] uppercase">เงินต้นทั้งหมด</p>
              <p className="text-white font-bold">฿{result.totalInvested.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-white/40 text-[10px] uppercase">ทองที่สะสมได้</p>
              <p className="text-amber-400 font-bold">{result.totalGoldBaht.toFixed(4)} บาท</p>
            </div>
          </div>
          <hr className="border-white/5" />
          <div className="text-center py-2">
            <p className="text-white/40 text-[10px] uppercase mb-1">มูลค่าปัจจุบัน / กำไร</p>
            <p className="text-2xl font-bold text-white mb-1">฿{result.currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className={`text-sm font-bold ${result.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {result.profit >= 0 ? '+' : ''}฿{result.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({result.profitPercent.toFixed(2)}%)
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-2xl text-white/10 p-6 text-center">
          <span className="text-3xl mb-2">📊</span>
          <p className="text-[10px]">กรอกข้อมูลด้านบนแล้วกดคำนวณ<br/>เพื่อดูผลตอบแทนที่คาดหวัง</p>
        </div>
      )}
    </div>
  )
}
