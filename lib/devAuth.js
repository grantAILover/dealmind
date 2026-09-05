import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// Paprasti dev vartai: puslapis kviečia šitą — jei nėra teisingo cookie, meta į /dev-login.
// NE pilnas auth (tai bus vėliau su Supabase Auth) — tik kad marketplace matytum tik TU.
export async function requireDevAccess() {
  const cookieStore = await cookies();
  const ok =
    process.env.DEV_PASSWORD &&
    cookieStore.get('dev_access')?.value === process.env.DEV_PASSWORD;
  if (!ok) redirect('/dev-login');
}
