import { cookies } from 'next/headers';

// Patikrina dev slaptažodį ir nustato httpOnly cookie (galioja 30 d.).
export async function POST(request) {
  let password;
  try {
    ({ password } = await request.json());
  } catch {
    return Response.json({ error: 'invalid' }, { status: 400 });
  }

  if (!process.env.DEV_PASSWORD || password !== process.env.DEV_PASSWORD) {
    return Response.json({ error: 'wrong' }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set('dev_access', process.env.DEV_PASSWORD, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // localhost = http, tad tik prod'e secure
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 dienų
  });

  return Response.json({ ok: true });
}
