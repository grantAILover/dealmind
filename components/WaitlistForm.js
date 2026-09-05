"use client";
import { useState } from 'react';

export default function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | done | error

  async function submit(e) {
    e.preventDefault();
    setStatus('loading');
    try {
      const r = await fetch('/api/waitlist', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      if (!r.ok) throw new Error();
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div className="bg-frost/10 border border-frost/40 rounded-xl px-5 py-4 max-w-md">
        <p className="text-frost font-semibold">Ačiū! 🛵</p>
        <p className="text-muted text-sm mt-1">Pranešime tau el. paštu, kai Detalo startuos.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-md">
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tavo@paštas.lt"
          className="flex-1 border border-white/10 rounded-lg px-4 py-2.5 bg-panel2 text-txt placeholder-dim"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="bg-frost text-frostink font-semibold px-5 py-2.5 rounded-lg hover:brightness-110 disabled:opacity-50 whitespace-nowrap"
        >
          {status === 'loading' ? '...' : 'Pranešti man'}
        </button>
      </div>
      {status === 'error' && (
        <p className="text-red-400 text-sm mt-2">Nepavyko. Patikrink el. paštą ir bandyk dar kartą.</p>
      )}
      <p className="text-dim text-xs mt-2">Jokio spam'o — tik vienas laiškas, kai startuosim.</p>
    </form>
  );
}
