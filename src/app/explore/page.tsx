'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Item } from '@/types/database';
import { Search, SlidersHorizontal, MapPin, Drill } from 'lucide-react';

const FILTERS = ['All items', 'Availability', 'Within 1 km'];

function ExploreContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Item[]>([]);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [activeFilter, setActiveFilter] = useState(searchParams.get('filter') || 'All items');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    let query = supabase.from('items').select('*');

    // Search filter
    if (searchQuery.trim()) {
      query = query.or(`name.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%,subtitle.ilike.%${searchQuery}%`);
    }

    // Category filter
    if (category) {
      query = query.ilike('category', `%${category}%`);
    }

    // Availability filter
    if (activeFilter === 'Availability') {
      query = query.eq('status', 'Available');
    }

    // Distance filter
    if (activeFilter === 'Within 1 km') {
      query = query.lte('distance_m', 1000);
    }

    query = query.order('total_loans', { ascending: false });

    const { data } = await query;
    if (data) setItems(data as Item[]);
    setLoading(false);
  }, [searchQuery, activeFilter, category]);

  useEffect(() => {
    queueMicrotask(() => { void fetchItems(); });
  }, [fetchItems]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    void fetchItems();
  }

  return (
    <div className="page-content">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">What do you need?</h1>
        <p className="text-sm text-gray-400 mb-4">Useful things, right where you live.</p>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="relative mb-4">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search tools, gear and more"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-card-border rounded-xl py-3 pl-11 pr-12 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-forest/20 focus:border-forest/40"
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center"
          >
            <SlidersHorizontal size={16} className="text-gray-400" />
          </button>
        </form>

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => {
                setLoading(true);
                setActiveFilter(f);
                setCategory('');
              }}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
                activeFilter === f
                  ? 'bg-forest text-white'
                  : 'bg-white border border-card-border text-gray-600 hover:border-forest/30'
              }`}
            >
              {f}
              {f !== 'All items' && ' ↓'}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="px-5 mb-3 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {items.length} item{items.length !== 1 ? 's' : ''} nearby
        </p>
        <p className="text-xs text-gray-400">Nearest first ↓</p>
      </div>

      {/* Item List */}
      <div className="px-5 space-y-3 mb-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="flex gap-3">
                  <div className="w-20 h-20 bg-gray-100 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                    <div className="h-3 bg-gray-100 rounded w-1/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <Search size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No items found. Try adjusting your search.</p>
          </div>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              onClick={() => router.push(`/items/${item.id}`)}
              className="card w-full flex gap-3 text-left hover:shadow-md transition-shadow"
            >
              <div className="w-20 h-20 bg-gray-50 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden">
                {item.image_url ? (
                  <Image unoptimized width={80} height={80}
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Drill size={28} className="text-gray-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-gray-900 truncate">{item.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Condition {item.condition_score}/10 · {item.distance_m} m
                </p>
                <div className="mt-2">
                  <span
                    className={
                      item.status === 'Available'
                        ? 'pill-available'
                        : item.status === 'Reserved'
                          ? 'pill-reserved'
                          : 'pill-in-use'
                    }
                  >
                    {item.status}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  {item.shed_name} · Free to borrow
                </p>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Shed Locations Footer */}
      <div className="px-5 mb-6">
        <div className="card bg-mint/50 border-forest/10">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-forest" />
            <p className="text-xs text-forest font-medium">
              2 sharing sheds near your home: Central Park · Garden Walk
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="page-content px-5 pt-6"><p className="text-gray-400">Loading...</p></div>}>
      <ExploreContent />
    </Suspense>
  );
}
