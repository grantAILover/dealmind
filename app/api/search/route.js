import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const client = new Anthropic();
// Supabase klientas jungiasi prie tavo duomenų bazės (URL + slaptas raktas iš .env.local).
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Web search užtrunka ilgai — prašome Vercel duoti funkcijai iki 60s
// (nemokamo plano maksimumas), kad paieška nebūtų nutraukta.
export const maxDuration = 60;

export async function POST(request) {
  const body = await request.json();
  const key = body.query.toLowerCase().trim();

  // 1. Patikrinam cache DUOMENŲ BAZĖJE. Imame ir created_at — kada įrašyta (TTL patikrai).
  const { data: cached } = await supabase
    .from('search_cache')
    .select('results, created_at')
    .eq('query', key)
    .maybeSingle();

  // TTL: naudojame cache TIK jei jis šviežesnis nei 24 valandos.
  const DAY_MS = 24 * 60 * 60 * 1000;
  if (cached) {
    // Kiek laiko praėjo nuo įrašymo (milisekundėmis).
    const ageMs = Date.now() - new Date(cached.created_at).getTime();
    if (ageMs < DAY_MS) {
      // Dar šviežias — grąžinam iš cache + kada patikrinta.
      return Response.json({ results: cached.results, checkedAt: cached.created_at });
    }
    // Senesnis nei 24h — NEgrąžinam, o einam ieškoti šviežių kainų žemiau.
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    // Web search įrankis. max_uses riboja, kiek kartų jis gali ieškoti
    // (kad nekainuotų per daug).
    tools: [
      { type: 'web_search_20260209', name: 'web_search', max_uses: 2 }
    ],
    messages: [
      {
        role: 'user',
        content: `Search the web for real, currently available products matching: "${body.query}".
Find 3 real products sold by online stores that ship to Europe, with their REAL current prices.
Each object must have:
- id (number)
- name (string, the real product name)
- price (number, the real current price in EUR)
- store (string, the name of the store where you found it)
- dealScore (number 0-100: how good this price is relative to the product's typical price and its category)
Respond with ONLY the JSON array, no other text.`
      }
    ]
  });

  // Su web search atsakymas yra MASYVAS blokų (paieškos + tekstas).
  // 1. Išrenkame tik teksto blokus (.filter), 2. paimame jų tekstą (.map),
  // 3. sujungiame į vieną string'ą (.join) — tai jau tau pažįstami Day 2-3 metodai.
  const fullText = message.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');

  // Claude su paieška kartais prideda paaiškinamojo teksto aplink JSON.
  // Todėl ištraukiame tik dalį nuo pirmo "[" iki paskutinio "]" — patį masyvą.
  const start = fullText.indexOf('[');
  const end = fullText.lastIndexOf(']');

  // Apsauga: jei modelis negrąžino JSON masyvo (nerado kainų ar pan.),
  // nenulūžtame — grąžiname klaidą, kurią naršyklė parodys raudonai.
  if (start === -1 || end === -1) {
    return Response.json({ error: "No results found" }, { status: 500 });
  }

  const results = JSON.parse(fullText.slice(start, end + 1));

  // Išsaugom su ŠVIEŽIA data. created_at nustatome patys į "dabar", nes upsert
  // atnaujindamas seną eilutę kitaip paliktų seną datą (ir liktų amžinai "pasenęs").
  const now = new Date().toISOString();
  await supabase.from('search_cache').upsert({ query: key, results: results, created_at: now });

  return Response.json({ results: results, checkedAt: now });
}
