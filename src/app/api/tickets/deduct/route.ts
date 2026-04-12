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

    // Update Request status to accepted / connected
    await adminClient.from('chat_requests').update({ status: 'connected' }).eq('id', requestId);

    // Deduct 1 ticket
    await adminClient.from('tickets').update({ amount: t.amount - 1 }).eq('user_id', user.id);

    // Insert Chat using admin bypass
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
