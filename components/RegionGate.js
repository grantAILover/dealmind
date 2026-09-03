"use client";
import { useState } from 'react';

// Regiono pasirinkimai — tie patys kaip formos dropdown'e (kad būtų nuoseklu).
const REGION_OPTIONS = [
  { value: 'Europe', label: '🇪🇺 Visa Europa' },
  { value: 'Lithuania', label: '🇱🇹 Lietuva' },
  { value: 'Germany', label: '🇩🇪 Vokietija' },
];

// Pirmo apsilankymo "vartai": modalas su tamsiu overlay + langelis viduryje.
// Vartotojas pasirenka regioną + sutinka su sąlygomis → onConfirm(pasirinktas regionas).
export default function RegionGate({ onConfirm }) {
  const [selected, setSelected] = useState("");   // koks regionas pažymėtas
  const [agreed, setAgreed] = useState(false);    // ar pažymėtas "sutinku" checkbox
  const canEnter = selected && agreed;            // "Enter" aktyvus tik kai abu

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-panel border border-white/8 rounded-xl shadow-2xl p-8 max-w-md w-full">
        <div className="flex items-center gap-2.5 mb-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M8 5.3h8l4 6.9-4 6.9H8l-4-6.9 4-6.9z" stroke="#7fd1e6" strokeWidth="1.6" strokeLinejoin="round" />
            <circle cx="12" cy="12.2" r="3.1" stroke="#7fd1e6" strokeWidth="1.6" />
          </svg>
          <h1 className="text-2xl font-bold text-txt tracking-tight">Detalo</h1>
        </div>
        <p className="text-muted mb-6">Rask tinkamą auto detalę su DI</p>

        <p className="font-semibold text-txt mb-2">Pasirink savo regioną</p>
        <div className="flex flex-col gap-2 mb-5">
          {REGION_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSelected(opt.value)}
              className={`border rounded-lg px-4 py-2 text-left transition-colors ${
                selected === opt.value
                  ? 'border-frost bg-frost/10 text-txt'          // pažymėtas
                  : 'border-white/12 text-muted hover:bg-white/5'  // nepažymėtas
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Sutikimas — tas pats, kas footer'yje, bet čia patvirtinamas prieš įeinant. */}
        <label className="flex items-start gap-2.5 text-sm text-muted mb-6">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 accent-[#7fd1e6]"
          />
          <span>
            Suprantu, kad kainos orientacinės ir Detalo gali gauti komisinį per nuorodas šioje svetainėje.
          </span>
        </label>

        <button
          type="button"
          onClick={() => onConfirm(selected)}
          disabled={!canEnter}
          className="w-full bg-frost text-frostink font-semibold py-2.5 rounded-lg hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Įeiti
        </button>
      </div>
    </div>
  );
}
