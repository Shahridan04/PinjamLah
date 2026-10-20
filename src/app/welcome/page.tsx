'use client';

import { useRouter } from 'next/navigation';
import { Leaf, PiggyBank, Recycle, Users } from 'lucide-react';

export default function WelcomePage() {
  const router = useRouter();

  return (
    <div className="page-content bg-canvas flex flex-col">
      {/* Hero Section */}
      <div className="px-6 pt-12 pb-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 bg-forest rounded-xl flex items-center justify-center">
            <Leaf className="text-white" size={20} />
          </div>
          <span className="text-lg font-bold text-forest">PinjamLah</span>
        </div>

        {/* Neighbourhood illustration placeholder with gradient */}
        <div className="w-full h-48 rounded-2xl mb-8 overflow-hidden relative"
             style={{
               background: 'linear-gradient(135deg, #E8F3EE 0%, #c7ddd1 50%, #a8c9b9 100%)',
             }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="flex justify-center gap-3 mb-3">
                <div className="w-12 h-16 bg-forest/20 rounded-t-lg rounded-b-sm" />
                <div className="w-16 h-20 bg-forest/30 rounded-t-xl rounded-b-sm" />
                <div className="w-10 h-14 bg-forest/15 rounded-t-lg rounded-b-sm" />
                <div className="w-14 h-18 bg-forest/25 rounded-t-lg rounded-b-sm" />
              </div>
              <div className="flex justify-center gap-1">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="w-6 h-3 bg-forest/10 rounded-full" />
                ))}
              </div>
            </div>
          </div>

          {/* Pagination dots */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            <div className="w-6 h-2 bg-forest rounded-full" />
            <div className="w-2 h-2 bg-forest/30 rounded-full" />
            <div className="w-2 h-2 bg-forest/30 rounded-full" />
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-3xl font-extrabold text-gray-900 leading-tight mb-3">
          Big possibilities.<br />
          Smaller footprint.
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-8">
          Why buy it for one job? Borrow from your township&apos;s shared library, just around the corner.
        </p>

        {/* Value Pillars */}
        <div className="space-y-4 mb-10">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-mint rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <PiggyBank size={16} className="text-forest" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Save money</p>
              <p className="text-gray-400 text-xs">More room in your monthly budget.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-mint rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <Recycle size={16} className="text-forest" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Reduce waste</p>
              <p className="text-gray-400 text-xs">Fewer things bought. More things used.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-mint rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
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
          className="btn-primary flex items-center justify-center gap-2 mb-3"
        >
          Join your neighbourhood
          <span>→</span>
        </button>
        <button
          onClick={() => router.push('/home')}
          className="w-full py-3 text-center text-sm text-gray-500 font-medium hover:text-forest transition-colors"
        >
          I already have an account · Log in
        </button>
        <p className="text-center text-xs text-gray-400 mt-4">
          A township-owned service for Taman Kita residents.<br />
          Free to join. Better together.
        </p>
      </div>
    </div>
  );
}
