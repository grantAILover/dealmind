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
      max_tokens: 1500,
      tools: [
        // deno-lint-ignore no-explicit-any
        // SENESNIS web_search_20250305 — naujasis (dynamic filtering / code execution) KABO
        // >150s sudėtingoms dalių užklausoms; senasis grįžta per ~15-30s. max_uses 4 — kad
        // surinktų pakankamai duomenų 3 skelbimams.
        { type: 'web_search_20250305', name: 'web_search', max_uses: 4 } as any,
      ],
      messages: [
        {
          role: 'user',
          content: `Search European car-parts stores — prioritize ${stores} — for the part "${part}" that fits this car: ${car} (condition preference: "${condition}").
Based on the search results, return your 3 best real matches. Use the real product/brand and store names you actually found in the results.
For price, use the price shown in a result, or your best estimate of the typical price from what you saw (approximate is fine — prices are shown to users as indicative).
IMPORTANT: ALWAYS output the JSON array with the best available real data — never refuse or explain that you couldn't verify. Respond with ONLY a JSON array of 3 objects, each with:
- id (number)
- name (string, real part name incl. brand)
- price (number, EUR — real or best estimate from the results)
- store (string, the store)
- url (string, link to the part's page or the store's search for it)
- image (string, direct photo URL if you saw one, else "")
- condition (string: "OEM", "Aftermarket", or "Used")
- partNumber (string, the OEM/manufacturer number if visible in the results, else "")
- fits (string, short fitment note, e.g. "Fits VW Golf 7 2.0 TDI 2013-2020")
- dealScore (number 0-100: how good the price is vs the part's typical price)
Output ONLY the JSON array, no other text.`,
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
