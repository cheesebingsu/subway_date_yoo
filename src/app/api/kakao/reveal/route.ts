import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const supabaseSession = createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { chatId } = await request.json();
    if (!chatId) return NextResponse.json({ error: "Missing chatId" }, { status: 400 });

    const admin = createAdminClient();

    const { data: chat } = await admin.from('chats').select('user_a, user_b, status').eq('id', chatId).single();
    if (!chat || (chat.user_a !== user.id && chat.user_b !== user.id)) {
       return NextResponse.json({ error: "Not participant" }, { status: 403 });
    }
    
    if (chat.status !== 'kakao_exchanged') {
       return NextResponse.json({ error: "Chat status is not kakao_exchanged" }, { status: 403 });
    }

    const opponentId = chat.user_a === user.id ? chat.user_b : chat.user_a;

    // Fetch opponent Kakao ID
    const { data: kakao } = await admin.from('kakao_ids').select('kakao_id').eq('user_id', opponentId).single();

    return NextResponse.json({ 
      success: true, 
      kakao_id: kakao?.kakao_id || null
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
