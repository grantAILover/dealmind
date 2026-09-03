"use client";
import { useState, useEffect } from 'react';
import { track } from '@vercel/analytics';
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

    // Analytics: fiksuojam paiešką (be asmens duomenų — tik regionas + būklė).
    track('search', { region: region, condition: condition });

    try {
      // 1. START — grąžina GREITAI: arba iškart rezultatus (cache), arba jobId (reikia laukti).
      const response = await fetch('/api/search', {
        method: 'POST',
        body: JSON.stringify({ car: car, part: part, condition: condition, region: region })
      });
      // Dienos limitas išnaudotas (429) — rodom aiškią žinutę, ne bendrą klaidą.
      if (response.status === 429) {
        const limitData = await response.json();
        setError(limitData.message || "Dienos paieškų limitas išnaudotas. Bandyk vėl rytoj.");
        return; // finally išjungs loading
      }
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
      setError("Paieška užtruko per ilgai arba nepavyko. Bandyk dar kartą — naujų detalių paieška gali užtrukti minutę.");
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
    if (minutes < 1) return "ką tik";
    if (minutes < 60) return `prieš ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `prieš ${hours} val`;
  }

  return (
    <div className="min-h-screen">
      {/* Pirmo apsilankymo vartai — overlay virš svetainės, kol nepasirinktas regionas. */}
      {needsGate && <RegionGate onConfirm={handleRegionConfirm} />}

      <div className="max-w-5xl mx-auto px-6">
        {/* NAV — logo (hex veržlė) + wordmark */}
        <nav className="flex items-center h-16 border-b border-white/8">
          <div className="flex items-center gap-2.5 font-semibold tracking-tight text-txt">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M8 5.3h8l4 6.9-4 6.9H8l-4-6.9 4-6.9z" stroke="#7fd1e6" strokeWidth="1.6" strokeLinejoin="round" />
              <circle cx="12" cy="12.2" r="3.1" stroke="#7fd1e6" strokeWidth="1.6" />
            </svg>
            Detalo
          </div>
        </nav>

        {/* HERO — kairėn lygiuota, be gradiento/glow */}
        <section className="pt-16 pb-8 max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight leading-tight text-txt">
            Tiksliai tinkama detalė tavo automobiliui — surasta už tave.
          </h1>
          <p className="text-muted text-base mt-4 leading-relaxed">
            Nurodyk automobilį ir detalę. Detalo patikrina realias parduotuves ir grąžina
            tik tinkančius pasiūlymus — su kainomis, tinkamumu ir OEM numeriais.
          </p>
        </section>

        {/* PAIEŠKA — integruota panelė */}
        <form onSubmit={handleSubmit} className="bg-panel border border-white/8 rounded-xl p-3 flex flex-col gap-2 max-w-3xl">
          {/* Automobilio pasirinkimas su autocomplete — praneša pilną automobilį per setCar. */}
          <CarSelector onChange={setCar} />

          <div className="flex flex-wrap gap-2 items-center">
            <input
              className="border border-white/10 rounded-lg px-4 py-2 w-64 bg-panel2 text-txt placeholder-dim"
              type="text"
              value={part}
              onChange={(e) => setPart(e.target.value)}
              placeholder="Kokios detalės reikia? (pvz. priekinės stabdžių kaladėlės)"
            />
            <select
              className="border border-white/10 rounded-lg px-4 py-2 bg-panel2 text-txt"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
            >
              <option value="Any">Bet kokia būklė</option>
              <option value="OEM">OEM / Originali</option>
              <option value="Aftermarket">Neoriginali (aftermarket)</option>
              <option value="Used">Naudota</option>
            </select>
            {/* Regionas — onChange DAR įsimena į localStorage (kad išliktų perkrovus). */}
            <select
              className="border border-white/10 rounded-lg px-4 py-2 bg-panel2 text-txt"
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
            <button
              className="bg-frost text-frostink font-semibold px-6 py-2 rounded-lg hover:brightness-110 disabled:opacity-50"
              type="submit"
              disabled={loading}
            >
              Ieškoti
            </button>
          </div>
        </form>

        {loading && (
          <p className="text-frost mt-4 animate-pulse">
            🔧 Ieškome tavo detalės realiose parduotuvėse — gali užtrukti iki minutės...
          </p>
        )}
        {error && <p className="text-red-400 mt-4">{error}</p>}
        {checkedAt && <p className="text-dim text-sm mt-4">Tikrinta {timeAgo(checkedAt)}</p>}

        {/* Fitment įspėjimas — rodomas tik kai yra rezultatų */}
        {results.length > 0 && (
          <p className="text-muted text-sm mt-5 border-l-2 border-frost/60 pl-3">
            Prieš pirkdamas visada patikrink, ar detalė tinka tavo konkrečiam automobiliui (VIN / detalės numeris).
          </p>
        )}

        {/* LT skaidrumo žinutė: Amazon/eBay neturi .lt — tik kai regionas Lietuva IR yra tokia parduotuvė. */}
        {region === "Lithuania" &&
          results.some(r => {
            const s = (r.store || "").toLowerCase();
            return s.includes("amazon") || s.includes("ebay");
          }) && (
          <p className="text-dim text-sm mt-2">
            🇱🇹 Amazon ir eBay neturi lietuviškos svetainės — nuorodos veda į artimiausią ES parduotuvę, kuri veža į Lietuvą.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
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
          <div className="mt-12 pb-16">
            <h2 className="text-2xl font-bold text-txt mb-4">Mano sąrašas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
    </div>
  );
}
