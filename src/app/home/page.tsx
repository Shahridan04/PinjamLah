'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Profile, Item, Loan } from '@/types/database';
import {
  Search,
  Drill,
  Flower2,
  SprayCan,
  Tent,
  Baby,
  ArrowUpRight,
  Leaf,
  ChevronRight,
} from 'lucide-react';

const CATEGORIES = [
  { name: 'Power Tools', icon: Drill, query: 'Power Tools' },
  { name: 'Gardening', icon: Flower2, query: 'Gardening' },
  { name: 'Cleaning', icon: SprayCan, query: 'Cleaning' },
  { name: 'Camping', icon: Tent, query: 'Camping' },
  { name: 'Baby Gear', icon: Baby, query: 'Baby Gear' },
];

// Default resident ID for demo
const RESIDENT_ID = 'aina-rahman-001';

export default function HomePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [popularItems, setPopularItems] = useState<Item[]>([]);
  const [outstandingLoans, setOutstandingLoans] = useState<(Loan & { item?: Item })[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(true);
  const [loanError, setLoanError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    // Fetch profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', RESIDENT_ID)
      .single();
    if (profileData) setProfile(profileData as Profile);

    // Fetch popular items
    const { data: items } = await supabase
      .from('items')
      .select('*')
      .order('total_loans', { ascending: false })
      .limit(4);
    if (items) setPopularItems(items as Item[]);

    // Keep every outstanding pickup and return visible, earliest due first.
    const { data: loans, error } = await supabase
      .from('loans')
      .select('*')
      .eq('resident_id', RESIDENT_ID)
      .in('status', ['ACTIVE', 'RESERVED'])
      .order('end_date', { ascending: true });
    setLoanError(Boolean(error));
    if (loans) {
      const ids = [...new Set(loans.map(loan => loan.item_id))];
      const { data: loanItems } = ids.length
        ? await supabase.from('items').select('*').in('id', ids)
        : { data: [] };
      setOutstandingLoans(loans.map(loan => ({
        ...loan,
        item: loanItems?.find(item => item.id === loan.item_id) as Item | undefined,
      })));
    }
    setLoadingLoans(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void loadData(); });
    const refresh = () => { if (!document.hidden) void loadData(); };
    const timer = window.setInterval(refresh, 5000);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [loadData]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  return (
    <main className="page-content">
      {/* Header */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-xs text-gray-400">Taman Kita, Selangor</p>
            <h1 className="text-2xl font-bold text-gray-900">
              Hello, {profile?.full_name?.split(' ')[0] || 'Rahman'}
            </h1>
          </div>
          <button
            onClick={() => router.push('/profile')}
            className="w-10 h-10 rounded-full bg-forest/10 flex items-center justify-center"
          >
            <span className="text-forest font-bold text-sm">
              {profile?.full_name?.charAt(0) || 'A'}
            </span>
          </button>
        </div>
      </div>

      <section className="resident-hero">
        <p className="eyebrow text-white/70">Your neighbourhood library of things</p>
        <h2>Less buying.<br /><span className="text-lime-200">More living.</span></h2>
        <p className="text-sm text-white/75 leading-relaxed">Big weekend plans. Small storage space. Borrow what you need, close to home.</p>
        <Link href="/explore">Find your next possibility <ArrowUpRight size={18} /></Link>
      </section>
      <div className="px-5 mb-3 flex items-center justify-between"><h2 className="font-bold">Your next move</h2><Link href="/profile" className="text-xs font-semibold text-forest">All your loans →</Link></div>
      {loadingLoans && <p role="status" className="px-5 mb-5 text-sm">Loading your pickups and returns…</p>}
      {loanError && <div role="status" className="mx-5 mb-5 card text-sm">Unable to refresh your loans. Previously loaded information may be outdated. <button className="underline font-semibold" onClick={() => void loadData()}>Retry</button></div>}
      {!loadingLoans && !loanError && outstandingLoans.length === 0 && <div className="mx-5 mb-5 card"><p className="text-sm font-semibold">Make room for possibilities.</p><p className="mt-1 text-xs text-gray-500">Your next pickup or return will appear here.</p></div>}
      {/* Current Loan Status Banner */}
      {outstandingLoans.map(recentLoan => (
        <div key={recentLoan.id} className="px-5 mb-6">
          <button
            onClick={() => {
              if (recentLoan.status === 'RETURNED') {
                router.push('/profile');
              } else if (recentLoan.status === 'ACTIVE') {
                router.push(`/scan?mode=return&loan_id=${recentLoan.id}`);
              } else {
                router.push(`/scan?mode=borrow&loan_id=${recentLoan.id}`);
              }
            }}
            className="card w-full flex items-center gap-3 hover:shadow-md transition-shadow"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              recentLoan.status === 'RETURNED' ? 'bg-status-available-bg' : 'bg-amber-50'
            }`}>
              {recentLoan.status === 'RETURNED' ? (
                <span className="text-lg">✓</span>
              ) : (
                <span className="text-lg">📦</span>
              )}
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-sm text-gray-900">
                 {recentLoan.status === 'RETURNED' ? 'Nice work. Back in the circle.' : recentLoan.status === 'ACTIVE' ? 'Return item →' : 'View pickup pass →'}
              </p>
              <p className="text-xs text-gray-400">
                {recentLoan.item?.name || recentLoan.item_id} ·{' '}
                {recentLoan.status === 'RETURNED' ? 'Returned' : recentLoan.status}
                {recentLoan.returned_at
                  ? ` ${new Date(recentLoan.returned_at).toLocaleDateString()}`
                  : ''}
              </p>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
        </div>
      ))}

      {/* Impact Hero Card */}
      <div className="px-5 mb-5">
        <div className="card-hero relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <p className="text-white/70 text-xs font-medium">Your sharing is adding up</p>
            <ArrowUpRight size={16} className="text-white/60" />
          </div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-4xl font-extrabold">RM {profile ? profile.total_saved_rm.toLocaleString() : '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-white/60 text-xs">estimated purchase savings</p>
            <div className="flex items-center gap-1 bg-white/10 rounded-full px-3 py-1">
              <Leaf size={12} className="text-green-300" />
              <span className="text-xs text-white/80">
                {profile?.total_co2_kg ?? '—'} kg estimated CO₂e avoided
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-5 mb-5">
        <form onSubmit={handleSearch} className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            aria-label="Search items"
            placeholder="What's your next project?"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-card-border rounded-xl py-3 pl-11 pr-4 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-forest/20 focus:border-forest/40 transition-all"
          />
        </form>
      </div>

      {/* Category Icons */}
      <div className="px-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Find your useful thing</h2>
        <div className="flex justify-between">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              onClick={() => router.push(`/explore?category=${encodeURIComponent(cat.query)}`)}
              className="flex flex-col items-center gap-1.5 group"
            >
              <div className="w-12 h-12 bg-mint rounded-2xl flex items-center justify-center group-hover:bg-forest/10 transition-colors">
                <cat.icon size={20} className="text-forest" />
              </div>
              <span className="text-[10px] text-gray-500 font-medium">{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Popular Around You */}
      <div className="px-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Popular around you</h2>
          <button
            onClick={() => router.push('/explore')}
            className="text-xs text-forest font-medium"
          >
            View all
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {popularItems.map((item) => (
            <button
              key={item.id}
              onClick={() => router.push(`/items/${item.id}`)}
              className="card text-left hover:shadow-md transition-shadow"
            >
              <div className="w-full h-28 bg-gray-100 rounded-xl mb-2 flex items-center justify-center overflow-hidden">
                {item.image_url ? (
                  <Image unoptimized width={200} height={112}
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Drill size={32} className="text-gray-300" />
                )}
              </div>
              <p className="font-semibold text-sm text-gray-900 truncate">{item.name}</p>
              <div className="flex items-center justify-between mt-1">
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
                {item.distance_m}m · {item.shed_name}
              </p>
            </button>
          ))}
        </div>
      </div>


      <p className="text-center text-[11px] text-gray-500 px-5 pb-4">Rahman’s demo account · A little less mine. A lot more ours.</p>
    </main>
  );
}
