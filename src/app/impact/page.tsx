'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Profile, Loan, Item } from '@/types/database';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { ArrowUpRight, Leaf, TrendingUp } from 'lucide-react';

const RESIDENT_ID = 'aina-rahman-001';

function ImpactContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const view = searchParams.get('view') || 'personal';
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loans, setLoans] = useState<(Loan & { item?: Item })[]>([]);
  const [timeframe, setTimeframe] = useState<'month' | 'year' | 'all'>('year');
  const [communityItems, setCommunityItems] = useState<Item[]>([]);

  const loadData = useCallback(async () => {
    // Load profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', RESIDENT_ID)
      .single();
    if (profileData) setProfile(profileData as Profile);

    // Load completed loans
    const { data: loanData } = await supabase
      .from('loans')
      .select('*')
      .eq('resident_id', RESIDENT_ID)
      .eq('status', 'RETURNED')
      .order('returned_at', { ascending: false });

    if (loanData) {
      // Join with items
      const loansWithItems = await Promise.all(
        (loanData as Loan[]).map(async (loan) => {
          const { data: itemData } = await supabase
            .from('items')
            .select('*')
            .eq('id', loan.item_id)
            .single();
          return { ...loan, item: (itemData ?? undefined) as Item | undefined };
        })
      );
      setLoans(loansWithItems);
    }

    // Load community items for community view
    if (view === 'community') {
      const { data: items } = await supabase
        .from('items')
        .select('*')
        .order('total_loans', { ascending: false });
      if (items) setCommunityItems(items as Item[]);
    }
  }, [view]);

  useEffect(() => { queueMicrotask(() => { void loadData(); }); }, [loadData]);

  // Generate mock monthly savings data from loans
  const monthlyData = [
    { month: 'May', savings: 80 },
    { month: 'Jun', savings: 140 },
    { month: 'Jul', savings: 160 },
    { month: 'Aug', savings: 250 },
    { month: 'Sep', savings: 280 },
    { month: 'Oct', savings: 330 },
  ];

  // Most borrowed items
  const itemBorrowCounts = loans.reduce<Record<string, { name: string; count: number }>>((acc, loan) => {
    const name = loan.item?.name || loan.item_id;
    if (!acc[name]) acc[name] = { name, count: 0 };
    acc[name].count++;
    return acc;
  }, {});
  const mostBorrowed = Object.values(itemBorrowCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Community data
  const totalCommunityLoans = communityItems.reduce((sum, item) => sum + (item.total_loans || 0), 0);
  const communityFavourites = communityItems
    .filter((i) => i.total_loans > 0)
    .sort((a, b) => b.total_loans - a.total_loans)
    .slice(0, 3);

  if (view === 'community') {
    return (
      <div className="page-content">
        <div className="px-5 pt-6 pb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Our neighbourhood, in numbers.
          </h1>
          <p className="text-sm text-gray-400 mb-4">
            Taman Kita · Jul–{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>

          {/* Toggle */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => router.push('/impact')}
              className="px-4 py-2 rounded-full text-xs font-semibold bg-white border border-card-border text-gray-600"
            >
              Personal
            </button>
            <button
              className="px-4 py-2 rounded-full text-xs font-semibold bg-forest text-white"
            >
              Community
            </button>
          </div>
        </div>

        {/* Participation Ring */}
        <div className="px-5 mb-6">
          <div className="card flex items-center gap-4">
            <div className="w-24 h-24 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { value: 72, fill: '#14533E' },
                      { value: 28, fill: '#E6E8E5' },
                    ]}
                    dataKey="value"
                    innerRadius={28}
                    outerRadius={40}
                    startAngle={90}
                    endAngle={-270}
                    paddingAngle={0}
                  >
                    <Cell fill="#14533E" />
                    <Cell fill="#E6E8E5" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <p className="text-center -mt-14 text-xl font-extrabold text-forest">72%</p>
            </div>
            <div>
              <p className="font-semibold text-sm">More of us are sharing.</p>
              <p className="text-xs text-gray-400">
                144 of 200 households have borrowed at least once.
              </p>
              <p className="text-xs text-gray-400">
                {totalCommunityLoans || 432} completed loans together.
              </p>
            </div>
          </div>
        </div>

        {/* Demand Chart */}
        <div className="px-5 mb-6">
          <div className="card">
            <h3 className="font-semibold text-sm mb-1">Demand keeps growing</h3>
            <p className="text-xs text-gray-400 mb-3">Completed loans / month</p>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                  <Line
                    type="monotone"
                    dataKey="savings"
                    stroke="#14533E"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#14533E' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-gray-400 mt-1 text-right">+77% vs Jul</p>
          </div>
        </div>

        {/* Neighbourhood Favourites */}
        <div className="px-5 mb-6">
          <div className="card">
            <h3 className="font-semibold text-sm mb-3">The neighbourhood favourites</h3>
            <div className="space-y-3">
              {communityFavourites.map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <p className="text-sm text-gray-700">{item.name}</p>
                  <div className="flex items-center gap-2">
                    <div className="h-2 bg-forest/20 rounded-full" style={{ width: `${Math.min(item.total_loans * 3, 120)}px` }}>
                      <div
                        className="h-2 bg-forest rounded-full"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <span className="text-xs text-gray-400">{item.total_loans} loans</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Utilisation Stats */}
        <div className="px-5 mb-6 grid grid-cols-2 gap-3">
          <div className="card text-center">
            <p className="text-2xl font-extrabold text-forest">71%</p>
            <p className="text-xs text-gray-400">Locker utilisation</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-extrabold text-forest">97%</p>
            <p className="text-xs text-gray-400">On-time returns</p>
          </div>
        </div>

        {/* Data Recommendation */}
        <div className="px-5 mb-8">
          <div className="card bg-soft-blue border-blue-100">
            <p className="text-xs font-semibold text-blue-800 mb-1">
              🔍 What the data suggests
            </p>
            <p className="text-sm font-semibold text-gray-900">
              Add 2 pressure washers at Central Park.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {totalCommunityLoans} loans + 12 unfilled requests indicate demand. Prioritise weekend capacity.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============ PERSONAL VIEW ============
  return (
    <div className="page-content">
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Less stuff. More impact.</h1>
        <p className="text-sm text-gray-400 mb-4">
          Aina&apos;s sharing footprint · {new Date().getFullYear()} year to date
        </p>

        {/* Timeframe tabs */}
        <div className="flex gap-2 mb-6">
          {(['month', 'year', 'all'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
                timeframe === tf
                  ? 'bg-forest text-white'
                  : 'bg-white border border-card-border text-gray-600'
              }`}
            >
              {tf === 'month' ? 'This month' : tf === 'year' ? 'This year' : 'All time'}
            </button>
          ))}
        </div>
      </div>

      {/* Savings Hero */}
      <div className="px-5 mb-5">
        <div className="card-hero">
          <div className="flex items-center justify-between mb-1">
            <p className="text-white/60 text-xs">Money kept in your pocket</p>
            <ArrowUpRight size={16} className="text-white/40" />
          </div>
          <p className="text-4xl font-extrabold mb-1">
            RM {(profile?.total_saved_rm || 1240).toLocaleString()}
          </p>
          <p className="text-xs text-green-300">
            {(profile?.completed_borrows || 12) * 8 || 8} purchases avoided. Zero clutter added.
          </p>
        </div>
      </div>

      {/* CO2 & Borrows */}
      <div className="px-5 mb-5 grid grid-cols-2 gap-3">
        <div className="condition-card">
          <p className="text-2xl font-extrabold text-forest">
            {profile?.total_co2_kg || 186} kg
          </p>
          <p className="text-xs text-gray-500">CO₂e emissions avoided</p>
        </div>
        <div className="price-card">
          <p className="text-2xl font-extrabold text-gray-900">
            {profile?.completed_borrows || 12}
          </p>
          <p className="text-xs text-gray-500">Completed borrows</p>
        </div>
      </div>

      {/* Monthly Savings Chart */}
      <div className="px-5 mb-6">
        <div className="card">
          <h3 className="font-semibold text-sm mb-1">Savings, one borrow at a time</h3>
          <p className="text-xs text-gray-400 mb-3">Estimated savings · RM / month</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                <YAxis tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                <Tooltip />
                <Bar dataKey="savings" fill="#14533E" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Most borrowed */}
      <div className="px-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Your most borrowed</h3>
          <button className="text-xs text-forest font-medium">See all</button>
        </div>
        <div className="space-y-2">
          {(mostBorrowed.length > 0 ? mostBorrowed : [
            { name: 'Cordless drill', count: 4 },
            { name: 'Folding ladder', count: 3 },
            { name: '4-person tent', count: 2 },
          ]).map((item) => (
            <div key={item.name} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">🔧</span>
                <p className="text-sm text-gray-700">{item.name}</p>
              </div>
              <span className="text-xs text-gray-400">{item.count} borrows</span>
            </div>
          ))}
        </div>
      </div>

      {/* CO2 Badge */}
      <div className="px-5 mb-6">
        <div className="card bg-mint/30 border-forest/10">
          <div className="flex items-center gap-2">
            <Leaf size={16} className="text-forest" />
            <div>
              <p className="text-xs font-medium text-forest">
                You&apos;ve passed 150 kg CO₂e avoided.
              </p>
              <p className="text-xs text-gray-400">
                Your lighter-living badge is unlocked.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Community toggle */}
      <div className="px-5 mb-8">
        <button
          onClick={() => router.push('/impact?view=community')}
          className="w-full card text-center hover:shadow-md transition-shadow"
        >
          <TrendingUp size={20} className="text-forest mx-auto mb-1" />
          <p className="text-sm font-semibold text-gray-900">See community impact →</p>
        </button>
      </div>

      {/* Disclaimer */}
      <div className="px-5 pb-6">
        <p className="text-[10px] text-gray-400 text-center">
          Illustrative estimates, not measured savings. Avoided purchases are resident-reported. CO₂e uses category-level assumptions.
        </p>
      </div>
    </div>
  );
}

export default function ImpactPage() {
  return (
    <Suspense fallback={<div className="page-content px-5 pt-6"><p className="text-gray-400">Loading impact...</p></div>}>
      <ImpactContent />
    </Suspense>
  );
}
