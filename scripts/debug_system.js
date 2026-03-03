const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function debug() {
  // 1. Check columns
  console.log('--- Checking database columns ---');
  const { data, error } = await supabase.from('gold_prices').select('*').limit(1);
  if (error) {
    console.error('Select error:', error.message);
  } else if (data && data.length > 0) {
    console.log('Columns found in first row:', Object.keys(data[0]));
  } else {
    console.log('No data in gold_prices yet.');
  }

  // 2. Debug HSH Scrape
  console.log('\n--- Debugging HSH Scrape ---');
  const url = 'https://www.huasengheng.com/en/';
  try {
    const res = await fetch(url);
    const html = await res.text();
    console.log('HTML Length:', html.length);
    
    // Look for prices
    const buyMatch = html.match(/Gold Bars 96\.5%[\s\S]*?Buy[\s\S]*?<strong>(.*?)<\/strong>/i);
    const sellMatch = html.match(/Gold Bars 96\.5%[\s\S]*?Sell[\s\S]*?<strong>(.*?)<\/strong>/i);
    
    console.log('Buy Match:', buyMatch ? buyMatch[1] : 'NOT FOUND');
    console.log('Sell Match:', sellMatch ? sellMatch[1] : 'NOT FOUND');
    
    if (!buyMatch) {
      // Find where "Gold Bars 96.5%" is
      const idx = html.indexOf('Gold Bars 96.5%');
      if (idx !== -1) {
        console.log('Snippet around "Gold Bars 96.5%":', html.substring(idx, idx + 1000));
      } else {
        console.log('"Gold Bars 96.5%" text not found in HTML.');
      }
    }
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

debug();
