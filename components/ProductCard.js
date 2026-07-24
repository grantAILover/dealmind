"use client";
import { useState } from 'react';

export default function ProductCard({ name, price, dealScore, store, url }) {
  const [saved, setSave] = useState(false);

  let text;
  if (saved === true) {
    text = "SAVED";
  } else {
    text = "SAVE";
  }

  let scoreColor;
  if (dealScore >= 80) {
    scoreColor = "bg-green-500 text-white";
  } else if (dealScore >= 60) {
    scoreColor = "bg-yellow-500 text-white";
  } else {
    scoreColor = "bg-red-500 text-white";
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md p-4">
      <a href={url} target="_blank" rel="sponsored noopener noreferrer">
      <p className="font-bold text-lg text-blue-700 hover:underline">{name}</p>
        </a>
      <p className="text-blue-600 text-xl">€{price}</p>
      <p className="text-gray-500 text-sm">at {store}</p>
      <span className={`text-sm font-bold px-2 py-1 rounded ${scoreColor}`}>
        Deal Score: {dealScore}
      </span>
      <button className="bg-blue-600 text-white px-4 py-2 rounded-lg mt-2" onClick={() => setSave(!saved)}>
        {text}
      </button>
    </div>
  );
}