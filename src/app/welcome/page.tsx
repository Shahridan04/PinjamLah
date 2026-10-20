'use client';

import { useRouter } from 'next/navigation';
import { Leaf, PiggyBank, Recycle, Users, ArrowRight, Drill, Sprout, MapPin } from 'lucide-react';

export default function WelcomePage() {
  const router = useRouter();

  return (
    <main className="page-content bg-canvas flex flex-col overflow-hidden">
      {/* Hero Section */}
      <div className="px-6 pt-9 pb-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-forest rounded-xl flex items-center justify-center shadow-lg shadow-forest/20">
            <Leaf className="text-white" size={20} />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-forest">PinjamLah<span className="text-mint-text">.</span></span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-forest bg-mint rounded-full px-3 py-2">Taman Kita</span>
        </div>

        {/* Illustrated shared shed, built from UI shapes rather than a stock image. */}
        <div className="relative h-56 rounded-[28px] mb-8 overflow-hidden bg-[#d9e9df] border border-forest/5 shadow-sm" aria-hidden="true">
          <div className="absolute -top-16 -right-14 w-52 h-52 rounded-full bg-white/35" />
          <div className="absolute top-4 left-5 flex items-center gap-1.5 text-forest/70 text-[10px] font-bold uppercase tracking-[0.18em]"><MapPin size={13} /> Your neighbourhood shed</div>
          <div className="absolute left-1/2 -translate-x-1/2 bottom-7 w-60 h-36 rounded-t-[28px] bg-[#0d3b2e] shadow-[0_18px_35px_rgba(13,59,46,0.22)]">
            <div className="absolute -top-4 left-3 right-3 h-8 rounded-t-[18px] bg-[#14533e] -skew-x-6" />
            <div className="absolute top-4 left-5 right-5 text-center text-white/85 text-[10px] font-bold tracking-[0.2em]">THE SHARED SHED</div>
            <div className="absolute bottom-4 left-5 right-5 flex gap-2">
              <div className="h-[70px] flex-1 rounded-lg bg-[#e8f3ee] flex flex-col items-center justify-center text-forest"><Drill size={29} strokeWidth={1.6} /><span className="text-[9px] font-bold mt-1">TOOLS</span></div>
              <div className="h-[70px] flex-1 rounded-lg bg-[#b5d3c1] flex flex-col items-center justify-center text-forest"><Sprout size={28} strokeWidth={1.6} /><span className="text-[9px] font-bold mt-1">GARDEN</span></div>
              <div className="h-[70px] flex-1 rounded-lg bg-[#e8f3ee] flex flex-col items-center justify-center text-forest"><Users size={27} strokeWidth={1.6} /><span className="text-[9px] font-bold mt-1">SHARE</span></div>
            </div>
          </div>
          <div className="absolute bottom-3 left-0 right-0 h-5 bg-[#9fc6ae]/60" />
          <div className="absolute right-4 bottom-7 w-8 h-12 rounded-t-full bg-[#54886a]" />
          <div className="absolute left-3 bottom-7 w-10 h-16 rounded-t-full bg-[#76a783]" />
        </div>

        {/* Headline */}
        <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-mint-text mb-3">Borrow more. Own less.</p>
        <h1 className="text-[32px] font-extrabold tracking-tight text-forest leading-[1.15] mb-3">
          Big possibilities.<br />
          <span className="text-[#38765a]">Smaller footprint.</span>
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-8">
          Why buy it for one job? Borrow from your township&apos;s shared library, just around the corner.
        </p>

        {/* Value Pillars */}
        <div className="space-y-3 mb-8">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-mint rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <PiggyBank size={16} className="text-forest" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Save money</p>
              <p className="text-gray-400 text-xs">More room in your monthly budget.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-mint rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <Recycle size={16} className="text-forest" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Reduce waste</p>
              <p className="text-gray-400 text-xs">Fewer things bought. More things used.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-mint rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <Users size={16} className="text-forest" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Share resources</p>
              <p className="text-gray-400 text-xs">A little help from your neighbourhood.</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTAs */}
      <div className="px-6 pb-8 mt-auto">
        <button
          onClick={() => router.push('/home')}
          className="btn-primary flex items-center justify-center gap-2 mb-3 shadow-lg shadow-forest/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          Join your neighbourhood
          <ArrowRight size={18} />
        </button>
        <button
          onClick={() => router.push('/home')}
          className="w-full py-3 text-center text-sm text-gray-600 font-medium hover:text-forest transition-colors focus-visible:outline-2 focus-visible:outline-forest rounded-xl"
        >
          Already a neighbour? <span className="font-bold text-forest underline underline-offset-4">Enter demo</span>
        </button>
        <p className="text-center text-xs text-gray-400 mt-4">
          A township-owned service for Taman Kita residents.<br />
          Demo access uses Aina&apos;s sample resident profile.
        </p>
      </div>
    </main>
  );
}
