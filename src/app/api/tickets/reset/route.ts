import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    
    // Only allow invocations passing the CRON_SECRET or from Edge function
    // If not set in ENV, we skip but at least check if it matches
    const cronSecret = process.env.CRON_SECRET || 'fallback_local_secret';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
    }

    const admin = createAdminClient();

    // supabase update syntax requires providing the WHERE clause.
    // Instead of doing UPDATE amount = 2 WHERE amount < 2 (which is hard in simple JS client builder),
    // we use an RPC, or select then update. Since it's a cron, RPC is better.
    // Fallback if RPC doesn't exist:
    const { data: tickets } = await admin.from('tickets').select('user_id, amount').lt('amount', 2);
    
    if (tickets && tickets.length > 0) {
       for (const t of tickets) {
         await admin.from('tickets').update({ amount: 2 }).eq('user_id', t.user_id);
       }
    }

    return NextResponse.json({ success: true, reset: tickets?.length || 0 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
