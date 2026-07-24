import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const client = new Anthropic();
// Supabase klientas jungiasi prie tavo duomenų bazės (URL + slaptas raktas iš .env.local).
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Web search užtrunka ilgai — prašome Vercel duoti funkcijai iki 60s.
export const maxDuration = 60;

// Parduotuvės, su kuriomis turi affiliate sutartį.
// `match` = raktažodis parduotuvės pavadinime; `tag` = tavo affiliate ID.
// PLACEHOLDER — pakeisk `bapkes-21` į tikrą Amazon tag'ą, kai patvirtins.
const AFFILIATE_STORES = [
  { match: 'amazon', tag: 'bapkes-21' },
];

// Prideda tavo affiliate tag'ą prie produkto URL (jei tai affiliate parduotuvė).
// Grąžina produktą su pakeistu `url` ir nauju `isAffiliate` lauku.
function withAffiliate(product) {
  const storeLower = (product.store || '').toLowerCase();
  // .find grąžina pirmą tinkantį affiliate arba undefined (Day 2 metodas!).
  const affiliate = AFFILIATE_STORES.find(a => storeLower.includes(a.match));
  const isAffiliate = Boolean(affiliate);

  let url = product.url || null;
  if (url && affiliate) {
    // Jei URL jau turi "?", jungiam su "&"; kitaip su "?".
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}tag=${affiliate.tag}`;
  }

  // ...product = nukopijuojam visus laukus (Day 3 spread!), pakeičiam url, pridedam isAffiliate.
  return { ...product, url, isAffiliate };
}

// Prideda affiliate nuorodas IR surūšiuoja: affiliate parduotuvės — pirmos.
function processResults(results) {
  return results
    .map(withAffiliate)
    .sort((a, b) => (b.isAffiliate ? 1 : 0) - (a.isAffiliate ? 1 : 0));
}

export async function POST(request) {
  const body = await request.json();
  const key = body.query.toLowerCase().trim();

  const DAY_MS = 24 * 60 * 60 * 1000;

  // 1. Cache patikra (su created_at TTL patikrai).
  const { data: cached } = await supabase
    .from('search_cache')
    .select('results, created_at')
    .eq('query', key)
    .maybeSingle();

  if (cached) {
    const ageMs = Date.now() - new Date(cached.created_at).getTime();
    if (ageMs < DAY_MS) {
      // Šviežias cache — apdorojam (affiliate + rūšiavimas) ir grąžinam.
      return Response.json({ results: processResults(cached.results), checkedAt: cached.created_at });
    }
    // Senesnis nei 24h — ieškom iš naujo žemiau.
  }

  // 2. Šviežia paieška.
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    tools: [
      { type: 'web_search_20260209', name: 'web_search', max_uses: 2 }
    ],
    messages: [
      {
        role: 'user',
        content: `Search the web for real, currently available products matching: "${body.query}".
Find 3 real products sold by online stores that ship to Europe, with their REAL current prices.
Prefer Amazon.de when it has a competitive price, but always include the genuinely best deals you find.
Each object must have:
- id (number)
- name (string, the real product name)
- price (number, the real current price in EUR)
- store (string, the name of the store where you found it)
- url (string, the direct link to the product page in that store)
- dealScore (number 0-100: how good this price is relative to the product's typical price and its category)
Respond with ONLY the JSON array, no other text.`
      }
    ]
  });

  // Web search grąžina masyvą blokų — išrenkam teksto dalis ir sujungiam.
  const fullText = message.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');

  // Ištraukiam JSON masyvą nuo pirmo "[" iki paskutinio "]".
  const start = fullText.indexOf('[');
  const end = fullText.lastIndexOf(']');
  if (start === -1 || end === -1) {
    return Response.json({ error: "No results found" }, { status: 500 });
  }
  const results = JSON.parse(fullText.slice(start, end + 1));

  const now = new Date().toISOString();
  // Cache saugom RAW rezultatus (be affiliate nuorodų) — nuorodas generuojam kaskart iš naujo,
  // kad pakeitęs affiliate ID nereikėtų valyti visos bazės.
  await supabase.from('search_cache').upsert({ query: key, results: results, created_at: now });

  return Response.json({ results: processResults(results), checkedAt: now });
}
