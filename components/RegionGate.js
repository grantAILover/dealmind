"use client";
import { useState } from 'react';

// Regiono pasirinkimai — tie patys kaip formos dropdown'e (kad būtų nuoseklu).
const REGION_OPTIONS = [
  { value: 'Europe', label: '🇪🇺 Visa Europa' },
  { value: 'Lithuania', label: '🇱🇹 Lietuva' },
  { value: 'Germany', label: '🇩🇪 Vokietija' },
];

// Pirmo apsilankymo "vartai": modalas su tamsiu permatomu fonu (overlay) + langelis viduryje.
// Vartotojas pasirenka regioną + sutinka su sąlygomis → onConfirm(pasirinktas regionas).
export default function RegionGate({ onConfirm }) {
  const [selected, setSelected] = useState("");   // koks regionas pažymėtas
  const [agreed, setAgreed] = useState(false);    // ar pažymėtas "sutinku" checkbox
  const canEnter = selected && agreed;            // "Įeiti" aktyvus tik kai abu

  return (
    // Overlay: fixed inset-0 = padengia visą ekraną; bg-black/50 = 50% permatomas juodas fonas.
    // flex + center = langelis viduryje. z-50 = virš visko.
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-slate-900 mb-1">Detalo</h1>
        <p className="text-gray-500 mb-6">Find the right car part with AI</p>

        <p className="font-semibold text-gray-800 mb-2">Choose your region</p>
        <div className="flex flex-col gap-2 mb-5">
          {REGION_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSelected(opt.value)}
              className={`border rounded-lg px-4 py-2 text-left ${
                selected === opt.value
                  ? 'border-teal-600 bg-teal-50 text-slate-900'      // pažymėtas
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'  // nepažymėtas
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Sutikimas — tas pats, kas footer'yje, bet čia vartotojas jį patvirtina prieš įeidamas. */}
        <label className="flex items-start gap-2 text-sm text-gray-600 mb-5">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1"
          />
          <span>
            I understand prices are indicative and Detalo may earn a commission from links on this site.
          </span>
        </label>

        <button
          type="button"
          onClick={() => onConfirm(selected)}
          disabled={!canEnter}
          className="w-full bg-teal-600 text-white py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Enter
        </button>
      </div>
    </div>
  );
}
