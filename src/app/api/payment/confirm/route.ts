import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const { paymentKey, orderId, amount, userId, ticketAmount } = await req.json();

    const allowed = await rateLimit(userId + "_payment", 5, 60 * 1000);
    if (!allowed) return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });

    // 1. 토스페이먼츠 승인(Confirm) API 호출
    const widgetSecretKey = "test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6";
    const encryptedSecretKey = Buffer.from(widgetSecretKey + ":").toString("base64");

    const response = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: `Basic ${encryptedSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount,
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: body.message }, { status: response.status });
    }

    // 2. 결제 완료 후, 유저의 티켓 개수 업데이트
    const admin = createAdminClient();

    // 현재 티켓 수 조회
    const { data: ticketData, error: ticketError } = await admin
      .from('tickets')
      .select('amount')
      .eq('user_id', userId)
      .single();

    if (ticketError) throw ticketError;

    const newAmount = ticketData.amount + ticketAmount;
    
    // 티켓 지급
    const { error: updateError } = await admin
      .from('tickets')
      .update({ amount: newAmount })
      .eq('user_id', userId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, newAmount, data: body });
  } catch (error: any) {
    console.error("Payment Confirmation Error:", error);
    return NextResponse.json({ error: error.message || "결제 승인 중 오류가 발생했습니다." }, { status: 500 });
  }
}
