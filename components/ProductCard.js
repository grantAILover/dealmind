"use client";

export default function ProductCard({ name, price, dealScore, store, url, image, isSaved, onToggleSave }) {
  let scoreColor;
  if (dealScore >= 80) {
    scoreColor = "bg-green-500 text-white";
  } else if (dealScore >= 60) {
    scoreColor = "bg-yellow-500 text-white";
  } else {
    scoreColor = "bg-red-500 text-white";
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md p-4 flex flex-col">
      {/* Nuotrauka viršuje. Sulūžusią (onError) paslepiam, kad kortelė liktų tvarkinga. */}
      {image && (
        <img
          src={image}
          alt={name}
          className="w-full h-40 object-contain mb-3"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}

      {/* Pavadinimas + deal score ženkliukas */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="font-bold text-sm text-gray-900 line-clamp-2">{name}</p>
        <span className={`text-xs font-bold px-2 py-1 rounded shrink-0 ${scoreColor}`}>
          {dealScore}
        </span>
      </div>

      {/* Juostelės: kaina ir parduotuvė */}
      <div className="space-y-1 mb-3">
        <div className="bg-gray-50 rounded px-3 py-2 text-blue-600 font-bold text-lg">€{price}</div>
        <div className="bg-gray-50 rounded px-3 py-2 text-sm text-gray-600">at {store}</div>
      </div>

      {/* Mygtukai apačioje: nuoroda į parduotuvę + Save. mt-auto pastumia juos į kortelės apačią. */}
      <div className="flex gap-2 mt-auto">
        <a
          href={url}
          target="_blank"
          rel="sponsored noopener noreferrer"
          className="flex-1 bg-blue-600 text-white text-center px-3 py-2 rounded-lg hover:bg-blue-700"
        >
          View deal
        </a>
        <button
          onClick={onToggleSave}
          className={`px-3 py-2 rounded-lg border ${isSaved ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-300'}`}
        >
          {isSaved ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}
