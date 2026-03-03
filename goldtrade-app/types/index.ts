export interface GoldPrice {
  id: string
  xauusd: number
  usd_thb: number
  calculated_thai_gold: number
  calculated_gold_9999: number
  hsh_965_buy?: number
  hsh_965_sell?: number
  premium: number
  created_at: string
}

export interface TradeJournal {
  id: string
  action: 'ซื้อ' | 'ขาย'
  entry_price: number
  lot_size_baht: number
  gold_type: '96.5%' | '99.99%'
  status: 'เปิด' | 'ปิด'
  pnl: number
  notes?: string
  ai_insight?: string
  created_at: string
}

export interface TradeFormData {
  action: 'ซื้อ' | 'ขาย'
  gold_type: '96.5%' | '99.99%'
  entry_price: string
  lot_size_baht: string
  notes: string
}

export interface LimitOrder {
  id: string
  action: 'ซื้อ' | 'ขาย'
  gold_type: '96.5%' | '99.99%'
  target_price: number
  lot_size_baht: number
  status: 'pending' | 'executed' | 'cancelled'
  notes?: string
  created_at: string
}
export interface NewsItem {
  id: string
  title: string
  url: string
  snippet: string
  source: string
  published_at: string
  impact_type?: 'bullish' | 'bearish' | 'neutral'
  impact_summary?: string
  volatility_score?: number
}
