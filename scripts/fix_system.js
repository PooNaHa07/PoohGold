import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fixSystem() {
  console.log('--- Testing HSH Scrape with robust regex ---');
  const url = 'https://www.huasengheng.com/en/';
  try {
    const res = await fetch(url);
    const html = await res.text();
    
    // Improved regex: look for "Gold Bars 96.5%" then find the next two numbers
    // In the markdown it was: | **Hua Seng Heng** | **78,590** | **78,810** |
    // Let's look for the row containing "Hua Seng Heng" after "Gold Bars 96.5%"
    
    const sectionIdx = html.indexOf('Gold Bars 96.5%');
    if (sectionIdx !== -1) {
      const section = html.substring(sectionIdx, sectionIdx + 2000);
      // Look for numbers like 78,590 or 78590
      const matches = section.match(/\d{2},\d{3}/g);
      console.log('Found numbers in section:', matches);
      
      if (matches && matches.length >= 2) {
         const buy = parseFloat(matches[0].replace(/,/g, ''));
         const sell = parseFloat(matches[1].replace(/,/g, ''));
         console.log(`Extracted -> Buy: ${buy}, Sell: ${sell}`);
      } else {
         console.log('Could not find enough price matches in the section.');
         // Try a different regex
         const hshRowMatch = section.match(/Hua Seng Heng[\s\S]*?(\d{2},\d{3})[\s\S]*?(\d{2},\d{3})/i);
         if (hshRowMatch) {
            console.log('HSH Row Match -> Buy:', hshRowMatch[1], 'Sell:', hshRowMatch[2]);
         }
      }
    } else {
      console.log('Section "Gold Bars 96.5%" not found.');
    }
  } catch (err) {
    console.error('Scrape error:', err.message);
  }

  console.log('\n--- Attempting to check/add columns ---');
  // We can't run SQL directly via JS client usually, but we can try to select a non-existent column to confirm
  const { data, error } = await supabase.from('gold_prices').select('hsh_965_buy').limit(1);
  if (error && error.message.includes('column "hsh_965_buy" does not exist')) {
    console.log('Confirmed: Columns are missing. Please run the SQL in Supabase Dashboard.');
    console.log('SQL to run:');
    console.log('ALTER TABLE gold_prices ADD COLUMN IF NOT EXISTS hsh_965_buy NUMERIC;');
    console.log('ALTER TABLE gold_prices ADD COLUMN IF NOT EXISTS hsh_965_sell NUMERIC;');
    console.log('ALTER TABLE gold_prices ADD COLUMN IF NOT EXISTS calculated_gold_9999 NUMERIC;');
  } else if (error) {
    console.log('Select error (other):', error.message);
  } else {
    console.log('Columns seem to exist (or at least no error for hsh_965_buy).');
  }
}

fixSystem();
