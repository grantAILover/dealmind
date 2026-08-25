"use client";
import { track } from '@vercel/analytics';

export default function ProductCard({ name, price, dealScore, store, url, image, condition, fits, partNumber, isSaved, onToggleSave }) {
  // Subtilus deal indikatorius (dot + žodis) vietoj loud spalvoto skaičiaus badge'o.
  let dealLabel, dealText, dotColor;
  if (dealScore >= 80) { dealLabel = "Great price"; dealText = "text-frost"; dotColor = "bg-frost"; }
  else if (dealScore >= 60) { dealLabel = "Fair price"; dealText = "text-amberw"; dotColor = "bg-amberw"; }
  else { dealLabel = "Check price"; dealText = "text-dim"; dotColor = "bg-dim"; }

  return (
    <div className="bg-panel border border-white/8 rounded-xl p-4 flex flex-col transition-colors hover:border-frost/35">
      {/* Nuotrauka viršuje. Sulūžusią (onError) paslepiam. */}
      {image && (
        <img
          src={image}
          alt={name}
          className="w-full h-36 object-contain rounded-lg bg-panel2 mb-3"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}

      <p className="text-txt font-semibold text-sm leading-snug line-clamp-2">{name}</p>

      <div className="h-px bg-white/8 my-3" />

      {/* Fitment — frost check ikona */}
      {fits && (
        <div className="flex items-center gap-2 text-[13px] text-txt mb-2.5">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0">
            <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#7fd1e6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="line-clamp-1">{fits}</span>
        </div>
      )}

      {/* Spec eilutės — techninis "katalogo įrašo" jausmas */}
      <div className="flex flex-col gap-1.5 text-xs mb-3.5">
        {partNumber && (
          <div className="flex justify-between gap-2">
            <span className="text-dim">OEM number</span>
            <span className="text-muted font-mono">{partNumber}</span>
          </div>
        )}
        {condition && (
          <div className="flex justify-between gap-2 items-center">
            <span className="text-dim">Type</span>
            <span className="text-muted border border-white/12 rounded px-2 py-0.5">{condition}</span>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <span className="text-dim">Store</span>
          <span className="text-muted">{store}</span>
        </div>
      </div>

      {/* Kaina + deal indikatorius */}
      <div className="flex items-baseline justify-between mb-3.5 mt-auto">
        <span className="text-xl font-bold text-txt tracking-tight">€{price}</span>
        <span className={`flex items-center gap-1.5 text-[11.5px] ${dealText}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
          {dealLabel}
        </span>
      </div>

      {/* Mygtukai */}
      <div className="flex gap-2">
        <a
          href={url}
          target="_blank"
          rel="sponsored noopener noreferrer"
          onClick={() => track('view_deal', { store: store, dealScore: dealScore })}
          className="flex-1 flex items-center justify-center gap-1.5 bg-frost text-frostink font-semibold text-[13px] text-center px-3 py-2 rounded-lg hover:brightness-110"
        >
          View deal
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M7 17L17 7M17 7H9M17 7v8" stroke="#08222c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
        <button
          onClick={onToggleSave}
          aria-label={isSaved ? "Saved" : "Save"}
          className={`px-3 py-2 rounded-lg border flex items-center ${isSaved ? 'bg-frost/15 border-frost/40 text-frost' : 'border-white/12 text-muted hover:text-txt'}`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill={isSaved ? '#7fd1e6' : 'none'}>
            <path d="M6 4h12v16l-6-4-6 4V4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
