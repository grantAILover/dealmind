import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireDevAccess } from '@/lib/devAuth';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export const dynamic = 'force-dynamic';

// Next 16: params yra async — būtina await'inti.
export default async function ListingPage({ params }) {
  await requireDevAccess(); // tik kūrėjas mato skelbimus (kol landing režimas)
  const { id } = await params;

  const { data: listing } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!listing) notFound();

  const { title, description, price, category, moped_make, moped_model, condition, location, images } = listing;
  const cover = images && images.length > 0 ? images[0] : null;

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-6">
        {/* NAV */}
        <nav className="flex items-center justify-between h-16 border-b border-white/8">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight text-txt">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M8 5.3h8l4 6.9-4 6.9H8l-4-6.9 4-6.9z" stroke="#7fd1e6" strokeWidth="1.6" strokeLinejoin="round" />
              <circle cx="12" cy="12.2" r="3.1" stroke="#7fd1e6" strokeWidth="1.6" />
            </svg>
            Detalo
          </Link>
          <Link href="/" className="text-muted text-sm hover:text-txt">← Atgal</Link>
        </nav>

        <div className="grid md:grid-cols-2 gap-8 pt-8 pb-16">
          {/* Nuotrauka */}
          <div className="bg-panel border border-white/8 rounded-xl h-80 flex items-center justify-center overflow-hidden">
            {cover ? (
              <img src={cover} alt={title} className="w-full h-full object-cover" />
            ) : (
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="opacity-25">
                <circle cx="6" cy="17" r="3" stroke="#647689" strokeWidth="1.4" />
                <circle cx="18" cy="17" r="3" stroke="#647689" strokeWidth="1.4" />
                <path d="M6 17h6l3-6h4M9 11h4l2 6" stroke="#647689" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-txt leading-tight">{title}</h1>
            <p className="text-3xl font-bold text-txt mt-3">€{price}</p>

            <div className="flex flex-col gap-2 text-sm mt-5">
              {(moped_make || moped_model) && (
                <div className="flex justify-between gap-2"><span className="text-dim">Mopedas</span><span className="text-muted">{[moped_make, moped_model].filter(Boolean).join(' ')}</span></div>
              )}
              {category && <div className="flex justify-between gap-2"><span className="text-dim">Tipas</span><span className="text-muted">{category}</span></div>}
              {condition && <div className="flex justify-between gap-2"><span className="text-dim">Būklė</span><span className="text-muted">{condition}</span></div>}
              {location && <div className="flex justify-between gap-2"><span className="text-dim">Vieta</span><span className="text-muted">{location}</span></div>}
            </div>

            {description && (
              <p className="text-muted text-sm leading-relaxed mt-5 whitespace-pre-line border-t border-white/8 pt-5">{description}</p>
            )}

            {/* Kontaktas — kol nėra auth/žinučių, placeholder mygtukas */}
            <button
              disabled
              className="mt-auto w-full bg-frost text-frostink font-semibold py-2.5 rounded-lg mt-6 opacity-60 cursor-not-allowed"
            >
              Susisiekti su pardavėju (netrukus)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
