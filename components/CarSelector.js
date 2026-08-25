"use client";
import { useState, useEffect } from 'react';

// Metų sąrašas nuo 2026 iki 1990 (naujausi viršuje).
const YEARS = [];
for (let y = 2026; y >= 1990; y--) YEARS.push(y);

// Komponentas praneša tėvui pilną automobilį per onChange("Markė Modelis+variklis Metai").
export default function CarSelector({ onChange }) {
  const [makes, setMakes] = useState([]);       // visos markės (iš NHTSA)
  const [makeQuery, setMakeQuery] = useState(""); // ką vartotojas rašo markės lauke
  const [selectedMake, setSelectedMake] = useState("");
  const [year, setYear] = useState("");
  const [model, setModel] = useState("");        // modelis + variklis (laisvas tekstas)

  // Markes užsikrauname vieną kartą, kai komponentas atsiranda.
  useEffect(() => {
    fetch('https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/car?format=json')
      .then(r => r.json())
      .then(d => setMakes(d.Results.map(m => m.MakeName)))
      .catch(() => setMakes([]));
  }, []);

  // Kai visi trys pasirinkti — pranešam tėvui pilną automobilį.
  useEffect(() => {
    if (selectedMake && year && model) {
      onChange(`${selectedMake} ${model} ${year}`);
    } else {
      onChange("");
    }
  }, [selectedMake, year, model]);

  // Autocomplete pasiūlymai: markės, kuriose yra tai, ką vartotojas rašo (max 8).
  const suggestions =
    makeQuery && makeQuery !== selectedMake
      ? makes.filter(m => m.toLowerCase().includes(makeQuery.toLowerCase())).slice(0, 8)
      : [];

  return (
    <div className="flex flex-wrap gap-2 items-start">
      {/* MARKĖ su autocomplete */}
      <div className="relative">
        <input
          className="border border-white/10 rounded-lg px-4 py-2 w-52 bg-panel2 text-txt placeholder-dim"
          type="text"
          value={makeQuery}
          onChange={(e) => { setMakeQuery(e.target.value); setSelectedMake(""); }}
          placeholder="Car make (e.g. Volkswagen)"
        />
        {suggestions.length > 0 && (
          <ul className="absolute z-10 w-full bg-panel2 border border-white/10 rounded-lg mt-1 shadow-lg max-h-60 overflow-auto">
            {suggestions.map(m => (
              <li
                key={m}
                className="px-4 py-2 hover:bg-white/5 cursor-pointer text-txt"
                onClick={() => { setSelectedMake(m); setMakeQuery(m); }}
              >
                {m}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* METAI */}
      <select
        className="border border-white/10 rounded-lg px-4 py-2 bg-panel2 text-txt disabled:opacity-50"
        value={year}
        onChange={(e) => setYear(e.target.value)}
        disabled={!selectedMake}
      >
        <option value="">Year</option>
        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
      </select>

      {/* MODELIS + VARIKLIS (laisvas tekstas — tikslumui, ko NHTSA neturi) */}
      <input
        className="border border-white/10 rounded-lg px-4 py-2 w-64 bg-panel2 text-txt placeholder-dim disabled:opacity-50"
        type="text"
        value={model}
        onChange={(e) => setModel(e.target.value)}
        placeholder="Model + engine (e.g. Golf 6 1.6 TDI 77kW)"
        disabled={!selectedMake || !year}
      />
    </div>
  );
}
