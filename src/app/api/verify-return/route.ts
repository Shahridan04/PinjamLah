import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const photo = formData.get('photo') as File;
    const loanId = formData.get('loan_id') as string;
    const itemId = formData.get('item_id') as string;
    const itemName = formData.get('item_name') as string;
    const workingWell = formData.get('working_well') === 'true';
    const allPartsIncluded = formData.get('all_parts_included') === 'true';

    if (!photo || !loanId || !itemId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    const { data: activeLoan, error: activeError } = await supabase.from('loans').select('*').eq('id', loanId).eq('item_id', itemId).eq('status', 'ACTIVE').single();
    if (activeError || !activeLoan) return NextResponse.json({ success: false, error: 'Active loan not found.' }, { status: 409 });
    const { data: openedBay } = await supabase.from('lockers').select('is_unlocked').eq('bay_code', activeLoan.locker_bay).single();
    if (!openedBay?.is_unlocked) return NextResponse.json({ success: false, error: 'Scan the return pass at the kiosk before completing your return.' }, { status: 409 });
    if (!photo.type.startsWith('image/') || photo.size > 8 * 1024 * 1024) return NextResponse.json({ success: false, error: 'Upload an image smaller than 8 MB.' }, { status: 400 });

    // Convert photo to buffer for Gemini
    const bytes = await photo.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');

    // Upload photo to Supabase Storage
    const fileName = `${loanId}-${Date.now()}.jpg`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('return-photos')
      .upload(fileName, buffer, {
        contentType: photo.type || 'image/jpeg',
        upsert: true,
      });
    if (uploadError) throw uploadError;

    let returnPhotoUrl = '';
    if (uploadData) {
      const { data: urlData } = supabase.storage
        .from('return-photos')
        .getPublicUrl(fileName);
      returnPhotoUrl = urlData.publicUrl;
    }

    // Call Gemini Vision API
    let aiResult: Record<string, unknown> = { status: 'manual_review', notes: 'Automated inspection unavailable; operator review required.' };

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey && geminiApiKey !== 'your_gemini_api_key') {
      try {
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' });

        const prompt = `You are an AI inspection system for a community tool-lending library called "Sharing Shed".

A resident is returning a borrowed item: "${itemName}" (ID: ${itemId}).

The resident has self-reported:
- Working well: ${workingWell ? 'Yes' : 'No'}
- All parts included: ${allPartsIncluded ? 'Yes' : 'No'}

Please inspect this return photo and provide:
1. "matches_item" (boolean): Does the photo appear to show the item "${itemName}" or a similar tool/equipment?
2. "accessories_visible" (boolean): Can you see accessories or kit components (charger, bits, case, etc.)?
3. "condition_score" (number 1.0-10.0): Estimate the visible condition of the item.
4. "notes" (string): Brief 1-2 sentence assessment.

Return ONLY valid JSON with these 4 fields, no markdown formatting.`;

        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              mimeType: photo.type || 'image/jpeg',
              data: base64Image,
            },
          },
        ]);

        const responseText = result.response.text();
        // Try to parse JSON from the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiResult = JSON.parse(jsonMatch[0]);
        }
      } catch (aiError) {
        console.error('Gemini API error:', aiError);
        // Fall back to default result if Gemini fails
      }
    }

    const conditionScore = typeof aiResult.condition_score === 'number'
      ? aiResult.condition_score
      : null;

    // Fetch item data for savings calculation
    const { data: itemData } = await supabase
      .from('items')
      .select('retail_price_rm, co2_per_borrow_kg, condition_score, total_loans')
      .eq('id', itemId)
      .single();

    // Database completion transaction
    // 1. Update loan
    const { error: loanError } = await supabase
      .from('loans')
      .update({
        status: 'RETURNED',
        returned_at: new Date().toISOString(),
        working_well: workingWell,
        all_parts_included: allPartsIncluded,
        return_photo_url: returnPhotoUrl,
        ai_verification_json: aiResult,
        return_condition_score: conditionScore,
      })
      .eq('id', loanId).eq('status', 'ACTIVE');

    if (loanError) {
      throw loanError;
    }

    // 2. Get loan's locker bay
    const { data: loanData } = await supabase
      .from('loans')
      .select('locker_bay')
      .eq('id', loanId)
      .single();

    // 3. Close locker
    if (loanData) {
      await supabase
        .from('lockers')
        .update({
          is_unlocked: false,
          last_updated: new Date().toISOString(),
        })
        .eq('bay_code', loanData.locker_bay);
    }

    // 4. Update item: Available, increment total_loans, update condition
    if (itemData) {
      await supabase
        .from('items')
        .update({
          status: 'Available',
          total_loans: (itemData.total_loans || 0) + 1,
          ...(conditionScore !== null ? { condition_score: conditionScore } : {}),
        })
        .eq('id', itemId);

      // 5. Update resident profile: increment savings
      const { data: loan } = await supabase
        .from('loans')
        .select('resident_id')
        .eq('id', loanId)
        .single();

      if (loan) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('total_saved_rm, total_co2_kg, completed_borrows')
          .eq('id', loan.resident_id)
          .single();

        if (profile) {
          await supabase
            .from('profiles')
            .update({
              total_saved_rm: (profile.total_saved_rm || 0) + (itemData.retail_price_rm || 0),
              total_co2_kg: (profile.total_co2_kg || 0) + (itemData.co2_per_borrow_kg || 0),
              completed_borrows: (profile.completed_borrows || 0) + 1,
            })
            .eq('id', loan.resident_id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      ai_verification: aiResult,
      condition_score: conditionScore,
      return_photo_url: returnPhotoUrl,
      savings_added_rm: itemData?.retail_price_rm || 0,
      co2_avoided_kg: itemData?.co2_per_borrow_kg || 0,
    });
  } catch (error) {
    console.error('Verify return error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
