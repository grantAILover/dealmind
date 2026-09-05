import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export async function POST(request) {
  let email;
  try {
    ({ email } = await request.json());
  } catch {
    return Response.json({ error: 'invalid' }, { status: 400 });
  }

  // Paprasta el. pašto validacija.
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: 'invalid' }, { status: 400 });
  }

  const { error } = await supabase
    .from('waitlist')
    .insert({ email: email.toLowerCase().trim() });

  if (error) {
    // 23505 = unique pažeidimas → jau užsiregistravęs (traktuojam kaip sėkmę).
    if (error.code === '23505') return Response.json({ ok: true, already: true });
    return Response.json({ error: 'server' }, { status: 500 });
  }

  return Response.json({ ok: true });
}
