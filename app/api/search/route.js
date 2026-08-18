import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { after } from 'next/server'; // suplanuoja darbą PO atsakymo išsiuntimo (fono paieška)

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

// Regionų nustatymai: kokias parduotuves prioritetizuoti (prompt'e) ir kokie
// domenai statant paieškos nuorodas. Amazon/eBay neturi .lt, tad Lietuvai
// vedam į .de (jie veža į LT) + vietinius autodoc.lt / ovoko.lt / autoplius.lt.
const REGIONS = {
  Lithuania: {
    stores: 'Lithuanian stores (autodoc.lt, ovoko.lt, autoplius.lt, rrr.lt) and EU stores that ship to Lithuania',
    autodoc: 'https://www.autodoc.lt/search?keyword=',
    amazon: 'https://www.amazon.de/s?k=',        // nėra amazon.lt; .de veža į LT (turi EN kalbos jungiklį)
    ebay: 'https://www.ebay.com/sch/i.html?_nkw=', // .com angliškas/tarptautinis, draugiškesnis nei .de
    google: 'https://www.google.lt/search?q=',
  },
  Germany: {
    stores: 'German stores (Autodoc.de, kfzteile24.de, eBay.de, Amazon.de, oscaro.de)',
    autodoc: 'https://www.autodoc.de/search?keyword=',
    amazon: 'https://www.amazon.de/s?k=',
    ebay: 'https://www.ebay.de/sch/i.html?_nkw=',
    google: 'https://www.google.de/search?q=',
  },
  Europe: {
    stores: 'European car-parts stores (Autodoc, kfzteile24, eBay Motors, Amazon.de, oscaro)',
    autodoc: 'https://www.autodoc.de/search?keyword=',
    amazon: 'https://www.amazon.de/s?k=',
    ebay: 'https://www.ebay.de/sch/i.html?_nkw=',
    google: 'https://www.google.com/search?q=',
  },
};

// Sukuria PAIEŠKOS nuorodą parduotuvėje pagal dalies pavadinimą.
// Claude URL nepatikimi (išgalvoti → pradinis puslapis ar ne ta prekė),
// tad vedam vartotoją į parduotuvės paiešką su ta dalimi — visada relevantiška.
function storeSearchUrl(product, regionCfg) {
  const q = encodeURIComponent(product.name || '');
  const store = (product.store || '').toLowerCase();
  // Tik patikrintai veikiantys formatai, domenas pagal regioną. Kiti → Google.
  if (store.includes('amazon')) return `${regionCfg.amazon}${q}`;
  if (store.includes('ebay')) return `${regionCfg.ebay}${q}`;
  if (store.includes('autodoc')) return `${regionCfg.autodoc}${q}`;
  // Nežinoma / nepatikrinta parduotuvė → regiono Google paieška.
  return `${regionCfg.google}${q}`;
}

function withAffiliate(product, regionCfg) {
  const storeLower = (product.store || '').toLowerCase();
  const affiliate = AFFILIATE_STORES.find(a => storeLower.includes(a.match));
  const isAffiliate = Boolean(affiliate);

  // Naudojam paieškos URL vietoj (nepatikimo) Claude produkto URL.
  let url = storeSearchUrl(product, regionCfg);
  if (affiliate) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}tag=${affiliate.tag}`;
  }
  return { ...product, url, isAffiliate };
}

function processResults(results, regionCfg) {
  return results
    .map(product => withAffiliate(product, regionCfg))
    .sort((a, b) => (b.isAffiliate ? 1 : 0) - (a.isAffiliate ? 1 : 0));
}

// ── LĖTAS DARBAS (vyksta FONE per after(), po to kai POST jau grąžino jobId) ──
// Padaro tikrą Claude web paiešką ir įrašo rezultatus į job eilutę (+ į cache).
async function runSearch(jobId, key, embedding, car, part, condition, regionCfg) {
  try {
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

First, based on the exact engine/variant, determine the correct part specification for this car.
Then search the web — PRIORITIZE ${regionCfg.stores} — for 3 real listings that FIT this specific car, with REAL current prices in EUR.
Prefer listings the buyer in this region can actually order (in stock, ships to them). Only include parts that genuinely fit the given car — fitment accuracy is critical.
Each object must have:
- id (number)
- name (string, the real part name incl. brand)
- price (number, the real current price in EUR)
- store (string, the store where you found it)
- url (string, direct link to the part's page)
- image (string, direct URL to a photo of the part, ideally .jpg/.png/.webp)
- condition (string: "OEM", "Aftermarket", or "Used")
- partNumber (string, the manufacturer/OEM part number EXACTLY as shown on the real listing you found — do NOT guess or invent one; use "" if you do not actually see a part number)
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
      await supabase.from('search_jobs').update({ status: 'error' }).eq('id', jobId);
      return;
    }
    const results = JSON.parse(jsonText);
    const now = new Date().toISOString();

    // Saugom RAW rezultatus cache'e su embedding (kad ateity semantinė paieška juos rastų;
    // raw = be affiliate tag'o, kad tag'o keitimas galiotų iškart visiems).
    await supabase.from('search_cache').upsert({
      query: key,
      results: results,
      embedding: embedding,
      created_at: now,
    });

    // Job eilutėje saugom jau APDOROTUS rezultatus (su regiono URL + affiliate),
    // kad GET/status galėtų juos grąžinti tiesiai (jis regiono nežino, tik jobId).
    await supabase.from('search_jobs')
      .update({ status: 'done', results: processResults(results, regionCfg) })
      .eq('id', jobId);
  } catch (err) {
    // Klaida (pvz. Claude nepavyko) → pažymim job kaip "error", kad naršyklė nustotų klausinėti.
    await supabase.from('search_jobs').update({ status: 'error' }).eq('id', jobId);
  }
}

// ── START: naršyklė kviečia čia. Grąžina GREITAI (cache arba jobId), nelaukia paieškos. ──
export async function POST(request) {
  const body = await request.json();
  const { car, part, condition, region } = body;
  const regionCfg = REGIONS[region] || REGIONS.Europe; // nežinomas/tuščias → Visa Europa
  // Cache raktas iš VISŲ laukų. Regionas SVARBUS: LT ir DE turi skirtingas parduotuves
  // ir kainas, tad to paties įrašo negalim grąžinti abiem (kitaip lietuvis gautų vokiškus).
  const key = `${car} | ${part} | ${condition} | ${region}`.toLowerCase().trim();

  // 1. TIKSLUS cache (nemokamas — be embedding). Jei toks pat tekstas ir šviežias → grąžinam IŠKART.
  const { data: exact } = await supabase
    .from('search_cache')
    .select('results, created_at')
    .eq('query', key)
    .maybeSingle();

  if (exact && isFresh(exact.created_at)) {
    return Response.json({ status: 'done', results: processResults(exact.results, regionCfg), checkedAt: exact.created_at });
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
    return Response.json({ status: 'done', results: processResults(matches[0].results, regionCfg), checkedAt: matches[0].created_at });
  }

  // 3. Nieko cache'e — sukuriam "job" eilutę (skambutuką) ir paleidžiam paiešką FONE.
  const { data: job, error: jobErr } = await supabase
    .from('search_jobs')
    .insert({ status: 'pending' })
    .select('id')
    .single();

  if (jobErr || !job) {
    return Response.json({ error: 'Could not start search' }, { status: 500 });
  }

  // after() paleidžia runSearch TIK PO to, kai grąžinsim atsakymą žemiau — naršyklė nebelaukia
  // 90s (jokio timeout'o kliento pusėje). Fono darbas turi iki maxDuration (60s).
  after(() => runSearch(job.id, key, embedding, car, part, condition, regionCfg));

  return Response.json({ status: 'pending', jobId: job.id });
}

// ── STATUS: naršyklė klausia kas 3s "ar jobId paruošta?". Grąžina pending / done / error. ──
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');
  if (!jobId) {
    return Response.json({ error: 'Missing jobId' }, { status: 400 });
  }

  const { data: job } = await supabase
    .from('search_jobs')
    .select('status, results, created_at')
    .eq('id', jobId)
    .maybeSingle();

  if (!job) {
    return Response.json({ error: 'Job not found' }, { status: 404 });
  }
  if (job.status === 'done') {
    return Response.json({ status: 'done', results: job.results, checkedAt: job.created_at });
  }
  // "pending" arba "error" — naršyklė pagal tai arba klausia toliau, arba nustoja.
  return Response.json({ status: job.status });
}
