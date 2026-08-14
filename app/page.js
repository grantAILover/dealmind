"use client";
import { useState, useEffect } from 'react';
import ProductCard from '@/components/ProductCard';

export default function Home() {
  // Vietoj vieno "query" dabar TRYS laukai: automobilis, dalis, būklė.
  const [car, setCar] = useState("");
  const [part, setPart] = useState("");
  const [condition, setCondition] = useState("Any");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkedAt, setCheckedAt] = useState("");
  const [savedItems, setSavedItems] = useState([]);

  useEffect(() => {
    const stored = localStorage.getItem('watchlist');
    if (stored) {
      setSavedItems(JSON.parse(stored));
    }
  }, []);

  function isSaved(product) {
    return savedItems.some(p => p.name === product.name && p.store === product.store);
  }

  function toggleSave(product) {
    let updated;
    if (isSaved(product)) {
      updated = savedItems.filter(p => !(p.name === product.name && p.store === product.store));
    } else {
      updated = [...savedItems, product];
    }
    setSavedItems(updated);
    localStorage.setItem('watchlist', JSON.stringify(updated));
  }

  // Viena paieška — meta klaidą, jei nepavyko (kad retry ją pagautų).
  async function searchOnce() {
    const response = await fetch('/api/search', {
      method: 'POST',
      body: JSON.stringify({ car: car, part: part, condition: condition })
    });
    if (!response.ok) {
      throw new Error("Server error");
    }
    return await response.json();
  }

  async function handleSearch() {
    setLoading(true);
    setError("");
    setResults([]);
    setCheckedAt("");

    // Bandom iki 2 kartų — jei pirmа paieška timeout'ina (Vercel 60s), antra dažnai spėja.
    const attempts = 2;
    for (let i = 0; i < attempts; i++) {
      try {
        const data = await searchOnce();
        setResults(data.results);
        setCheckedAt(data.checkedAt);
        setLoading(false);
        return; // pavyko — baigiam
      } catch (err) {
        // Jei tai paskutinis bandymas — rodom klaidą. Kitaip tyliai bandom vėl.
        if (i === attempts - 1) {
          setError("Search took too long. Please try again — new parts can take a minute to find.");
        }
      }
    }
    setLoading(false);
  }

  function handleSubmit(e) {
    e.preventDefault();
    handleSearch();
  }

  function timeAgo(timestamp) {
    const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-blue-600">Bapkes</h1>
      <p className="text-gray-500 mb-6">Find the right car part with AI</p>

      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-center">
        <input
          className="border border-gray-300 rounded-lg px-4 py-2 w-72 bg-white text-gray-900"
          type="text"
          value={car}
          onChange={(e) => setCar(e.target.value)}
          placeholder="Your car (e.g. BMW E46 320i 2003)"
        />
        <input
          className="border border-gray-300 rounded-lg px-4 py-2 w-64 bg-white text-gray-900"
          type="text"
          value={part}
          onChange={(e) => setPart(e.target.value)}
          placeholder="Part needed (e.g. front brake pads)"
        />
        {/* select = išskleidžiamas sąrašas. value/onChange kaip input'e. */}
        <select
          className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-gray-900"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
        >
          <option value="Any">Any condition</option>
          <option value="OEM">OEM / Original</option>
          <option value="Aftermarket">Aftermarket</option>
          <option value="Used">Used</option>
        </select>
        <button className="bg-blue-600 text-white px-6 py-2 rounded-lg disabled:opacity-50" type="submit" disabled={loading}>
          Search
        </button>
      </form>

      {loading && (
        <p className="text-blue-600 mt-3 animate-pulse">
          🔧 Searching real stores for your part — this can take up to a minute...
        </p>
      )}
      {error && <p className="text-red-600 mt-3">{error}</p>}
      {checkedAt && <p className="text-gray-500 text-sm mt-3">Checked {timeAgo(checkedAt)}</p>}

      {/* Fitment įspėjimas — rodomas tik kai yra rezultatų */}
      {results.length > 0 && (
        <p className="text-amber-700 text-sm mt-4 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          ⚠ Always verify the part fits your exact car (VIN / part number) before buying.
        </p>
      )}

      <div className="grid grid-cols-3 gap-4 mt-6">
        {results.map(product => (
          <ProductCard
            key={product.name + product.store}
            name={product.name}
            price={product.price}
            dealScore={product.dealScore}
            store={product.store}
            url={product.url}
            image={product.image}
            condition={product.condition}
            fits={product.fits}
            isSaved={isSaved(product)}
            onToggleSave={() => toggleSave(product)}
          />
        ))}
      </div>

      {savedItems.length > 0 && (
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Your Watchlist</h2>
          <div className="grid grid-cols-3 gap-4">
            {savedItems.map(product => (
              <ProductCard
                key={product.name + product.store}
                name={product.name}
                price={product.price}
                dealScore={product.dealScore}
                store={product.store}
                url={product.url}
                image={product.image}
                isSaved={isSaved(product)}
                onToggleSave={() => toggleSave(product)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
