import { createClient } from '@supabase/supabase-js';

// Claude paieška dabar vyksta Supabase Edge Function'e (search-worker), ne čia —
// todėl Anthropic SDK ir after() nebereikia. Vercel tik pažadina worker'į.
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export const maxDuration = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

// Ar cache įrašas dar šviežias (jaunesnis nei 24h)?
function isFresh(created_at) {
  return Date.now() - new Date(created_at).getTime() < DAY_MS;
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
    // allowed_domains web search'ui: apriboja paiešką tik iki šių parduotuvių →
    // mažiau atsitiktinio web turinio (pigiau) + patikimesnis fitment (be blog'ų/forumų).
    domains: ['autodoc.lt', 'ovoko.lt', 'autoplius.lt', 'rrr.lt', 'kfzteile24.de', 'amazon.de', 'ebay.com'],
    autodoc: 'https://www.autodoc.lt/search?keyword=',
    amazon: 'https://www.amazon.de/s?k=',        // nėra amazon.lt; .de veža į LT (turi EN kalbos jungiklį)
    ebay: 'https://www.ebay.com/sch/i.html?_nkw=', // .com angliškas/tarptautinis, draugiškesnis nei .de
    google: 'https://www.google.lt/search?q=',
  },
  Germany: {
    stores: 'German stores (Autodoc.de, kfzteile24.de, eBay.de, Amazon.de, oscaro.de)',
    domains: ['autodoc.de', 'kfzteile24.de', 'ebay.de', 'amazon.de', 'oscaro.de'],
    autodoc: 'https://www.autodoc.de/search?keyword=',
    amazon: 'https://www.amazon.de/s?k=',
    ebay: 'https://www.ebay.de/sch/i.html?_nkw=',
    google: 'https://www.google.de/search?q=',
  },
  Europe: {
    stores: 'European car-parts stores (Autodoc, kfzteile24, eBay Motors, Amazon.de, oscaro)',
    domains: ['autodoc.de', 'kfzteile24.de', 'amazon.de', 'ebay.com', 'oscaro.com', 'mister-auto.com'],
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

// ── PAIEŠKŲ LIMITAS pagal IP (saugo kreditus): 3 ŠVIEŽIOS paieškos / 24h. ──
// Cache hit'ai šitos funkcijos NEKVIEČIA → nemokami ir neriboti.
const SEARCH_LIMIT = 3;

async function checkAndConsume(ip) {
  const now = Date.now();
  const { data: row } = await supabase
    .from('rate_limits')
    .select('count, window_start')
    .eq('ip', ip)
    .maybeSingle();

  // Ar dabartinis 24h langas dar galioja? Jei ne (arba nėra įrašo) — pradedam naują langą.
  let count = 0;
  let windowStart = now;
  if (row && (now - new Date(row.window_start).getTime() < DAY_MS)) {
    count = row.count;
    windowStart = new Date(row.window_start).getTime();
  }

  if (count >= SEARCH_LIMIT) {
    return { allowed: false, resetAt: new Date(windowStart + DAY_MS).toISOString() };
  }

  // Suvartojam vieną — įrašom padidintą skaičių (window_start lieka to paties lango).
  await supabase.from('rate_limits').upsert({
    ip,
    count: count + 1,
    window_start: new Date(windowStart).toISOString(),
  });
  return { allowed: true, remaining: SEARCH_LIMIT - (count + 1) };
}

// ── PAŽADINA Supabase Edge Function (search-worker), kuri atlieka LĖTĄ paiešką ant Supabase. ──
// Grąžina greitą ACK (~1s); pati paieška tęsiasi FONE Supabase pusėje iki 150s (ne Vercel 60s).
async function triggerWorker(payload) {
  const res = await fetch(`${process.env.SUPABASE_URL}/functions/v1/search-worker`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  // fetch nemeta klaidos ant HTTP 4xx/5xx — patikrinam patys, kad blogas auth/pavadinimas
  // iškart iškiltų (ne tyliai paliktų job'ą "pending" 90s).
  if (!res.ok) {
    throw new Error(`worker trigger failed: ${res.status}`);
  }
}

// ── START: naršyklė kviečia čia. Grąžina GREITAI (cache arba jobId), nelaukia paieškos. ──
export async function POST(request) {
  const body = await request.json();
  const { car, part, condition, region } = body;
  // Vartotojo IP (Vercel deda x-forwarded-for). Naudojam limitui pagal IP.
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
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

  // Limitas tikrinamas TIK ČIA — po to, kai jau žinom, kad tai ŠVIEŽIA (mokama) paieška.
  // Cache hit'ai grįžo aukščiau ir limito nepalietė (nemokami).
  const gate = await checkAndConsume(ip);
  if (!gate.allowed) {
    return Response.json({
      error: 'rate_limit',
      message: 'You have used your 3 free searches. Please try again tomorrow.',
      resetAt: gate.resetAt,
    }, { status: 429 });
  }

  // 3. Nieko cache'e — sukuriam "job" eilutę (su regionu, kad GET galėtų apdoroti rezultatus).
  const { data: job, error: jobErr } = await supabase
    .from('search_jobs')
    .insert({ status: 'pending', region })
    .select('id')
    .single();

  if (jobErr || !job) {
    return Response.json({ error: 'Could not start search' }, { status: 500 });
  }

  // Pažadinam Edge Function — ji atliks lėtą paiešką ant Supabase (iki 150s). await'inam tik greitą
  // ACK; jei pažadinimas nepavyksta, pažymim job error, kad naršyklė nekabėtų.
  try {
    await triggerWorker({
      jobId: job.id,
      car, part, condition,
      stores: regionCfg.stores,
      domains: regionCfg.domains,
      key,
      embedding,
    });
  } catch (err) {
    await supabase.from('search_jobs').update({ status: 'error' }).eq('id', job.id);
    return Response.json({ error: 'Could not start search' }, { status: 500 });
  }

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
    .select('status, results, created_at, region')
    .eq('id', jobId)
    .maybeSingle();

  if (!job) {
    return Response.json({ error: 'Job not found' }, { status: 404 });
  }
  if (job.status === 'done') {
    // Job'e saugom RAW rezultatus — apdorojam (regiono URL + affiliate) ČIA, pagal job.region.
    const regionCfg = REGIONS[job.region] || REGIONS.Europe;
    return Response.json({ status: 'done', results: processResults(job.results, regionCfg), checkedAt: job.created_at });
  }
  // "pending" arba "error" — naršyklė pagal tai arba klausia toliau, arba nustoja.
  return Response.json({ status: job.status });
}
