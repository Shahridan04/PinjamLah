import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Demo only: the photo is previewed on the resident device, never uploaded or inspected.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { loan_id: loanId, item_id: itemId, working_well: workingWell, all_parts_included: allPartsIncluded } = body;
    if (typeof loanId !== 'string' || typeof itemId !== 'string' || typeof workingWell !== 'boolean' || typeof allPartsIncluded !== 'boolean') {
      return NextResponse.json({ success: false, error: 'Invalid return details.' }, { status: 400 });
    }
    const { data: loan, error: loanError } = await supabase.from('loans').select('*').eq('id', loanId).eq('item_id', itemId).eq('status', 'ACTIVE').single();
    if (loanError || !loan) return NextResponse.json({ success: false, error: 'Active loan not found.' }, { status: 409 });
    const { data: bay, error: bayError } = await supabase.from('lockers').select('is_unlocked').eq('bay_code', loan.locker_bay).single();
    if (bayError || !bay?.is_unlocked) return NextResponse.json({ success: false, error: 'Scan the return pass at the kiosk and leave the bay open until you finish.' }, { status: 409 });

    const { data: item, error: itemLookupError } = await supabase.from('items').select('total_loans, retail_price_rm, co2_per_borrow_kg').eq('id', itemId).single();
    if (itemLookupError || !item) throw itemLookupError ?? new Error('Item not found.');
    const { data: completed, error: completionError } = await supabase.from('loans').update({
      status: 'RETURNED', returned_at: new Date().toISOString(), working_well: workingWell,
      all_parts_included: allPartsIncluded,
      ai_verification_json: { status: 'demo_only', notes: 'Photo preview only; no image recognition or upload performed.' },
    }).eq('id', loanId).eq('status', 'ACTIVE').select('id');
    if (completionError || !completed?.length) throw completionError ?? new Error('Loan already completed.');

    const [itemResult, bayResult] = await Promise.all([
      supabase.from('items').update({ status: 'Available', total_loans: (item.total_loans ?? 0) + 1 }).eq('id', itemId),
      supabase.from('lockers').update({ is_unlocked: false, last_updated: new Date().toISOString() }).eq('bay_code', loan.locker_bay),
    ]);
    if (itemResult.error || bayResult.error) throw itemResult.error ?? bayResult.error;
    const { data: profile } = await supabase.from('profiles').select('total_saved_rm, total_co2_kg, completed_borrows').eq('id', loan.resident_id).single();
    if (profile) {
      const { error } = await supabase.from('profiles').update({
        total_saved_rm: (profile.total_saved_rm ?? 0) + (item.retail_price_rm ?? 0),
        total_co2_kg: (profile.total_co2_kg ?? 0) + (item.co2_per_borrow_kg ?? 0),
        completed_borrows: (profile.completed_borrows ?? 0) + 1,
      }).eq('id', loan.resident_id);
      if (error) throw error;
    }
    return NextResponse.json({ success: true, demo_only: true });
  } catch (error) {
    console.error('Return completion error:', error);
    return NextResponse.json({ success: false, error: 'Could not finish the return. Please check the loan and bay status.' }, { status: 500 });
  }
}