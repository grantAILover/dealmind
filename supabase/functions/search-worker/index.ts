// Supabase Edge Function: search-worker
// Atlieka LĖTĄ Claude web paiešką ANT SUPABASE (iki 150s wall-clock), NE ant Vercel.
// Naudoja Anthropic SDK (ta pati užklausa kaip Vercel'yje veikė) + timing logai + 130s timeout.
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';

// EdgeRuntime nėra tipuotas Deno TS — deklaruojam, kad TS nesiskųstų.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

addEventListener('unhandledrejection', (ev) => {
  console.error('unhandledrejection', (ev as PromiseRejectionEvent).reason);
  (ev as PromiseRejectionEvent).preventDefault();
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);
// maxRetries: 0 — kad SDK nepakartotų lėtos/pakibusios užklausos (nedaugintų 130s × 3).
const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')!, maxRetries: 0 });

// Ištraukia JSON masyvą iš teksto (skliaustų gylio skenavimas, praleidžia kabutes).
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

// deno-lint-ignore no-explicit-any
async function runSearch(payload: any) {
  const { jobId, car, part, condition, stores, domains, key, embedding } = payload;
  const t0 = Date.now();
  const secs = () => ((Date.now() - t0) / 1000).toFixed(1);
  try {
    console.log(`[${jobId}] runSearch start`);
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      tools: [
        // deno-lint-ignore no-explicit-any
        { type: 'web_search_20260209', name: 'web_search', max_uses: 1, allowed_domains: domains } as any,
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
    }, { timeout: 130000 }); // 130s saugiklis (< 150s wall clock) — kad kabimas taptų error

    console.log(`[${jobId}] anthropic returned in ${secs()}s stop_reason=${message.stop_reason} blocks=${message.content.length}`);

    const fullText = message.content
      // deno-lint-ignore no-explicit-any
      .filter((b: any) => b.type === 'text')
      // deno-lint-ignore no-explicit-any
      .map((b: any) => b.text)
      .join('');

    const jsonText = extractJsonArray(fullText);
    if (!jsonText) {
      console.log(`[${jobId}] no JSON array in response`);
      await supabase.from('search_jobs').update({ status: 'error' }).eq('id', jobId);
      return;
    }
    const results = JSON.parse(jsonText);
    const now = new Date().toISOString();

    await supabase.from('search_cache').upsert({ query: key, results, embedding, created_at: now });
    await supabase.from('search_jobs').update({ status: 'done', results }).eq('id', jobId);
    console.log(`[${jobId}] DONE in ${secs()}s with ${results.length} results`);
  } catch (err) {
    console.error(`[${jobId}] runSearch error after ${secs()}s`, err);
    await supabase.from('search_jobs').update({ status: 'error' }).eq('id', jobId);
  }
}

Deno.serve(async (req) => {
  const payload = await req.json();
  EdgeRuntime.waitUntil(runSearch(payload));
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  });
});
