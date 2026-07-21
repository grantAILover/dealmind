import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();
const cache = new Map();


export async function POST(request) {
  const body = await request.json();
  const key = body.query.toLowerCase().trim();

  if (cache.has(key)) {
  return Response.json({ results: cache.get(key) });
}

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `You are a deal-finding assistant. The user is searching for: "${body.query}".
Generate 3 realistic product results for this search as a JSON array.
Each object must have: id (number), name (string), price (number in EUR), dealScore (number between 0 and 100).
Also calculate a "Deal Score" for each product based on the price and the relative value of the product compared to its category.
The Deal Score should be a number between 0 and 100, where a higher score indicates a better deal.
Respond ONLY with the JSON array, no other text.`
      }
    ]
  });

  const text = message.content[0].text.replace(/```json|```/g, "").trim();
  const results = JSON.parse(text);
  cache.set(key, results);
  return Response.json({ results: results });
}