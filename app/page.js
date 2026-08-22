"use client";
import { useState, useEffect } from 'react';
import ProductCard from '@/components/ProductCard';
import CarSelector from '@/components/CarSelector';
import RegionGate from '@/components/RegionGate';

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
  const [region, setRegion] = useState("Europe");
  const [needsGate, setNeedsGate] = useState(false); // ar rodyti pirmo apsilankymo vartus

  useEffect(() => {
    const stored = localStorage.getItem('watchlist');
    if (stored) {
      setSavedItems(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    const storedRegion = localStorage.getItem('region'); // paskaito įrašą "region"
    if (storedRegion) {
      setRegion(storedRegion);   // jau rinkosi anksčiau — vartų nerodom
    } else {
      setNeedsGate(true);        // pirmas apsilankymas — rodom vartus
    }
  }, []);

  // Vartotojas vartuose pasirinko regioną + sutiko → įsimenam ir uždarom vartus.
  function handleRegionConfirm(chosen) {
    setRegion(chosen);
    localStorage.setItem('region', chosen);
    setNeedsGate(false);
  }

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

  // Mažas pagalbininkas — palaukti nurodytą ms (naudojam tarp polling'o klausimų).
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // POLLING: kas 3s klausiam serverio "ar jobId jau paruošta?", kol done/error/timeout.
  async function pollJob(jobId) {
    const maxTries = 30; // 30 × 3s = iki 90s laukiam
    for (let i = 0; i < maxTries; i++) {
      await sleep(3000);
      const response = await fetch(`/api/search?jobId=${jobId}`); // GET = status
      const data = await response.json();
      if (data.status === "done") {
        setResults(data.results);
        setCheckedAt(data.checkedAt);
        return; // radom — baigiam
      }
      if (data.status === "error") {
        throw new Error("Search failed");
      }
      // "pending" → nieko nedarom, klausiam vėl po 3s
    }
    throw new Error("Timed out"); // per ilgai — meta klaidą (pagauna handleSearch)
  }

  async function handleSearch() {
    setLoading(true);
    setError("");
    setResults([]);
    setCheckedAt("");

    try {
      // 1. START — grąžina GREITAI: arba iškart rezultatus (cache), arba jobId (reikia laukti).
      const response = await fetch('/api/search', {
        method: 'POST',
        body: JSON.stringify({ car: car, part: part, condition: condition, region: region })
      });
      if (!response.ok) {
        throw new Error("Server error");
      }
      const data = await response.json();

      if (data.status === "done") {
        // Cache hit — rezultatai jau čia, laukti nereikia.
        setResults(data.results);
        setCheckedAt(data.checkedAt);
      } else if (data.status === "pending") {
        // Nauja paieška — pradedam klausinėti, kol fono darbas baigs.
        await pollJob(data.jobId);
      } else {
        throw new Error("Unexpected response");
      }
    } catch (err) {
      setError("Search took too long or failed. Please try again — new parts can take a minute to find.");
    } finally {
      setLoading(false); // ir sėkmės, ir klaidos atveju — išjungiam loading
    }
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
      {/* Pirmo apsilankymo vartai — overlay virš svetainės, kol nepasirinktas regionas. */}
      {needsGate && <RegionGate onConfirm={handleRegionConfirm} />}

      <h1 className="text-4xl font-bold text-slate-900">Detalo</h1>
      <p className="text-gray-500 mb-6">Find the right car part with AI</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Automobilio pasirinkimas su autocomplete — praneša pilną automobilį per setCar. */}
        <CarSelector onChange={setCar} />

        <div className="flex flex-wrap gap-2 items-center">
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
        {/* Regionas — kaip condition, bet onChange DAR įsimena į localStorage (kad išliktų perkrovus). */}
        <select
          className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-gray-900"
          value={region}
          onChange={(e) => {
            setRegion(e.target.value);
            localStorage.setItem('region', e.target.value);
          }}
        >
          <option value="Europe">🇪🇺 Visa Europa</option>
          <option value="Lithuania">🇱🇹 Lietuva</option>
          <option value="Germany">🇩🇪 Vokietija</option>
        </select>
        <button className="bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50" type="submit" disabled={loading}>
          Search
        </button>
        </div>
      </form>

      {loading && (
        <p className="text-teal-700 mt-3 animate-pulse">
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

      {/* LT skaidrumo žinutė: Amazon/eBay neturi .lt — rodom tik kai regionas Lietuva
          IR tarp rezultatų realiai yra tokia parduotuvė (kitaip žinutė būtų nereikalinga). */}
      {region === "Lithuania" &&
        results.some(r => {
          const s = (r.store || "").toLowerCase();
          return s.includes("amazon") || s.includes("ebay");
        }) && (
        <p className="text-gray-500 text-sm mt-2">
          🇱🇹 Amazon ir eBay neturi lietuviškos svetainės — nuorodos veda į artimiausią ES parduotuvę, kuri veža į Lietuvą.
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
            partNumber={product.partNumber}
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
