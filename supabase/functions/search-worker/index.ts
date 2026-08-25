// Supabase Edge Function: search-worker
// Atlieka LĖTĄ Claude web paiešką ANT SUPABASE (iki 150s wall-clock), NE ant Vercel —
// taip Vercel 60s limitas nebenužudo paieškos. Kviečia Vercel /api/search route'as.
// Paiešką paleidžia FONE (EdgeRuntime.waitUntil) ir iškart grąžina ACK, tada rašo į DB.
import { createClient } from 'npm:@supabase/supabase-js@2';

// EdgeRuntime nėra tipuotas Deno TS — deklaruojam, kad TS nesiskųstų.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

// Fono darbo neapdorotos klaidos — pagaunam, kad worker'is gražiai užsidarytų.
addEventListener('unhandledrejection', (ev) => {
  console.error('unhandledrejection', (ev as PromiseRejectionEvent).reason);
  (ev as PromiseRejectionEvent).preventDefault();
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Ištraukia JSON masyvą iš teksto (skliaustų gylio skenavimas, praleidžia kabutes).
// Tas pats algoritmas kaip Vercel pusėje — ignoruoja citatas [1],[2] po masyvo.
function extractJsonArray(text: string): string | null {
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
    else if (c === ']') { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

// Tikra paieška + įrašymas. Vyksta FONE (per waitUntil), iki 150s.
async function runSearch(payload: {
  jobId: string; car: string; part: string; condition: string;
  stores: string; domains: string[]; key: string; embedding: number[];
}) {
  const { jobId, car, part, condition, stores, domains, key, embedding } = payload;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        tools: [
          { type: 'web_search_20260209', name: 'web_search', max_uses: 1, allowed_domains: domains },
        ],
        messages: [
          {
            role: 'user',
            content: `Find a real, currently available CAR PART for this vehicle.
Car: "${car}"
Part needed: "${part}"
Condition preference: "${condition}" (if "Any", include a mix; otherwise prefer that condition).

First, based on the exact engine/variant, determine the correct part specification for this car.
Then search the web — PRIORITIZE ${stores} — for 3 real listings that FIT this specific car, with REAL current prices in EUR.
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
Respond with ONLY the JSON array, no other text.`,
          },
        ],
      }),
    });

    const message = await res.json();
    const fullText = (message.content || [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('');

    const jsonText = extractJsonArray(fullText);
    if (!jsonText) {
      await supabase.from('search_jobs').update({ status: 'error' }).eq('id', jobId);
      return;
    }
    const results = JSON.parse(jsonText);
    const now = new Date().toISOString();

    // Raw rezultatai į cache (su embedding — ateities semantinei paieškai).
    await supabase.from('search_cache').upsert({ query: key, results, embedding, created_at: now });
    // Raw į job'ą + status done. (Vercel GET apdoros nuorodas/affiliate pagal job.region.)
    await supabase.from('search_jobs').update({ status: 'done', results }).eq('id', jobId);
  } catch (err) {
    console.error('runSearch error', err);
    await supabase.from('search_jobs').update({ status: 'error' }).eq('id', jobId);
  }
}

Deno.serve(async (req) => {
  const payload = await req.json();
  // Paleidžiam paiešką FONE ir IŠKART grąžinam ACK — Vercel nelaukia lėtos paieškos.
  EdgeRuntime.waitUntil(runSearch(payload));
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  });
});
