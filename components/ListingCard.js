import Link from 'next/link';

// Viena skelbimo kortelė feed'e. Kaina REALI (pardavėjo nustatyta) — nebe spėjimas.
export default function ListingCard({ listing }) {
  const { id, title, price, moped_make, moped_model, condition, location, images } = listing;
  const cover = images && images.length > 0 ? images[0] : null;

  return (
    <Link
      href={`/listing/${id}`}
      className="bg-panel border border-white/8 rounded-xl overflow-hidden flex flex-col transition-colors hover:border-frost/35"
    >
      {/* Nuotrauka arba placeholder (kol nėra įkėlimo) */}
      <div className="h-40 bg-panel2 flex items-center justify-center">
        {cover ? (
          <img src={cover} alt={title} className="w-full h-full object-cover" />
        ) : (
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="opacity-30">
            {/* paprasta mopedo/rato ikona vietoj tuščios dėžės */}
            <circle cx="6" cy="17" r="3" stroke="#647689" strokeWidth="1.6" />
            <circle cx="18" cy="17" r="3" stroke="#647689" strokeWidth="1.6" />
            <path d="M6 17h6l3-6h4M9 11h4l2 6" stroke="#647689" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <p className="text-txt font-semibold text-sm leading-snug line-clamp-2">{title}</p>

        {(moped_make || moped_model) && (
          <p className="text-dim text-xs">{[moped_make, moped_model].filter(Boolean).join(' ')}</p>
        )}

        <div className="flex items-center gap-2 mt-auto pt-1">
          {condition && (
            <span className="text-[11px] text-muted border border-white/12 rounded px-2 py-0.5">{condition}</span>
          )}
          {location && <span className="text-[11px] text-dim">{location}</span>}
        </div>

        <p className="text-lg font-bold text-txt tracking-tight mt-1">€{price}</p>
      </div>
    </Link>
  );
}
