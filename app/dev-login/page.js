"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DevLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const r = await fetch('/api/dev-login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      if (r.ok) {
        router.push('/browse');
        router.refresh();
      } else {
        setError('Neteisingas slaptažodis.');
      }
    } catch {
      setError('Kažkas nepavyko.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={submit} className="bg-panel border border-white/8 rounded-xl p-8 max-w-sm w-full">
        <div className="flex items-center gap-2.5 mb-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M8 5.3h8l4 6.9-4 6.9H8l-4-6.9 4-6.9z" stroke="#7fd1e6" strokeWidth="1.6" strokeLinejoin="round" />
            <circle cx="12" cy="12.2" r="3.1" stroke="#7fd1e6" strokeWidth="1.6" />
          </svg>
          <span className="text-txt font-bold tracking-tight">Detalo</span>
        </div>
        <p className="text-dim text-sm mb-5">Vidinė peržiūra — tik kūrėjui</p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Slaptažodis"
          autoFocus
          className="w-full border border-white/10 rounded-lg px-4 py-2.5 bg-panel2 text-txt placeholder-dim"
        />
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-frost text-frostink font-semibold py-2.5 rounded-lg hover:brightness-110 disabled:opacity-50 mt-4"
        >
          {loading ? '...' : 'Įeiti'}
        </button>
      </form>
    </div>
  );
}
