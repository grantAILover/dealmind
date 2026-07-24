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

  // 1. Patikrinam cache DUOMENŲ BAZĖJE (ne atmintyje) — išlieka ir bendra visiems serveriams.
  // { data: cached } — destructuring (Day 2!). .eq('query', key) = "kur stulpelis query lygus key".
  // .maybeSingle() = grąžink vieną eilutę arba null, jei nerasta.
  const { data: cached } = await supabase
    .from('search_cache')
    .select('results')
    .eq('query', key)
    .maybeSingle();

  if (cached) {
    return Response.json({ results: cached.results });
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

  // Išsaugom į duomenų bazę. upsert = "įrašyk; o jei toks query jau yra, atnaujink".
  await supabase.from('search_cache').upsert({ query: key, results: results });

  return Response.json({ results: results });
}
