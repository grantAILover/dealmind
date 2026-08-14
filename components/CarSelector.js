"use client";
import { useState, useEffect } from 'react';

// Metų sąrašas nuo 2026 iki 1990 (naujausi viršuje).
const YEARS = [];
for (let y = 2026; y >= 1990; y--) YEARS.push(y);

// Komponentas praneša tėvui pilną automobilį per onChange("Markė Modelis Metai").
export default function CarSelector({ onChange }) {
  const [makes, setMakes] = useState([]);      // visos markės (iš NHTSA)
  const [makeQuery, setMakeQuery] = useState(""); // ką vartotojas rašo markės lauke
  const [selectedMake, setSelectedMake] = useState("");
  const [year, setYear] = useState("");
  const [models, setModels] = useState([]);    // modeliai pasirinktai markei+metams
  const [selectedModel, setSelectedModel] = useState("");

  // 1. Kai komponentas atsiranda — užsikrauname visas markes (vieną kartą).
  useEffect(() => {
    fetch('https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/car?format=json')
      .then(r => r.json())
      .then(d => setMakes(d.Results.map(m => m.MakeName))) // pasiimam tik pavadinimus
      .catch(() => setMakes([]));
  }, []);

  // 2. Kai pasirinkta markė IR metai — užsikrauname modelius (kaskadinis fetch).
  //    Priklausomybių masyve [selectedMake, year] — effect pasileidžia, kai jie pasikeičia.
  useEffect(() => {
    if (!selectedMake || !year) {
      setModels([]);
      return;
    }
    fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(selectedMake)}/modelyear/${year}?format=json`)
      .then(r => r.json())
      .then(d => setModels(d.Results.map(m => m.Model_Name)))
      .catch(() => setModels([]));
    setSelectedModel(""); // nauja markė/metai — išvalom seną modelį
  }, [selectedMake, year]);

  // 3. Kai visi trys pasirinkti — pranešam tėvui pilną automobilį.
  useEffect(() => {
    if (selectedMake && year && selectedModel) {
      onChange(`${selectedMake} ${selectedModel} ${year}`);
    } else {
      onChange(""); // nepilna — tuščia
    }
  }, [selectedMake, year, selectedModel]);

  // Autocomplete pasiūlymai: markės, kuriose yra tai, ką vartotojas rašo (max 8).
  // Rodom tik kol dar nepasirinkta (makeQuery skiriasi nuo selectedMake).
  const suggestions =
    makeQuery && makeQuery !== selectedMake
      ? makes.filter(m => m.toLowerCase().includes(makeQuery.toLowerCase())).slice(0, 8)
      : [];

  return (
    <div className="flex flex-wrap gap-2 items-start">
      {/* MARKĖ su autocomplete */}
      <div className="relative">
        <input
          className="border border-gray-300 rounded-lg px-4 py-2 w-56 bg-white text-gray-900"
          type="text"
          value={makeQuery}
          onChange={(e) => { setMakeQuery(e.target.value); setSelectedMake(""); }}
          placeholder="Car make (e.g. Volkswagen)"
        />
        {suggestions.length > 0 && (
          <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg max-h-60 overflow-auto">
            {suggestions.map(m => (
              <li
                key={m}
                className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-gray-900"
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
        className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-gray-900 disabled:opacity-50"
        value={year}
        onChange={(e) => setYear(e.target.value)}
        disabled={!selectedMake}
      >
        <option value="">Year</option>
        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
      </select>

      {/* MODELIS */}
      <select
        className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-gray-900 disabled:opacity-50"
        value={selectedModel}
        onChange={(e) => setSelectedModel(e.target.value)}
        disabled={models.length === 0}
      >
        <option value="">{models.length === 0 ? "Model" : "Select model"}</option>
        {models.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  );
}
