import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const client = new Anthropic();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export const maxDuration = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

// Ar cache įrašas dar šviežias (jaunesnis nei 24h)?
function isFresh(created_at) {
  return Date.now() - new Date(created_at).getTime() < DAY_MS;
}

// Ištraukia JSON masyvą iš teksto PATIKIMAI: nuo pirmo "[" skaičiuoja skliaustų
// gylį (praleisdamas tekstą kabutėse) ir randa, kur masyvas realiai baigiasi.
// Taip ignoruojam Claude paaiškinimus ir citatas kaip [1], [2] po masyvo.
function extractJsonArray(text) {
  const start = text.indexOf('[');
  if (start === -1) return null;
  let depth = 0, inString = false, escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1); // masyvas baigėsi čia
    }
  }
  return null;
}

// Paverčia tekstą į embedding vektorių (1024 skaičiai) per Voyage AI.
async function getEmbedding(text) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: text, model: 'voyage-3.5-lite' }),
  });
  const data = await res.json();
  return data.data[0].embedding; // masyvas iš 1024 skaičių
}

// Parduotuvės, su kuriomis turi affiliate sutartį (PLACEHOLDER tag'as).
const AFFILIATE_STORES = [
  { match: 'amazon', tag: 'bapkes-21' },
];

function withAffiliate(product) {
  const storeLower = (product.store || '').toLowerCase();
  const affiliate = AFFILIATE_STORES.find(a => storeLower.includes(a.match));
  const isAffiliate = Boolean(affiliate);

  let url = product.url || null;
  if (url && affiliate) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}tag=${affiliate.tag}`;
  }
  return { ...product, url, isAffiliate };
}

function processResults(results) {
  return results
    .map(withAffiliate)
    .sort((a, b) => (b.isAffiliate ? 1 : 0) - (a.isAffiliate ? 1 : 0));
}

export async function POST(request) {
  const body = await request.json();
  const { car, part, condition } = body;
  // Cache raktas iš visų trijų laukų (būklė svarbi — OEM ir used duoda skirtingus rezultatus).
  const key = `${car} | ${part} | ${condition}`.toLowerCase().trim();

  // 1. TIKSLUS cache (nemokamas — be embedding). Jei toks pat tekstas ir šviežias → grąžinam.
  const { data: exact } = await supabase
    .from('search_cache')
    .select('results, created_at')
    .eq('query', key)
    .maybeSingle();

  if (exact && isFresh(exact.created_at)) {
    return Response.json({ results: processResults(exact.results), checkedAt: exact.created_at });
  }

  // 2. Nėra tikslaus atitikmens — skaičiuojam embedding ir ieškom PANAŠIOS paieškos pagal PRASMĘ.
  //    Taip "dyson v11" randa jau esantį "dyson v11 vacuum" (nes prasmė panaši).
  const embedding = await getEmbedding(key);
  const { data: matches } = await supabase.rpc('match_search', {
    query_embedding: embedding,
    match_threshold: 0.78, // kiek panašu = "tas pats". Vidurys: pagauna aiškius perfrazavimus,
                           // atmeta kitus modelius. Kelk aukščiau (saugiau) / žemiau (agresyviau).
  });

  if (matches && matches.length > 0 && isFresh(matches[0].created_at)) {
    return Response.json({ results: processResults(matches[0].results), checkedAt: matches[0].created_at });
  }

  // 3. Nieko panašaus cache'e — tikra web paieška.
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    tools: [
      { type: 'web_search_20260209', name: 'web_search', max_uses: 1 }
    ],
    messages: [
      {
        role: 'user',
        content: `Find a real, currently available CAR PART for this vehicle.
Car: "${car}"
Part needed: "${part}"
Condition preference: "${condition}" (if "Any", include a mix; otherwise prefer that condition).

Search the web (European car-parts stores like Autodoc, kfzteile24, eBay Motors, Amazon.de, oscaro) for 3 real listings that FIT this specific car, with REAL current prices in EUR.
Only include parts that genuinely fit the given car — fitment accuracy is critical.
Each object must have:
- id (number)
- name (string, the real part name incl. brand)
- price (number, the real current price in EUR)
- store (string, the store where you found it)
- url (string, direct link to the part's page)
- image (string, direct URL to a photo of the part, ideally .jpg/.png/.webp)
- condition (string: "OEM", "Aftermarket", or "Used")
- fits (string, short note on fitment, e.g. "Fits BMW E46 320i 2000-2005")
- dealScore (number 0-100: how good this price is vs the part's typical price)
Respond with ONLY the JSON array, no other text.`
      }
    ]
  });

  const fullText = message.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');

  const jsonText = extractJsonArray(fullText);
  if (!jsonText) {
    return Response.json({ error: "No results found" }, { status: 500 });
  }
  const results = JSON.parse(jsonText);

  // 4. Saugom rezultatus SU embedding (kad ateity semantinė paieška rastų šitą įrašą).
  const now = new Date().toISOString();
  await supabase.from('search_cache').upsert({
    query: key,
    results: results,
    embedding: embedding,
    created_at: now,
  });

  return Response.json({ results: processResults(results), checkedAt: now });
}
