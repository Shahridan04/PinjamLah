'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Locker, Loan } from '@/types/database';
import { Lock, Unlock, Camera } from 'lucide-react';

type Pass = { loan_id: string; qr_token: string; locker_bay: string; item_id: string; action: 'PICKUP' | 'RETURN' };

export default function KioskPage() {
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [message, setMessage] = useState('Ready to scan a resident pass.');
  const [qrInput, setQrInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [returnBays, setReturnBays] = useState<string[]>([]);
  const scanner = useRef<import('html5-qrcode').Html5Qrcode | null>(null);
  const processing = useRef(false);

  useEffect(() => {
    void loadLockers();
    const channel = supabase.channel('pinjamlah-kiosk')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lockers' }, (payload) => {
        const updated = payload.new as Locker;
        setLockers(prev => prev.map(l => l.bay_code === updated.bay_code ? updated : l));
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  async function loadLockers() {
    const { data, error } = await supabase.from('lockers').select('*').order('bay_code');
    if (error) setMessage(`Unable to load lockers: ${error.message}`);
    else setLockers(data as Locker[]);
  }

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
      if (pass.action === 'RETURN') setReturnBays(previous => [...new Set([...previous, validated.locker_bay])]);
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
    <main className="min-h-screen bg-forest text-white p-6">
      <h1 className="text-3xl font-bold">PinjamLah · Shed kiosk</h1>
      <p className="text-white/70 mt-1">Central Park · Database-backed locker simulation (not physical hardware)</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-8">
        {lockers.filter(l => l.shed_name === 'Central Park shed').map(l => (
          <div key={l.bay_code} className={`rounded-2xl p-5 ${l.is_unlocked ? 'bg-mint text-forest' : 'bg-white/10'}`}>
            {l.is_unlocked ? <Unlock /> : <Lock />}
            <p className="text-xl font-bold mt-2">{l.bay_code}</p>
            <p>{l.is_unlocked ? 'OPEN' : 'Closed'}</p>
            {l.is_unlocked && (returnBays.includes(l.bay_code)
              ? <p className="mt-3 text-xs font-semibold">Return in progress · Finish on resident phone. Bay closes automatically.</p>
              : <button className="mt-3 rounded-lg bg-forest text-white px-3 py-2 text-sm" onClick={() => void closeBay(l.bay_code)}>Close pickup bay</button>)}
          </div>
        ))}
      </div>
      <section className="bg-white/10 rounded-2xl p-5">
        <h2 className="font-bold flex items-center gap-2"><Camera size={20} /> Resident pass scanner</h2>
        <div id="kiosk-camera" className="max-w-sm mt-3" />
        <button className="rounded-lg bg-white text-forest px-4 py-2 mt-3" onClick={() => void (cameraOn ? stopCamera() : startCamera())}>{cameraOn ? 'Stop camera' : 'Start camera scan'}</button>
        <p className="text-sm text-white/70 mt-5">Camera unavailable? Paste the QR pass JSON for a manual demo scan.</p>
        <div className="flex gap-2 mt-2">
          <input aria-label="QR pass JSON" className="min-w-0 flex-1 rounded-lg bg-white text-gray-900 p-2" value={qrInput} onChange={e => setQrInput(e.target.value)} placeholder="Paste pass JSON" />
          <button disabled={busy || !qrInput.trim()} className="rounded-lg bg-white text-forest px-4 disabled:opacity-50" onClick={() => void processPass(qrInput)}>{busy ? 'Checking…' : 'Scan'}</button>
        </div>
      </section>
      <p role="status" className="bg-white/10 rounded-2xl p-5 mt-5">{message}</p>
    </main>
  );
}