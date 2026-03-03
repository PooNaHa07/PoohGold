-- ============================================================
-- Pooh Dev Gold Analytics — Supabase Database Schema
-- รัน SQL นี้ใน Supabase SQL Editor
-- ============================================================

-- Enable UUID extension (ถ้ายังไม่ได้เปิด)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Table: gold_prices
-- ============================================================
CREATE TABLE IF NOT EXISTS gold_prices (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  xauusd               NUMERIC NOT NULL,
  usd_thb              NUMERIC NOT NULL,
  calculated_thai_gold NUMERIC NOT NULL,
  calculated_gold_9999 NUMERIC,
  hsh_965_buy          NUMERIC,
  hsh_965_sell         NUMERIC,
  premium              NUMERIC NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index สำหรับ query ล่าสุด
CREATE INDEX IF NOT EXISTS idx_gold_prices_created_at ON gold_prices (created_at DESC);

-- ============================================================
-- Table: trade_journal
-- ============================================================
CREATE TABLE IF NOT EXISTS trade_journal (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action         TEXT NOT NULL CHECK (action IN ('ซื้อ', 'ขาย')),
  entry_price    NUMERIC NOT NULL,
  lot_size_baht  NUMERIC NOT NULL,
  status         TEXT NOT NULL DEFAULT 'เปิด' CHECK (status IN ('เปิด', 'ปิด')),
  pnl            NUMERIC DEFAULT 0,
  notes          TEXT,
  ai_insight     TEXT, -- คำแนะนำ AI สำหรับเทรดนี้
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index สำหรับ query ล่าสุด
CREATE INDEX IF NOT EXISTS idx_trade_journal_created_at ON trade_journal (created_at DESC);

-- ============================================================
-- Table: limit_orders
-- ============================================================
CREATE TABLE IF NOT EXISTS limit_orders (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action         TEXT NOT NULL CHECK (action IN ('ซื้อ', 'ขาย')),
  gold_type      TEXT NOT NULL DEFAULT '96.5%' CHECK (gold_type IN ('96.5%', '99.99%')),
  target_price   NUMERIC NOT NULL,
  lot_size_baht  NUMERIC NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'cancelled')),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_limit_orders_status ON limit_orders (status);

-- ============================================================
-- Table: gold_news
-- ============================================================
CREATE TABLE IF NOT EXISTS gold_news (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       TEXT NOT NULL,
  url         TEXT NOT NULL UNIQUE,
  snippet     TEXT,
  source      TEXT,
  published_at TIMESTAMPTZ,
  impact_type  TEXT CHECK (impact_type IN ('bullish', 'bearish', 'neutral')),
  impact_summary TEXT,
  volatility_score INTEGER DEFAULT 1, -- ระดับความผันผวน 1-10
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gold_news_created_at ON gold_news (created_at DESC);

-- ============================================================
-- Enable Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE gold_prices;
ALTER PUBLICATION supabase_realtime ADD TABLE trade_journal;
ALTER PUBLICATION supabase_realtime ADD TABLE limit_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE gold_news;
