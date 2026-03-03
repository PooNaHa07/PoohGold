import fetch from 'node-fetch';
import { parseStringPromise } from 'xml2js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import translate from 'translate-google-api';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const SOURCES = [
  {
    name: 'Investing.com',
    url: 'https://www.investing.com/rss/news_95.rss'
  },
  {
    name: 'GoldSeek',
    url: 'https://goldseek.com/rss.xml'
  },
  {
    name: 'CNBC Gold',
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000108'
  }
];

const FETCH_INTERVAL_MS = 20 * 60 * 1000;

// Keywords for analysis
const BULLISH_WORDS = [
  'inflation', 'rate cut', 'weak dollar', 'stimulus', 'recession', 'uncertainty', 
  'war', 'crisis', 'geopolitical', 'debt', 'printing money', 'easing', 'bank failure',
  'central bank buying', 'demand increase', 'yield drop', 'negative rates'
];
const BEARISH_WORDS = [
  'rate hike', 'strong dollar', 'recovery', 'growth', 'hawkish', 'tightening', 
  'disinflation', 'optimism', 'stable', 'sell-off', 'yield surge', 'fed hawkish',
  'soft landing', 'inflation cool', 'gold outflow'
];

const VOLATILITY_KEYWORDS = [
  'non-farm', 'payrolls', 'cpi', 'fomc', 'interest rate', 'fed', 'powell',
  'conflict', 'escalation', 'emergency', 'black swan', 'unemployment', 'gdp'
];

function analyzeImpact(title, snippet) {
  const content = (title + ' ' + snippet).toLowerCase();
  let score = 0;
  let volatility = 1;
  
  BULLISH_WORDS.forEach(word => {
    if (content.includes(word)) score++;
  });
  
  BEARISH_WORDS.forEach(word => {
    if (content.includes(word)) score--;
  });

  VOLATILITY_KEYWORDS.forEach(word => {
    if (content.includes(word)) volatility += 2;
  });
  volatility = Math.min(10, volatility);

  let result = { type: 'neutral', summary: 'ข้อมูลทั่วไป', volatility };

  if (score > 0) {
    result = { 
      type: 'bullish', 
      summary: 'บวก: มีปัจจัยหนุนทองคำ', 
      volatility 
    };
  } else if (score < 0) {
    result = { 
      type: 'bearish', 
      summary: 'ลบ: มีปัจจัยกดดันทองคำ', 
      volatility 
    };
  }

  return result;
}

async function translateText(text) {
  if (!text) return '';
  try {
    const result = await translate(text, {
      tld: 'com',
      to: 'th',
    });
    return Array.isArray(result) ? result[0] : result;
  } catch (error) {
    return text;
  }
}

async function fetchAndSaveNews() {
  console.log(`\n[${new Date().toLocaleString('th-TH')}] 📡 เริ่มกวาดข้อมูลข่าวและวิเคราะห์ผลกระทบ...`);
  let newCount = 0;

  for (const source of SOURCES) {
    try {
      console.log(`  🔍 ดึงข้อมูลจาก: ${source.name}...`);
      const response = await fetch(source.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
        },
        timeout: 15000
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const xml = await response.text();
      const result = await parseStringPromise(xml);
      const channel = result.rss ? result.rss.channel[0] : null;
      if (!channel) continue;

      const items = (channel.item || []).slice(0, 5);
      console.log(`    - พบข่าว ${items.length} รายการ (กำลังวิเคราะห์และแปล...)`);

      for (const item of items) {
        const titleEn = item.title ? (typeof item.title[0] === 'string' ? item.title[0] : item.title[0]._) : 'No Title';
        const link = item.link ? (typeof item.link[0] === 'string' ? item.link[0] : item.link[0]._) : '';
        const pubDate = item.pubDate ? item.pubDate[0] : new Date().toISOString();
        const descriptionEn = item.description ? item.description[0].toString().replace(/<[^>]*>/g, '').slice(0, 300).trim() : '';

        if (!link) continue;

        // Check if exists
        const { data: existing } = await supabase
          .from('gold_news')
          .select('id')
          .eq('url', link)
          .single();

        if (existing) continue;

        // 1. Analyze Impact based on English content (more accurate)
        const impact = analyzeImpact(titleEn, descriptionEn);

        // 2. Translate
        const titleTh = await translateText(titleEn);
        const snippetTh = await translateText(descriptionEn);

        const newsData = {
          title: titleTh || titleEn,
          url: link,
          snippet: snippetTh || descriptionEn,
          source: source.name,
          published_at: new Date(pubDate).toISOString(),
          impact_type: impact.type,
          impact_summary: impact.summary,
          volatility_score: impact.volatility
        };

        const { error: upsertError } = await supabase.from('gold_news').upsert(newsData, { onConflict: 'url' });
        if (upsertError) {
          console.error(`      ❌ Error saving item: ${upsertError.message} (${upsertError.code})`);
        } else {
          newCount++;
        }
      }

      console.log(`    ✅ บันทึกและวิเคราะห์สำเร็จสำหรับ ${source.name}`);
    } catch (error) {
      console.error(`  ❌ Error ${source.name}: ${error.message}`);
    }
  }
  console.log(`[${new Date().toLocaleString('th-TH')}] ✨ เสร็จสิ้น`);
}

// Start loop
console.log('🚀 Gold News Impact AI Feeder Started');
fetchAndSaveNews();
setInterval(fetchAndSaveNews, FETCH_INTERVAL_MS);
