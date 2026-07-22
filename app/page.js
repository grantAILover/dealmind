"use client";
import { useState } from 'react';
import ProductCard from '@/components/ProductCard';



export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: query })
      });
      if (!response.ok) {
      throw new Error("Server error");
    }
      const data = await response.json();
      setResults(data.results);
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setResults([]);
    }
    finally {
      setLoading(false);
      
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    handleSearch();
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-blue-600">Bapkes</h1>
      <p className="text-gray-500 mb-6">Find the best deals with AI</p>
        <form onSubmit={handleSubmit}>
          <input className="border border-gray-300 rounded-lg px-4 py-2 w-80 bg-white text-gray-900"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a product..."
          />
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg ml-2" type="submit">
            Search
          </button>
        </form>
        {loading && <p className="text-gray-500">Loading...</p>}
        {error && <p className="text-red-600">{error}</p>}
        <div className="grid grid-cols-3 gap-4 mt-8">
          {results.map(product => (
  <ProductCard key={product.id} name={product.name} price={product.price} dealScore={product.dealScore} />
))}
        </div>
        
      </div>
  );
}