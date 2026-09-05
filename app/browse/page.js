import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import ListingCard from '@/components/ListingCard';
import { requireDevAccess } from '@/lib/devAuth';

// Marketplace naršymo feed'as (kol kas /browse — dev peržiūra; landing yra "/").
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export const dynamic = 'force-dynamic';

export default async function Browse() {
  await requireDevAccess(); // tik kūrėjas (slaptažodis) mato marketplace

  const { data: listings } = await supabase
    .from('listings')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(60);

  const items = listings || [];

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-6">
        <nav className="flex items-center justify-between h-16 border-b border-white/8">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight text-txt">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M8 5.3h8l4 6.9-4 6.9H8l-4-6.9 4-6.9z" stroke="#7fd1e6" strokeWidth="1.6" strokeLinejoin="round" />
              <circle cx="12" cy="12.2" r="3.1" stroke="#7fd1e6" strokeWidth="1.6" />
            </svg>
            Detalo
          </Link>
          <Link href="/sell" className="bg-frost text-frostink font-semibold text-sm px-4 py-2 rounded-lg hover:brightness-110">
            + Parduoti
          </Link>
        </nav>

        <section className="pt-14 pb-8 max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight leading-tight text-txt">
            Mopedų dalys — pirk ir parduok saugiai.
          </h1>
          <p className="text-muted text-base mt-4 leading-relaxed">
            Vieta, kur mopedų bendruomenė perka ir parduoda dalis — su tikromis kainomis,
            aiškiais skelbimais ir apsauga. Be „Facebook grupių" chaoso.
          </p>
        </section>

        {items.length === 0 ? (
          <p className="text-dim mt-8">Kol kas skelbimų nėra. Būk pirmas — <Link href="/sell" className="text-frost">įkelk skelbimą</Link>.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6 pb-16">
            {items.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
