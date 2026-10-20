'use client';

import { useEffect, useState, use, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Item, Loan } from '@/types/database';
import {
  ArrowLeft,
  Heart,
  Shield,
  Play,
  ChevronLeft,
  ChevronRight,
  Drill,
} from 'lucide-react';

const RESIDENT_ID = 'aina-rahman-001';

function generateToken() {
  // Simple token generator
  return `QR-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function ItemDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [myLoan, setMyLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    loadItem();
  }, [id]);

  async function loadItem() {
    const [{ data }, { data: loans }] = await Promise.all([supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .single(), supabase.from('loans').select('*').eq('item_id', id).eq('resident_id', RESIDENT_ID)
        .in('status', ['ACTIVE', 'RESERVED']).order('start_date', { ascending: false }).limit(1)]);
    if (data) setItem(data as Item);
    setMyLoan(loans?.[0] as Loan ?? null);
    setLoading(false);
  }

  function getDaysInMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  function getFirstDayOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  }

  function isDateSelected(day: number) {
    if (!startDate) return false;
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    if (endDate) {
      return d >= startDate && d <= endDate;
    }
    return d.getTime() === startDate.getTime();
  }

  function isStartOrEnd(day: number) {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return (
      (startDate && d.getTime() === startDate.getTime()) ||
      (endDate && d.getTime() === endDate.getTime())
    );
  }

  function handleDateClick(day: number) {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d < today) return;

    if (!startDate || (startDate && endDate)) {
      setStartDate(d);
      setEndDate(null);
    } else if (d > startDate) {
      setEndDate(d);
    } else {
      setStartDate(d);
      setEndDate(null);
    }
  }

  async function handleBorrow() {
    if (!item || !startDate || !endDate) return;
    setBooking(true);

    try {
      const qrToken = generateToken();
      const loanId = `loan-${Date.now()}`;

      // Insert loan record
      const { error: loanError } = await supabase.from('loans').insert({
        id: loanId,
        resident_id: RESIDENT_ID,
        item_id: item.id,
        locker_bay: item.locker_bay,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: 'RESERVED',
        qr_token: qrToken,
      });

      if (loanError) throw loanError;

      // Update item status
      const { error: itemError } = await supabase
        .from('items')
        .update({ status: 'Reserved' })
        .eq('id', item.id).eq('status', 'Available');
      if (itemError) throw itemError;

      // Navigate to scan page
      router.push(`/scan?mode=borrow&loan_id=${loanId}`);
    } catch (err) {
      console.error('Booking error:', err);
      setBooking(false);
      alert('Failed to create booking. Please try again.');
    }
  }

  if (loading) {
    return (
      <div className="page-content flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading item...</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="page-content flex items-center justify-center">
        <p className="text-gray-400">Item not found</p>
      </div>
    );
  }

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="page-content">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center">
          <ArrowLeft size={22} />
        </button>
        <span className="text-sm font-medium text-gray-500">{item.category}</span>
        <button className="w-10 h-10 flex items-center justify-center">
          <Heart size={22} className="text-gray-400" />
        </button>
      </div>

      {/* Image Gallery */}
      <div className="px-5 mb-4">
        <div className="w-full h-56 bg-gray-100 rounded-2xl flex items-center justify-center overflow-hidden">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <Drill size={64} className="text-gray-300" />
          )}
        </div>
        <div className="flex items-center justify-center gap-2 mt-2">
          <p className="text-[10px] text-gray-400">Complete kit · 3 photos</p>
        </div>
      </div>

      {/* Status Badges */}
      <div className="px-5 mb-3 flex gap-2">
        <span className={item.status === 'Available' ? 'pill-available' : item.status === 'Reserved' ? 'pill-reserved' : 'pill-in-use'}>{item.status}</span>
        <span className="bg-soft-blue text-gray-600 text-xs font-medium px-3 py-1 rounded-full">
          Township owned
        </span>
      </div>

      {/* Title */}
      <div className="px-5 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">{item.name}</h1>
        <p className="text-sm text-gray-400 mt-1">{item.subtitle}</p>
      </div>

      {/* Condition & Price Cards */}
      <div className="px-5 mb-5 grid grid-cols-2 gap-3">
        <div className="condition-card">
          <p className="text-3xl font-extrabold text-forest">{item.condition_score} / 10</p>
          <p className="text-xs text-gray-500 mt-1">Excellent condition</p>
        </div>
        <div className="price-card">
          <p className="text-3xl font-extrabold text-gray-900">RM {item.retail_price_rm}</p>
          <p className="text-xs text-gray-500 mt-1">Typical purchase cost</p>
        </div>
      </div>

      {/* Before You Start */}
      <div className="px-5 mb-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm text-gray-900">Before you start</h3>
          <button className="text-xs text-forest font-medium flex items-center gap-1">
            Full guide <ChevronRight size={12} />
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-2">
          {item.kit_contents || `Includes charger, accessories, and carrying case. Wear eye protection, secure your workpiece and start on a low torque setting.`}
        </p>
        <button className="flex items-center gap-2 text-xs text-forest font-medium">
          <Play size={14} className="text-forest" />
          Watch the 2-minute quick start
        </button>
      </div>

      {/* Calendar Date Picker */}
      <div className="px-5 mb-5">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() =>
                setCurrentMonth(
                  new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
                )
              }
            >
              <ChevronLeft size={18} className="text-gray-400" />
            </button>
            <h3 className="font-semibold text-sm">{monthName}</h3>
            <button
              onClick={() =>
                setCurrentMonth(
                  new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
                )
              }
            >
              <ChevronRight size={18} className="text-gray-400" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <div key={i} className="text-center text-xs text-gray-400 font-medium py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for offset */}
            {Array.from({ length: (firstDay + 6) % 7 }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
              const isPast = d < today;
              const selected = isDateSelected(day);
              const isEdge = isStartOrEnd(day);

              return (
                <button
                  key={day}
                  onClick={() => handleDateClick(day)}
                  disabled={isPast}
                  className={`w-full aspect-square rounded-xl flex items-center justify-center text-sm font-medium transition-all ${
                    isPast
                      ? 'text-gray-300 cursor-not-allowed'
                      : isEdge
                        ? 'bg-forest text-white'
                        : selected
                          ? 'bg-mint text-forest'
                          : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Selected dates info */}
          {startDate && endDate && (
            <div className="mt-3 pt-3 border-t border-card-border">
              <p className="text-xs text-gray-500 text-center">
                Selected {startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} –{' '}
                {endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ·{' '}
                {Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))}-day loan · No charge
              </p>
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="px-5 mb-8">
        {myLoan && (
          <button onClick={() => router.push(`/scan?mode=${myLoan.status === 'ACTIVE' ? 'return' : 'borrow'}&loan_id=${myLoan.id}`)} className="btn-primary mb-3">
            {myLoan.status === 'ACTIVE' ? 'Return item →' : 'View pickup pass →'}
          </button>
        )}
        <button
          onClick={handleBorrow}
          disabled={!startDate || !endDate || booking || item.status !== 'Available'}
          className="btn-primary flex items-center justify-center gap-2"
        >
          {booking ? (
            <span className="animate-pulse">Reserving...</span>
          ) : (
            <>Borrow this item · Free →</>
          )}
        </button>
        {startDate && endDate && (
          <p className="text-xs text-gray-400 text-center mt-2">
            Pickup {startDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}, 09:00 ·
            Return {endDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}, 18:00
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pb-6">
        <p className="text-[10px] text-gray-400 text-center">
          Every item is inspected, maintained and shared free with verified residents.
        </p>
      </div>
    </div>
  );
}

function ItemParamsWrapper({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ItemDetailContent id={id} />;
}

export default function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="page-content flex items-center justify-center min-h-[50vh]">
          <p className="text-gray-400 text-sm animate-pulse">Loading item...</p>
        </div>
      }
    >
      <ItemParamsWrapper params={params} />
    </Suspense>
  );
}

