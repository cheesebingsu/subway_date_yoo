import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const supabaseSession = createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { chatId } = await request.json();
    if (!chatId) return NextResponse.json({ error: "Missing chatId" }, { status: 400 });

    const allowed = await rateLimit(user.id + "_deduct-kakao", 5, 60 * 1000);
    if (!allowed) return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });

    const admin = createAdminClient();

    const { data: chat } = await admin.from('chats').select('user_a, user_b, status').eq('id', chatId).single();
    if (!chat || (chat.user_a !== user.id && chat.user_b !== user.id)) {
       return NextResponse.json({ error: "Not participant" }, { status: 403 });
    }
    
    if (chat.status === 'kakao_exchanged') return NextResponse.json({ error: "Already exchanged" }, { status: 400 });
    
    // Verify tickets
    const { data: t } = await admin.from('tickets').select('amount').eq('user_id', user.id).single();
    if (!t || t.amount < 2) return NextResponse.json({ error: "Not enough tickets" }, { status: 400 });

    // Deduct 2 tickets
    await admin.from('tickets').update({ amount: t.amount - 2 }).eq('user_id', user.id);
    
    // Set status to exchanged
    await admin.from('chats').update({ status: 'kakao_exchanged' }).eq('id', chatId);

    // Fetch both Kakao IDs
    const { data: kakaoA } = await admin.from('kakao_ids').select('kakao_id').eq('user_id', chat.user_a).single();
    const { data: kakaoB } = await admin.from('kakao_ids').select('kakao_id').eq('user_id', chat.user_b).single();

    return NextResponse.json({ 
      success: true, 
      user_a_kakao: kakaoA?.kakao_id, 
      user_b_kakao: kakaoB?.kakao_id 
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
