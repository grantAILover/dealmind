import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();
const cache = new Map();

// Web search užtrunka ilgai — prašome Vercel duoti funkcijai iki 60s
// (nemokamo plano maksimumas), kad paieška nebūtų nutraukta.
export const maxDuration = 60;

export async function POST(request) {
  const body = await request.json();
  const key = body.query.toLowerCase().trim();

  if (cache.has(key)) {
    return Response.json({ results: cache.get(key) });
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    // Naujas dalykas: duodame Claude web search įrankį.
    // max_uses riboja, kiek kartų jis gali ieškoti (kad nekainuotų per daug).
    tools: [
      { type: 'web_search_20260209', name: 'web_search', max_uses: 5 }
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
  const results = JSON.parse(fullText.slice(start, end + 1));

  cache.set(key, results);
  return Response.json({ results: results });
}
