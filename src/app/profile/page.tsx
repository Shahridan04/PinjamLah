'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import type { Profile, Loan, Item } from '@/types/database';
import { Settings, ChevronRight, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';

const RESIDENT_ID = 'aina-rahman-001';

const BADGES = [
  { name: 'Good neighbour', icon: '🤝', color: 'bg-amber-50' },
  { name: 'RM 1k saver', icon: '💰', color: 'bg-green-50' },
  { name: 'Lighter living', icon: '🌱', color: 'bg-emerald-50' },
];

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [borrowHistory, setBorrowHistory] = useState<(Loan & { item?: Item })[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    // Fetch profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', RESIDENT_ID)
      .single();
    if (profileData) setProfile(profileData as Profile);

    // Fetch borrow history with items
    const { data: loans } = await supabase
      .from('loans')
      .select('*')
      .eq('resident_id', RESIDENT_ID)
      .order('returned_at', { ascending: false, nullsFirst: false });

    if (loans) {
      const loansWithItems = await Promise.all(
        (loans as Loan[]).map(async (loan) => {
          const { data: itemData } = await supabase
            .from('items')
            .select('*')
            .eq('id', loan.item_id)
            .single();
          return { ...loan, item: (itemData ?? undefined) as Item | undefined };
        })
      );
      setBorrowHistory(loansWithItems);
    }

    setLoading(false);
  }, []);

  useEffect(() => { queueMicrotask(() => { void loadData(); }); }, [loadData]);

  const buysAvoided = Math.max(Math.floor((profile?.completed_borrows || 0) * 0.67), 8);
  const co2Progress = Math.min(((profile?.total_co2_kg || 186) / 200) * 100, 100);

  return (
    <div className="page-content">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">My neighbourhood life</h1>
        <button className="w-8 h-8 flex items-center justify-center">
          <Settings size={20} className="text-gray-400" />
        </button>
      </div>

      {/* Profile Card */}
      <div className="px-5 mb-5">
        <div className="card flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-forest/10 flex items-center justify-center flex-shrink-0">
            <span className="text-forest text-xl font-bold">
              {profile?.full_name?.charAt(0) || 'A'}
            </span>
          </div>
          <div>
            <h2 className="font-bold text-gray-900">{profile?.full_name || 'Aina Rahman'}</h2>
            <p className="text-xs text-gray-400">
              {profile?.township || 'Taman Kita'} · Member since May 2026
            </p>
            <div className="flex items-center gap-1 mt-1">
              <Shield size={12} className="text-forest" />
              <span className="text-xs text-forest font-medium">Verified resident</span>
            </div>
          </div>
        </div>
      </div>

      {/* Neighbourhood Pass */}
      <div className="px-5 mb-5">
        <div className="card bg-mint/30 border-forest/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Your neighbourhood pass is active</p>
              <p className="text-xs text-gray-400">
                Resident {profile?.resident_code || 'TK-029'} · Verified {profile?.verified_at ? new Date(profile.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '19 May 2026'}
              </p>
              <p className="text-xs text-gray-400">Address privately checked by township team.</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="px-5 mb-5 grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-2xl font-extrabold text-gray-900">
            {profile?.completed_borrows || 12}
          </p>
          <p className="text-xs text-gray-400">Borrows</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-extrabold text-gray-900">
            RM {(profile?.total_saved_rm || 1240).toLocaleString()}
          </p>
          <p className="text-xs text-gray-400">Saved</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-extrabold text-gray-900">{buysAvoided}</p>
          <p className="text-xs text-gray-400">Buys avoided</p>
        </div>
      </div>

      {/* Badges */}
      <div className="px-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm text-gray-900">A little recognition</h3>
          <button className="text-xs text-forest font-medium">All badges</button>
        </div>
        <div className="flex gap-3">
          {BADGES.map((badge) => (
            <div key={badge.name} className="flex-1 text-center">
              <div className={`w-14 h-14 mx-auto rounded-2xl ${badge.color} flex items-center justify-center mb-1.5`}>
                <span className="text-2xl">{badge.icon}</span>
              </div>
              <p className="text-[10px] text-gray-500 font-medium">{badge.name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CO2 Progress */}
      <div className="px-5 mb-5">
        <div className="card bg-mint/20 border-forest/10">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-forest">
              Next stop: 200 kg CO₂e avoided
            </p>
            <span className="text-xs font-bold text-forest">{Math.round(co2Progress)}%</span>
          </div>
          <div className="w-full h-2 bg-forest/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-forest rounded-full transition-all duration-500"
              style={{ width: `${co2Progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {profile?.total_co2_kg || 186} kg so far. Your next borrow could help.
          </p>
        </div>
      </div>

      {/* Borrow History */}
      <div className="px-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm text-gray-900">Borrow history</h3>
          <button className="text-xs text-forest font-medium">
            All {borrowHistory.length} →
          </button>
        </div>
        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="flex gap-3">
                  <div className="w-14 h-14 bg-gray-100 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-1/2" />
                    <div className="h-3 bg-gray-100 rounded w-3/4" />
                  </div>
                </div>
              </div>
            ))
          ) : borrowHistory.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-400 text-sm">No borrows yet. Start exploring!</p>
              <button
                onClick={() => router.push('/explore')}
                className="mt-2 text-forest text-sm font-medium"
              >
                Browse items →
              </button>
            </div>
          ) : (
            borrowHistory.slice(0, 5).map((loan) => (
              <button
                key={loan.id}
                onClick={() => {
                  if (loan.status === 'ACTIVE') {
                    router.push(`/scan?mode=return&loan_id=${loan.id}`);
                  }
                }}
                className="card w-full flex gap-3 text-left hover:shadow-md transition-shadow"
              >
                <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  {loan.item?.image_url ? (
                    <Image unoptimized width={56} height={56}
                      src={loan.item.image_url}
                      alt={loan.item.name}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <span className="text-2xl">🔧</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm text-gray-900 truncate">
                    {loan.item?.name || loan.item_id}
                  </h4>
                  <p className="text-xs text-gray-400">
                    {new Date(loan.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  <p className="text-xs text-gray-400">
                    {loan.status === 'RETURNED'
                      ? `Returned ${loan.returned_at ? new Date(loan.returned_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}`
                      : loan.status === 'ACTIVE'
                         ? '📦 Active borrow · Return item →'
                        : '🕐 Reserved'}
                    {loan.status === 'RETURNED' && ' · Returned on time'}
                  </p>
                </div>
                <ChevronRight size={16} className="text-gray-300 self-center" />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Settings Links */}
      <div className="px-5 mb-8">
        <button className="w-full flex items-center justify-between py-3 text-sm text-gray-500">
          <span>Privacy, Support & account</span>
          <ChevronRight size={16} className="text-gray-300" />
        </button>
      </div>

      {/* Disclaimer */}
      <div className="px-5 pb-6">
        <p className="text-[10px] text-gray-400 text-center">
          Illustrative resident identity and estimated 2026 impact.
        </p>
      </div>
    </div>
  );
}
