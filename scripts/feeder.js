#!/usr/bin/env node
/**
 * Pooh Dev Gold Analytics — Feeder Script
 * ----------------------------------------
 * - XAUUSD  : Tiingo FX API (token required)
 * - USDTHB  : open.er-api.com (free, no key)
 * - Insert ลง Supabase `gold_prices` ทุก 15 วินาที
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ============================================================
// Environment variables
// ============================================================
const {
  TIINGO_API_KEY,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  EXCHANGERATE_API_KEY,
  GOLD_PREMIUM = '0',
  FETCH_INTERVAL_MS = '30000',
} = process.env;

if (!TIINGO_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌  Missing required environment variables.');
  console.error('   ต้องมี: TIINGO_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const PREMIUM = parseFloat(GOLD_PREMIUM);
const INTERVAL_MS = parseInt(FETCH_INTERVAL_MS, 10);

// ============================================================
// Helper: fetch พร้อม retry exponential backoff สำหรับ 429
// ============================================================
async function fetchWithRetry(url, options = {}, retries = 3, baseDelayMs = 60000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, options);
    if (res.status === 429) {
      const waitMs = baseDelayMs * attempt;
      console.warn(`  ⏳  Rate limit (429) — รอ ${waitMs / 1000}s แล้วลองใหม่ (ครั้งที่ ${attempt}/${retries})`);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    return res;
  }
  throw new Error('Tiingo: เกิน rate limit หลายครั้ง กรุณารอสักครู่');
}

// ============================================================
// Supabase client (Service Role)
// ============================================================
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ============================================================
// Helper: ดึงราคา XAUUSD
// Primary  : Swissquote (ฟรี ไม่ต้อง key ไม่มี rate limit)
// Fallback : Tiingo (ใช้เมื่อ Swissquote ล้มเหลว)
// ============================================================
async function fetchXAUUSD() {
  // --- Swissquote ---
  try {
    const url = 'https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD';
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      // data[0].spreadProfilePrices = [{ spreadProfile, bid, ask }, ...]
      const prices = data?.[0]?.spreadProfilePrices;
      if (prices && prices.length > 0) {
        const p = prices[0];
        return (p.bid + p.ask) / 2;
      }
    }
  } catch (err) {
    console.warn('  ⚠️  Swissquote ล้มเหลว ใช้ Tiingo แทน:', err.message);
  }

  // --- Tiingo fallback ---
  const url = `https://api.tiingo.com/tiingo/fx/xauusd/top?token=${TIINGO_API_KEY}`;
  const res = await fetchWithRetry(url, { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error(`Tiingo XAUUSD error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Tiingo XAUUSD: empty response');
  }
  const item = data[0];
  if (item.midPrice != null) return item.midPrice;
  if (item.bidPrice != null && item.askPrice != null) return (item.bidPrice + item.askPrice) / 2;
  throw new Error('Tiingo XAUUSD: ไม่พบ bidPrice หรือ midPrice ใน response');
}

// ============================================================
// Helper: ดึงราคาจาก ฮั่วเซ่งเฮง (HSH) - Using Stable API
// ============================================================
async function fetchHSHPrices() {
  try {
    // API สำหรับ Gold Bars 96.5%
    const url965 = 'https://apicheckpricev3.huasengheng.com/api/values/getprice/';
    const res965 = await fetch(url965);
    
    if (res965.ok) {
      const data = await res965.json();
      // ค้นหารายการที่เป็น GoldType: "HSH" และ GoldCode: "96.50"
      const hshData = data.find(item => item.GoldType === 'HSH' && item.GoldCode === '96.50');
      
      if (hshData) {
        const buy = parseFloat(hshData.Buy.replace(/,/g, ''));
        const sell = parseFloat(hshData.Sell.replace(/,/g, ''));
        return { buy, sell };
      }
    }
  } catch (err) {
    console.warn('  ⚠️  HSH API failed:', err.message);
  }
  return null;
}

// ============================================================
// Helper: ดึง USD/THB จาก app.exchangerate-api.com (Key required)
// อัปเดตทุก ~60 วินาที เหมาะสำหรับ real-time gold pricing
// Fallback: open.er-api.com ถ้าไม่มี API key
// ============================================================
async function fetchUSDTHB() {
  if (EXCHANGERATE_API_KEY) {
    const url = `https://v6.exchangerate-api.com/v6/${EXCHANGERATE_API_KEY}/pair/USD/THB`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ExchangeRate API error: ${res.status}`);
    const data = await res.json();
    if (data.result === 'success' && data.conversion_rate) {
      return data.conversion_rate;
    }
    throw new Error(`ExchangeRate API: ${data['error-type'] ?? 'unknown error'}`);
  }
  // Fallback: free endpoint (อัปเดตทุก ~1 ชั่วโมง)
  const url = 'https://open.er-api.com/v6/latest/USD';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ExchangeRate fallback error: ${res.status}`);
  const data = await res.json();
  if (!data.rates?.THB) throw new Error('ExchangeRate fallback: ไม่พบ rates.THB');
  return data.rates.THB;
}

// ============================================================
// ThaiGold 96.5% = ((XAUUSD + SpotPremium) × USDTHB × 0.4729) + Premium
// ThaiGold 99.99% = ((XAUUSD + SpotPremium) × USDTHB × 0.4874) + Premium
// Round to nearest 50 for 96.5% and 10 for 99.99% (GTA style)
// ============================================================
function calculateGoldPrices(xauusd, usdthb, premium = 0) {
  const SPOT_PREMIUM = 1.5; // Standard international delivery/insurance premium
  
  const raw965 = (xauusd + SPOT_PREMIUM) * usdthb * 0.4729 + premium;
  const raw9999 = (xauusd + SPOT_PREMIUM) * usdthb * 0.4874 + premium;
  
  // GTA Rounding: 96.5% usually rounds to nearest 50 THB
  const gold965 = Math.round(raw965 / 50) * 50;
  // 99.99% matches global more closely but often rounds to 10 or 50
  const gold9999 = Math.round(raw9999 / 10) * 10;
  
  return { gold965, gold9999 };
}

// ============================================================
// Main loop
// ============================================================
async function fetchAndStore() {
  try {
    console.log(`\n[${new Date().toLocaleString('th-TH')}] กำลังดึงข้อมูล...`);

    const [xauusd, usdthb, hsh] = await Promise.all([fetchXAUUSD(), fetchUSDTHB(), fetchHSHPrices()]);
    const { gold965, gold9999 } = calculateGoldPrices(xauusd, usdthb, PREMIUM);

    console.log(`  💰  XAUUSD           : $${xauusd.toFixed(2)}`);
    console.log(`  💱  USD/THB           : ${usdthb.toFixed(4)}`);
    console.log(`  🥇  ทองไทย (GTA Est) : ฿${gold965.toFixed(2)}`);
    if (hsh) {
      console.log(`  🍊  Hua Seng Heng Buy : ฿${hsh.buy.toLocaleString()}`);
      console.log(`  🍊  Hua Seng Heng Sell: ฿${hsh.sell.toLocaleString()}`);
    }
    console.log(`  🏆  ทองไทย 99.99%   : ฿${gold9999.toFixed(2)}`);
    console.log(`  ➕  Premium           : ฿${PREMIUM}`);

    const { error } = await supabase.from('gold_prices').insert({
      xauusd,
      usd_thb: usdthb,
      calculated_thai_gold: gold965,
      calculated_gold_9999: gold9999,
      hsh_965_buy: hsh?.buy || null,
      hsh_965_sell: hsh?.sell || null,
      premium: PREMIUM,
    });

    if (error) {
      console.error('  ❌  Supabase insert error:', error.message);
    } else {
      console.log('  ✅  บันทึกลง Supabase สำเร็จ');
    }
  } catch (err) {
    console.error('  ❌  Error:', err.message);
  }
}

// ============================================================
// Start
// ============================================================
console.log('🚀  Pooh Dev Gold Analytics — Feeder Started');
console.log(`⏱️   ดึงข้อมูลทุก ${INTERVAL_MS / 1000} วินาที`);
console.log('─────────────────────────────────────────────');

fetchAndStore();
setInterval(fetchAndStore, INTERVAL_MS);

process.on('SIGINT', () => {
  console.log('\n\n👋  ปิด Feeder แล้ว');
  process.exit(0);
});
