'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Loan, Item, Locker } from '@/types/database';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  MoreHorizontal,
  CheckCircle2,
  Circle,
  Camera,
  Loader2,
  Lock,
  Unlock,
} from 'lucide-react';

const RESIDENT_ID = 'aina-rahman-001';

function ScanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') || 'borrow';
  const loanIdParam = searchParams.get('loan_id');

  const [loan, setLoan] = useState<Loan | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [returnStep, setStep] = useState(1);
  const assignedBay = lockers.find(bay => bay.bay_code === loan?.locker_bay);
  const step = mode === 'borrow'
    ? loan?.status === 'ACTIVE'
      ? assignedBay ? assignedBay.is_unlocked ? 4 : 5 : 3
      : loan?.status === 'RETURNED' ? 5 : loan ? 2 : 1
    : returnStep;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Return specific state
  const [workingWell, setWorkingWell] = useState(true);
  const [allParts, setAllParts] = useState(true);
  const [returnPhoto, setReturnPhoto] = useState<File | null>(null);
  const [returnPhotoPreview, setReturnPhotoPreview] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [returnComplete, setReturnComplete] = useState(false);
  const [returnBayOpened, setReturnBayOpened] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load loan data when the requested pass changes.
  useEffect(() => {
    async function loadData() {
    if (!loanIdParam) {
      // Find most recent active loan
      const { data: loans } = await supabase
        .from('loans')
        .select('*')
        .eq('resident_id', RESIDENT_ID)
        .in('status', mode === 'borrow' ? ['RESERVED'] : ['ACTIVE'])
        .order('start_date', { ascending: false })
        .limit(1);

      if (loans && loans.length > 0) {
        const l = loans[0] as Loan;
        setLoan(l);
        await loadItem(l.item_id);
        // Set step based on status
        if (l.status === 'RESERVED') setStep(2);
        if (l.status === 'ACTIVE') setStep(1);
      }
    } else {
      const { data: loanData } = await supabase
        .from('loans')
        .select('*')
        .eq('id', loanIdParam)
        .single();

      if (loanData) {
        const l = loanData as Loan;
        setLoan(l);
        await loadItem(l.item_id);
        if (l.status === 'RESERVED') setStep(2);
        if (l.status === 'ACTIVE' && mode === 'borrow') setStep(5);
        if (l.status === 'ACTIVE' && mode === 'return') setStep(1);
        if (l.status === 'RETURNED') {
          setStep(5);
          setReturnComplete(true);
        }
      }
    }

    // Load lockers
    const { data: lockerData } = await supabase.from('lockers').select('*').order('bay_code');
    if (lockerData) setLockers(lockerData as Locker[]);
    setLoading(false);
    }
    async function loadItem(itemId: string) {
      const { data } = await supabase.from('items').select('*').eq('id', itemId).single();
      if (data) setItem(data as Item);
    }
    void loadData();
  }, [loanIdParam, mode]);

  // Subscribe to real-time locker updates
  useEffect(() => {
    const channel = supabase
      .channel('lockers-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'lockers' },
        (payload) => {
          setLockers((prev) =>
            prev.map((l) =>
              l.bay_code === (payload.new as Locker).bay_code
                ? (payload.new as Locker)
                : l
            )
          );
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'loans' }, (payload) => {
        const updated = payload.new as Loan;
        if (updated.id !== loan?.id) return;
        setLoan(updated);
        if (updated.status === 'ACTIVE' && mode === 'borrow') setStep(5);
        if (updated.status === 'RETURNED' && mode === 'return') {
          setStep(5);
          setReturnComplete(true);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loan?.id, mode]);

  // Reconcile missed realtime events (including when the phone resumes after sleeping).
  useEffect(() => {
    if (!loan?.id || (mode === 'return' && returnComplete)) return;
    let cancelled = false;
    const refresh = async () => {
      const [loanResult, bayResult] = await Promise.all([
        supabase.from('loans').select('*').eq('id', loan.id).single(),
        supabase.from('lockers').select('*').eq('bay_code', loan.locker_bay).single(),
      ]);
      if (cancelled) return;
      if (loanResult.error || bayResult.error) {
        setError('Unable to check the bay. Check your connection and try again.');
        return;
      }
      const latest = loanResult.data as Loan;
      setLoan(latest);
      setLockers(previous => previous.map(bay => bay.bay_code === loan.locker_bay ? bayResult.data as Locker : bay));
      if (mode === 'borrow') return;
      if (latest.status === 'RETURNED') {
        setReturnComplete(true);
        setStep(5);
      } else if (latest.status === 'ACTIVE') {
        setReturnBayOpened(Boolean(bayResult.data.is_unlocked));
      }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 3000);
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [loan?.id, loan?.locker_bay, mode, returnComplete]);

  // The resident only presents a pass; only the kiosk may trigger locker actions.

  // Handle photo capture/upload
  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setReturnPhoto(file);
      const reader = new FileReader();
      reader.onload = () => setReturnPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  // Demo photo is previewed locally; only the self-report is sent.
  async function handleVerifyReturn() {
    if (!loan || !item || !returnPhoto || !returnBayOpened) return;
    setError('');
    setVerifying(true);

    try {
      const response = await fetch('/api/verify-return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loan_id: loan.id, item_id: item.id, working_well: workingWell, all_parts_included: allParts }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setStep(5);
        setReturnComplete(true);
        // Refresh loan data
        const { data: updatedLoan } = await supabase
          .from('loans')
          .select('*')
          .eq('id', loan.id)
          .single();
        if (updatedLoan) setLoan(updatedLoan as Loan);
      } else {
        setError(result.error || 'Return could not be completed. Please retry.');
      }
    } catch (err) {
      console.error('Verification error:', err);
      setError('Return could not be completed. Check your connection and try again.');
    } finally {
      setVerifying(false);
    }
  }

  if (loading) {
    return (
      <div className="page-content flex items-center justify-center">
        <Loader2 className="animate-spin text-forest" size={32} />
      </div>
    );
  }

  // ============ BORROW MODE ============
  if (mode === 'borrow') {
    const borrowSteps = [
      { label: 'Reserve your item', done: step > 1 },
      { label: 'Your pickup QR is ready', done: step > 2, active: step === 2 },
      { label: 'Scan at the PinjamLah shed', done: step > 3, active: step === 3 },
      { label: 'Your locker opens', done: step > 4, active: step === 4 },
      { label: 'Borrow confirmed', done: step >= 5, active: step === 5 },
    ];

    return (
      <div className="page-content">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <button onClick={() => router.back()}>
            <ArrowLeft size={22} />
          </button>
          <button>
            <MoreHorizontal size={22} className="text-gray-400" />
          </button>
        </div>

        <div className="px-5 pt-2">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Your project starts here.</h1>
          <p className="text-sm text-gray-400 mb-6">
            Pickup journey · {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </p>

          {/* Step tracker */}
          <div className="space-y-4 mb-8">
            {borrowSteps.map((s, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  {s.done ? (
                    <CheckCircle2 size={24} className="text-forest" />
                  ) : s.active ? (
                    <div className="step-dot step-dot-active">{i + 1}</div>
                  ) : (
                    <Circle size={24} className="text-gray-200" />
                  )}
                  {i < borrowSteps.length - 1 && (
                    <div className={`w-0.5 h-6 mt-1 ${s.done ? 'bg-forest/30' : 'bg-gray-100'}`} />
                  )}
                </div>
                <div className="pt-0.5">
                  <p className={`text-sm font-medium ${s.done || s.active ? 'text-gray-900' : 'text-gray-400'}`}>
                    {s.label}
                  </p>

                  {/* Step 1 - Item details */}
                  {i === 0 && step >= 1 && loan && item && (
                    <div className="mt-2 card bg-mint/30 border-forest/10">
                      <div className="flex gap-3">
                        <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden">
                          {item.image_url ? (
                            <Image unoptimized width={56} height={56} src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-2xl">🔧</span>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{item.name} · {item.id}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(loan.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} → {new Date(loan.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </p>
                          <p className="text-xs text-gray-400">{RESIDENT_ID} · {item.shed_name}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2 - QR Code */}
                  {i === 1 && step === 2 && loan && (
                    <div className="mt-3 flex flex-col items-center">
                      <p className="text-xs text-gray-500 mb-3">
                        Generated for {item?.name} · {RESIDENT_ID}
                      </p>
                      <div className="bg-white p-4 rounded-2xl border border-card-border shadow-sm">
                        <QRCodeSVG
                          value={JSON.stringify({
                            loan_id: loan.id,
                            item_id: loan.item_id,
                            locker_bay: loan.locker_bay,
                            action: 'PICKUP',
                            qr_token: loan.qr_token,
                          })}
                          size={180}
                          level="H"
                          includeMargin
                        />
                      </div>
                      <button className="mt-3 bg-mint text-forest px-4 py-2 rounded-xl text-xs font-semibold">
                        Pickup pass
                      </button>

                      {/* Locker info */}
                      <div className="mt-4 text-center">
                        <p className="font-semibold text-sm mb-1">Locker {loan.locker_bay}</p>
                        <p className="text-xs text-gray-400">
                           {item?.shed_name} · {item?.distance_m}m from home
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">
                           Present this pass to the shed kiosk. Do not share it.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Step 3 - Scan instruction */}
                  {i === 2 && step >= 2 && step <= 3 && (
                    <p className="text-xs text-gray-400 mt-1">
                       Present your pickup QR to the shed kiosk scanner.
                    </p>
                  )}

                  {/* Step 4 - Locker visual */}
                  {i === 3 && step >= 3 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-400 mb-2">
                        {assignedBay?.is_unlocked
                          ? `Bay ${loan?.locker_bay} is open. Collect ${item?.name ?? 'your item'}, check all accessories, then close the bay.`
                          : `Bay ${loan?.locker_bay} is closed.`}
                      </p>
                      <div className="flex gap-2 mt-2">
                        {lockers.filter(l => l.bay_code === loan?.locker_bay).map((l) => (
                          <div
                            key={l.bay_code}
                            className={`locker-bay ${
                              l.is_unlocked ? 'locker-unlocked' : 'locker-locked'
                            }`}
                          >
                            {l.is_unlocked ? (
                              <Unlock size={16} />
                            ) : (
                              <Lock size={16} />
                            )}
                            <span className="ml-1 text-xs">{l.bay_code} · {l.is_unlocked ? 'Open' : 'Closed'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 5 - Confirmed */}
                  {i === 4 && step === 5 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500">
                        Bay {loan?.locker_bay} is closed. Pickup recorded{loan?.collected_at ? ` ${new Date(loan.collected_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}. You&apos;re all set!
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Return by {loan ? new Date(loan.end_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '...'}, 18:00 to {loan?.locker_bay}.
                      </p>
                      <p className="text-xs text-gray-400">
                        We&apos;ll remind you 2 hours before it&apos;s due.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          {step === 2 && <p className="text-center text-sm text-forest mb-4">Waiting for the shed kiosk to scan your pass…</p>}

          {step === 5 && (
            <button
              onClick={() => router.push(`/scan?mode=return&loan_id=${loan?.id}`)}
              className="btn-primary flex items-center justify-center gap-2 mb-4"
            >
              View my borrowing →
            </button>
          )}
        </div>
      </div>
    );
  }

  // ============ RETURN MODE ============
  const returnSteps = [
    { label: 'Return your item', done: step > 1, active: step === 1 },
    { label: 'Present your return QR at the shed', done: step > 2, active: step === 2 },
    { label: 'How did it hold up?', done: step > 3, active: step === 3 },
    { label: 'Take or upload a photo', done: step > 4, active: step === 4 },
    { label: 'Return confirmed. Thank you!', done: returnComplete, active: step === 5 && returnComplete },
  ];

  return (
    <div className="page-content">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <button onClick={() => router.back()}>
          <ArrowLeft size={22} />
        </button>
        <button>
          <MoreHorizontal size={22} className="text-gray-400" />
        </button>
      </div>

      <div className="px-5 pt-2">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Back into the circle.</h1>
        <p className="text-sm text-gray-400 mb-6">
          Return journey · {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
        </p>

        {/* Step tracker */}
        <div className="space-y-4 mb-8">
          {returnSteps.map((s, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                {s.done ? (
                  <CheckCircle2 size={24} className="text-forest" />
                ) : s.active ? (
                  <div className="step-dot step-dot-active">{i + 1}</div>
                ) : (
                  <Circle size={24} className="text-gray-200" />
                )}
                {i < returnSteps.length - 1 && (
                  <div className={`w-0.5 h-6 mt-1 ${s.done ? 'bg-forest/30' : 'bg-gray-100'}`} />
                )}
              </div>
              <div className="pt-0.5 flex-1">
                <p className={`text-sm font-medium ${s.done || s.active ? 'text-gray-900' : 'text-gray-400'}`}>
                  {s.label}
                </p>

                {/* Step 1 - Select item to return */}
                {i === 0 && step === 1 && loan && item && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-400 mb-2">Choose your current loan to begin.</p>
                    <div className="card bg-mint/30 border-forest/10">
                      <div className="flex gap-3">
                        <div className="w-14 h-14 shrink-0 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden">
                          {item.image_url ? (
                            <Image unoptimized width={56} height={56} src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-2xl">🔧</span>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{item.name} · {item.id}</p>
                          <p className="text-xs text-gray-500">
                            {RESIDENT_ID} · Due{' '}
                            {new Date(loan.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </p>
                          <span className="text-[10px] text-forest font-medium">Returning on time</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2 - QR Code for return */}
                {i === 1 && step >= 1 && step <= 2 && loan && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-400">
                      Scan at {item?.shed_name}. {loan.locker_bay} opens for your kit.
                    </p>
                    {step === 2 && (
                      <div className="mt-3 flex flex-col items-center">
                        <div className="bg-white p-3 rounded-2xl border border-card-border shadow-sm">
                          <QRCodeSVG
                            value={JSON.stringify({
                              loan_id: loan.id,
                              item_id: loan.item_id,
                              locker_bay: loan.locker_bay,
                              action: 'RETURN',
                              qr_token: loan.qr_token,
                            })}
                            size={140}
                            level="H"
                            includeMargin
                          />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2">Present this pass to the kiosk. Do not share it.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3 - Condition toggles */}
                {i === 2 && step === 3 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-400 mb-2">
                      Quick condition check · Score remains {item?.condition_score}/10
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setWorkingWell(!workingWell)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                          workingWell
                            ? 'bg-mint text-forest border border-forest/20'
                            : 'bg-gray-50 text-gray-400 border border-gray-200'
                        }`}
                      >
                        ✓ Working well
                      </button>
                      <button
                        onClick={() => setAllParts(!allParts)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                          allParts
                            ? 'bg-mint text-forest border border-forest/20'
                            : 'bg-gray-50 text-gray-400 border border-gray-200'
                        }`}
                      >
                        ✓ All parts included
                      </button>
                    </div>
                    <button
                      className="text-xs text-gray-400 mt-2 underline"
                    >
                      Something not right? Report an issue →
                    </button>
                  </div>
                )}

                {/* Step 4 - Photo upload */}
                {i === 3 && (step === 3 || step === 4) && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-400 mb-2">
                      Add a photo · Required<br />
                      Take a clear photo showing the item and all included accessories.
                    </p>

                    {returnPhotoPreview ? (
                      <div className="relative w-full h-40 rounded-xl overflow-hidden mb-2">
                         <Image unoptimized width={380} height={160}
                          src={returnPhotoPreview}
                          alt="Return photo"
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => {
                            setReturnPhoto(null);
                            setReturnPhotoPreview(null);
                          }}
                          className="absolute top-2 right-2 bg-black/50 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-3 border-2 border-dashed border-forest/30 rounded-xl text-forest text-sm font-medium flex items-center justify-center gap-2 hover:bg-mint/30 transition-colors"
                      >
                        <Camera size={18} />
                        Take or upload a photo
                      </button>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </div>
                )}

                {/* Step 5 - Complete */}
                {i === 4 && returnComplete && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500">
                      {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })},{' '}
                      {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · Locker closed · Loan complete.
                    </p>
                    <p className="text-xs text-forest font-medium mt-1">
                      Your {(loan as Loan & { _count?: number })?.id ? 'borrow' : '12th borrow'}. One more item kept in use.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        {step >= 3 && !returnComplete && (
          <div className="mb-4 rounded-xl bg-mint p-3 text-sm text-forest">
            Leave the kiosk bay open while completing this return. It closes automatically when you finish.
            {!returnBayOpened && <button onClick={() => { setError(''); setStep(2); }} className="mt-2 block font-semibold underline">Bay closed? Show return QR again to reopen it →</button>}
          </div>
        )}
        {step === 1 && mode === 'return' && (
          <button
            onClick={() => setStep(2)}
            className="btn-primary flex items-center justify-center gap-2 mb-4"
          >
            Show return QR →
          </button>
        )}

        {step === 2 && loan && (
          <p role="status" className="text-sm text-forest mb-4">
            {returnBayOpened ? `Bay ${loan.locker_bay} is open. Place your item inside, then continue below.` : `Waiting for the shed to scan your QR and open bay ${loan.locker_bay}…`}
          </p>
        )}

        {step === 2 && mode === 'return' && returnBayOpened && (
          <button onClick={() => setStep(3)} className="btn-primary mb-4">Item placed in open bay →</button>
        )}
        {step === 3 && mode === 'return' && (
          <button
            onClick={() => setStep(4)}
            className="btn-primary flex items-center justify-center gap-2 mb-4"
          >
            Continue to photo →
          </button>
        )}

        {(step === 4 || (step === 3 && returnPhoto)) && mode === 'return' && returnPhoto && (
          <button
            onClick={handleVerifyReturn}
            disabled={verifying}
            className="btn-primary flex items-center justify-center gap-2 mb-4"
          >
            {verifying ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Verifying with AI...
              </>
            ) : (
              <>Complete return →</>
            )}
          </button>
        )}

        {returnComplete && (
          <button
            onClick={() => router.push('/impact')}
            className="btn-primary flex items-center justify-center gap-2 mb-4 bg-forest"
          >
            🌱 See my impact →
          </button>
        )}
        {error && <p role="alert" className="text-red-600 text-sm text-center mb-4">{error}</p>}

        {returnComplete && (
          <p className="text-xs text-gray-400 text-center mb-4">
            Journey states shown together for this concept.
          </p>
        )}
      </div>
    </div>
  );
}

export default function ScanPage() {
  return (
    <Suspense
      fallback={
        <div className="page-content flex items-center justify-center">
          <Loader2 className="animate-spin text-forest" size={32} />
        </div>
      }
    >
      <ScanContent />
    </Suspense>
  );
}
