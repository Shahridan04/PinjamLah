'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import type { SkillHelper } from '@/types/database';
import { ArrowLeft, Star, MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

const SKILL_CATEGORIES = ['Carpentry', 'Gardening', 'Home repair', 'Furniture assembly'];
const RESIDENT_ID = 'aina-rahman-001';

export default function SkillsPage() {
  const router = useRouter();
  const [helpers, setHelpers] = useState<SkillHelper[]>([]);
  const [activeSkill, setActiveSkill] = useState('');
  const [loading, setLoading] = useState(true);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState<string | null>(null);

  const fetchHelpers = useCallback(async () => {
    let query = supabase.from('skill_helpers').select('*');

    if (activeSkill) {
      query = query.contains('skills', [activeSkill]);
    }

    query = query.order('rating', { ascending: false });

    const { data } = await query;
    if (data) setHelpers(data as SkillHelper[]);
    setLoading(false);
  }, [activeSkill]);

  useEffect(() => { queueMicrotask(() => { void fetchHelpers(); }); }, [fetchHelpers]);

  async function handleRequestAssistance(helper: SkillHelper) {
    setRequestingId(helper.id);

    try {
      await supabase.from('assistance_requests').insert({
        id: `req-${Date.now()}`,
        resident_id: RESIDENT_ID,
        helper_id: helper.id,
        message: `Hi ${helper.full_name}, I need help with a project. Could you assist me?`,
        status: 'PENDING',
        created_at: new Date().toISOString(),
      });

      setRequestSent(helper.id);
      setTimeout(() => setRequestSent(null), 3000);
    } catch (err) {
      console.error('Request error:', err);
    } finally {
      setRequestingId(null);
    }
  }

  return (
    <div className="page-content">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <button onClick={() => router.back()} className="mb-3">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Need help using this?</h1>
        <p className="text-sm text-gray-400 mb-1">
          Useful things. Even more useful neighbours.
        </p>
      </div>

      {/* Suggestion banner */}
      <div className="px-5 mb-4">
        <div className="card bg-mint/30 border-forest/10">
          <p className="text-sm font-semibold text-gray-900 mb-0.5">
            Make your first drill project easy.
          </p>
          <p className="text-xs text-gray-400">
            Find a hand with your cordless drill project.
          </p>
        </div>
      </div>

      {/* Skill categories */}
      <div className="px-5 mb-4 flex gap-2 overflow-x-auto pb-1">
        {SKILL_CATEGORIES.map((skill) => (
          <button
            key={skill}
            onClick={() => { setLoading(true); setActiveSkill(activeSkill === skill ? '' : skill); }}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
              activeSkill === skill
                ? 'bg-forest text-white'
                : 'bg-white border border-card-border text-gray-600 hover:border-forest/30'
            }`}
          >
            {skill}
          </button>
        ))}
      </div>

      {/* Good people nearby */}
      <div className="px-5 mb-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-gray-900">Good people nearby</h2>
          <button className="text-xs text-forest font-medium">Map view</button>
        </div>
      </div>

      {/* Helper cards */}
      <div className="px-5 space-y-3 mb-6">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex gap-3">
                <div className="w-12 h-12 bg-gray-100 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                </div>
              </div>
            </div>
          ))
        ) : helpers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm">No helpers found for this skill.</p>
          </div>
        ) : (
          helpers.map((helper) => (
            <div key={helper.id} className="card">
              <div className="flex gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-forest/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {helper.avatar_url ? (
                     <Image unoptimized width={48} height={48} src={helper.avatar_url} alt={helper.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-forest font-bold">{helper.full_name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm text-gray-900">{helper.full_name}</h3>
                  <p className="text-xs text-gray-400">
                    {helper.skills.join(' · ')}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-0.5">
                      <Star size={12} className="text-amber-400 fill-amber-400" />
                      <span className="text-xs text-gray-500">{helper.rating}</span>
                    </div>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{helper.helps_count} helps</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{helper.distance_m} m</span>
                  </div>
                  <span className="inline-block mt-1 text-[10px] font-medium text-forest bg-mint px-2 py-0.5 rounded-full">
                    {helper.availability_badge}
                  </span>
                </div>
                <button className="self-start px-3 py-1.5 bg-mint text-forest rounded-xl text-xs font-semibold hover:bg-forest/10 transition-colors">
                  <MessageCircle size={14} className="inline mr-1" />
                  Chat
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Verified note */}
      <div className="px-5 mb-4">
        <div className="card bg-mint/20 border-forest/10">
          <p className="text-xs text-gray-500 flex items-center gap-2">
            <span className="text-forest">✓</span>
            Verified resident volunteers. Chat first to agree on a time and what you need.
          </p>
        </div>
      </div>

      {/* Request Assistance CTA */}
      {helpers.length > 0 && (
        <div className="px-5 mb-6">
          <button
            onClick={() => handleRequestAssistance(helpers[0])}
            disabled={requestingId !== null}
            className="btn-primary flex items-center justify-center gap-2"
          >
            {requestSent === helpers[0].id ? (
              <>✓ Request sent!</>
            ) : requestingId === helpers[0].id ? (
              <>Sending request...</>
            ) : (
              <>Request assistance from {helpers[0].full_name.split(' ')[0]} →</>
            )}
          </button>
        </div>
      )}

      {/* Become a helper */}
      <div className="px-5 pb-6">
        <p className="text-xs text-gray-400 text-center">
          Have a skill to share?{' '}
          <button className="text-forest font-medium">Become a helper →</button>
        </p>
      </div>
    </div>
  );
}
