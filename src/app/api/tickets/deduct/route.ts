import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const supabaseSession = createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate Limit: 10 requests / 1 min
    const allowed = await rateLimit(user.id + "_deduct", 10, 60 * 1000);
    if (!allowed) return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });

    const { requestId } = await request.json();
    if (!requestId) return NextResponse.json({ error: "Missing requestId" }, { status: 400 });

    const adminClient = createAdminClient();

    // Verify request
    const { data: req } = await adminClient.from('chat_requests').select('requester_id, target_id, status').eq('id', requestId).single();
    if (!req || req.target_id !== user.id) {
       return NextResponse.json({ error: "Invalid request or not target" }, { status: 403 });
    }

    // Verify tickets
    const { data: t } = await adminClient.from('tickets').select('amount').eq('user_id', user.id).single();
    if (!t || t.amount < 1) {
      return NextResponse.json({ error: "Not enough tickets" }, { status: 400 });
    }

    // 이미 두 사람 사이의 active 채팅방이 있는지 확인 (중복 방지)
    const { data: existingChat } = await adminClient
      .from('chats')
      .select('id')
      .or(
        `and(user_a.eq.${req.requester_id},user_b.eq.${req.target_id}),` +
        `and(user_a.eq.${req.target_id},user_b.eq.${req.requester_id})`
      )
      .eq('status', 'active')
      .maybeSingle();

    if (existingChat) {
      // 이미 채팅방이 있으면 기존 ID 반환 (ticket 차감/상태 변경은 이미 위에서 완료)
      return NextResponse.json({ success: true, chatId: existingChat.id });
    }

    // Update Request status to accepted / connected
    await adminClient.from('chat_requests').update({ status: 'connected' }).eq('id', requestId);

    // Deduct 1 ticket
    await adminClient.from('tickets').update({ amount: t.amount - 1 }).eq('user_id', user.id);

    // 새 채팅방 생성
    const { data: newChat, error: chatErr } = await adminClient.from('chats').insert({
       user_a: req.requester_id,
       user_b: req.target_id,
       status: 'active'
    }).select('id').single();

    if (chatErr) throw chatErr;

    return NextResponse.json({ success: true, chatId: newChat.id });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
