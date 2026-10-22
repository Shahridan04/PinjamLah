'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Locker, Loan } from '@/types/database';
import { Lock, Unlock, Camera, ScanLine, ArrowUpRight, Leaf } from 'lucide-react';

type Pass = { loan_id: string; qr_token: string; locker_bay: string; item_id: string; action: 'PICKUP' | 'RETURN' };

export default function KioskPage() {
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [message, setMessage] = useState('Ready to scan a resident pass.');
  const [qrInput, setQrInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [returnBays, setReturnBays] = useState<string[]>([]);
  const [connection, setConnection] = useState('Connecting…');
  const returnBaysRef = useRef<string[]>([]);
  const scanner = useRef<import('html5-qrcode').Html5Qrcode | null>(null);
  const processing = useRef(false);

  const rememberReturns = useCallback((bays: string[]) => {
    returnBaysRef.current = bays;
    setReturnBays(bays);
    try { sessionStorage.setItem('pinjamlah-return-bays', JSON.stringify(bays)); } catch { /* Private browsing may disable storage. */ }
  }, []);

  const loadLockers = useCallback(async () => {
    const { data, error } = await supabase.from('lockers').select('*').order('bay_code');
    if (error) { setConnection('Connection interrupted'); }
    else {
      setConnection('Synced · refreshes every 3s');
      setLockers(data as Locker[]);
      rememberReturns(returnBaysRef.current.filter(bay => data.some(locker => locker.bay_code === bay && locker.is_unlocked)));
    }
  }, [rememberReturns]);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem('pinjamlah-return-bays') || '[]');
      if (Array.isArray(saved)) returnBaysRef.current = saved.filter((bay): bay is string => typeof bay === 'string');
    } catch { /* Storage is optional. */ }
    queueMicrotask(() => { void loadLockers(); });
    const timer = window.setInterval(() => { void loadLockers(); }, 3000);
    const refresh = () => { if (!document.hidden) void loadLockers(); };
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [loadLockers]);

  async function stopCamera() {
    if (scanner.current) {
      try { await scanner.current.stop(); } catch { /* Camera may not have started. */ }
      scanner.current.clear();
      scanner.current = null;
    }
    setCameraOn(false);
  }

  async function startCamera() {
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const instance = new Html5Qrcode('kiosk-camera');
      scanner.current = instance;
      await instance.start({ facingMode: 'environment' }, { fps: 10, qrbox: 220 }, (text) => {
        if (!processing.current) { void processPass(text); }
      }, () => {});
      setCameraOn(true);
      setMessage('Camera ready. Show the resident pass.');
    } catch {
      setMessage('Camera unavailable. Use the manual pass field below (localhost or HTTPS is required).');
      await stopCamera();
    }
  }

  async function processPass(raw: string) {
    if (processing.current) return;
    processing.current = true;
    setBusy(true);
    try {
      const pass = JSON.parse(raw) as Pass;
      if (!pass.loan_id || !pass.qr_token || !pass.locker_bay || !pass.item_id || !['PICKUP', 'RETURN'].includes(pass.action)) {
        throw new Error('Invalid pass format.');
      }
      const { data: loan, error: loanError } = await supabase.from('loans').select('*').eq('id', pass.loan_id).single();
      if (loanError || !loan) throw new Error('Loan not found.');
      const validated = loan as Loan;
      if (validated.qr_token !== pass.qr_token || validated.locker_bay !== pass.locker_bay || validated.item_id !== pass.item_id) {
        throw new Error('Pass does not match this loan or locker.');
      }
      if (pass.action === 'PICKUP' && validated.status !== 'RESERVED') throw new Error('This booking is not awaiting pickup.');
      if (pass.action === 'RETURN' && validated.status !== 'ACTIVE') throw new Error('This item is not on an active loan.');
      // A new pickup must never inherit a previous return's UI lock for this bay.
      if (pass.action === 'PICKUP') rememberReturns(returnBaysRef.current.filter(bay => bay !== validated.locker_bay));
      const { data: locker, error: lockerError } = await supabase.from('lockers').select('*').eq('bay_code', validated.locker_bay).single();
      if (lockerError || !locker || locker.shed_name !== 'Central Park shed') throw new Error('Wrong shed or locker not found.');
      if (locker.is_unlocked) throw new Error('Bay is already open. Close it before scanning again.');

      // This changes the database-backed simulated bay; no real hardware is connected.
      const { error: unlockError } = await supabase.from('lockers').update({ is_unlocked: true, last_updated: new Date().toISOString() }).eq('bay_code', validated.locker_bay).eq('is_unlocked', false);
      if (unlockError) throw unlockError;
      if (pass.action === 'PICKUP') {
        const { data: updated, error: updateError } = await supabase.from('loans').update({ status: 'ACTIVE', collected_at: new Date().toISOString() }).eq('id', validated.id).eq('status', 'RESERVED').select('id');
        if (updateError || !updated?.length) throw new Error('Pickup status could not be updated. Close the bay and retry.');
        const { error: itemError } = await supabase.from('items').update({ status: 'In Use' }).eq('id', validated.item_id);
        if (itemError) throw new Error('Pickup recorded, but item status needs operator attention.');
      }
      if (pass.action === 'RETURN') rememberReturns([...new Set([...returnBaysRef.current, validated.locker_bay])]);
      setMessage(`${pass.action === 'PICKUP' ? 'Pickup approved' : 'Return approved'} — bay ${validated.locker_bay} is OPEN. ${pass.action === 'RETURN' ? 'Leave this bay open. Finish the photo and tap Complete return on the resident phone. The bay closes automatically.' : 'Collect the item, then close the bay.'}`);
      setQrInput('');
      await loadLockers();
      if (scanner.current) await stopCamera();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Pass could not be processed.');
    } finally {
      setBusy(false);
      processing.current = false;
    }
  }

  async function closeBay(bay: string) {
    if (returnBays.includes(bay)) {
      setMessage('Finish the return on the resident phone. The bay will close automatically.');
      return;
    }
    const { error } = await supabase.from('lockers').update({ is_unlocked: false, last_updated: new Date().toISOString() }).eq('bay_code', bay);
    setMessage(error ? `Could not close bay ${bay}: ${error.message}` : `Bay ${bay} closed.`);
    await loadLockers();
  }

  return (
    <main className="kiosk-console">
      <header className="kiosk-header"><a href="/welcome" className="flex items-center gap-3 text-xl font-bold"><Leaf /> PinjamLah<span className="text-lime-200">.</span></a><span className="kiosk-badge">NEIGHBOURHOOD LOCKERS</span></header>
      <div className="kiosk-intro"><div><p className="eyebrow text-lime-200">CENTRAL PARK SHED</p><h1>Good things are<br />better shared.</h1><p className="text-white/70 mt-4">Pick up a possibility. Return it for the next neighbour.</p></div><div className="kiosk-sync" role="status">{connection}<p className="mt-2 text-xs text-white/50">Scan your pass to pick up or return an item</p></div></div>
      <div className="kiosk-workspace">
      <section className="kiosk-lockers"><div className="flex items-center justify-between mb-5"><h2 className="text-lg font-semibold">Your neighbourhood lockers</h2><span className="text-xs text-white/60">{lockers.filter(l => l.shed_name === 'Central Park shed' && l.is_unlocked).length} open</span></div>
      {lockers.length === 0 && <p className="p-5 text-white/70">{connection === 'Connection interrupted' ? 'Unable to load bays. Check the connection; we’ll retry automatically.' : 'Waiting for locker data…'}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {lockers.filter(l => l.shed_name === 'Central Park shed').map(l => (
          <div key={l.bay_code} className={`kiosk-bay ${l.is_unlocked ? 'kiosk-bay-open' : ''}`}>
            {l.is_unlocked ? <Unlock /> : <Lock />}
            <p className="text-3xl font-bold mt-5">{l.bay_code}</p>
            <p className="text-xs mt-2 font-semibold tracking-widest">{l.is_unlocked ? 'DOOR OPEN' : 'SECURE · CLOSED'}</p>
            {l.is_unlocked && (returnBays.includes(l.bay_code)
              ? <p className="mt-3 text-xs font-semibold">Return in progress · Finish on resident phone. Bay closes automatically.</p>
              : <button className="mt-3 rounded-lg bg-forest text-white px-3 py-2 text-sm" onClick={() => void closeBay(l.bay_code)}>Close pickup bay</button>)}
          </div>
        ))}
      </div>
      <p className="mt-5 text-xs text-white/60">Pickup: collect, then close the bay. Return: finish on your phone.</p></section>
      <section className="kiosk-scanner">
        <span className="scanner-symbol"><ScanLine size={32} /></span>
        <p className="eyebrow mt-5 text-forest">YOUR PHONE IS YOUR KEY</p>
        <h2 className="text-2xl font-bold mt-2">Scan. Open. Share.</h2>
        <p className="text-sm text-gray-600 mt-3">Open your pickup or return pass on the resident phone. Hold the QR code in front of this camera.</p>
        <div id="kiosk-camera" className="max-w-sm mt-3" />
        <button disabled={busy} className="btn-primary flex justify-center items-center gap-2 mt-5" onClick={() => void (cameraOn ? stopCamera() : startCamera())}><Camera size={18} />{cameraOn ? 'Stop camera' : 'Start camera scan'}</button>
        <details className="mt-5 border-t border-gray-200 pt-4"><summary className="text-sm text-gray-600 cursor-pointer">Camera unavailable? Use a demo pass</summary>
        <p className="text-xs text-gray-500 mt-3">Paste the QR pass JSON from the resident phone.</p>
        <div className="flex gap-2 mt-2">
          <input aria-label="QR pass JSON" className="min-w-0 flex-1 rounded-lg bg-white text-gray-900 p-2" value={qrInput} onChange={e => setQrInput(e.target.value)} placeholder="Paste pass JSON" />
          <button disabled={busy || !qrInput.trim()} className="rounded-lg bg-forest text-white px-4 disabled:opacity-50" onClick={() => void processPass(qrInput)}>{busy ? 'Checking…' : 'Scan'}</button>
        </div>
        </details>
      </section></div>
      <p role="status" className="kiosk-message"><ScanLine size={20} className="shrink-0 text-lime-200" />{message}</p>
      <footer className="mt-8 flex justify-between gap-4 text-xs text-white/50"><span>A little less mine. A lot more ours.</span><a href="/home" className="flex items-center gap-1">Resident experience <ArrowUpRight size={14} /></a></footer>
    </main>
  );
}
