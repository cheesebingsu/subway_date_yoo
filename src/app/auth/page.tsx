"use client";

import { createClient } from "@/lib/supabase/client";
import { TicketIcon } from "@/components/ui/TicketIcon";
import { Button } from "@/components/ui/Button";
import { useState } from "react";
import { toast } from "sonner";

export default function AuthPage() {
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const handleKakaoLogin = async () => {
    setIsLoading(true);
    try {
      // CSRF 방어용 난수 state 발급
      const randomState = Math.random().toString(36).substring(2, 15);
      document.cookie = `oauth_state=${randomState}; path=/; max-age=300; secure; samesite=lax`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "kakao",
        options: {
          scopes: "profile_nickname profile_image",
          redirectTo: `${location.origin}/auth/callback?state=${randomState}`,
          queryParams: {
            state: randomState,
          }
        },
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || "카카오 로그인 중 오류가 발생했습니다.");
      setIsLoading(false);
    }
  };

  return (
    <main className="flex flex-col h-full w-full bg-base items-center justify-between px-6 py-20 pb-12">
      <div className="flex flex-col items-center flex-1 justify-center space-y-6 -mt-10">
        <TicketIcon className="w-16 h-16 text-primary mb-2" />
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold text-text-primary">설레철</h1>
          <p className="text-text-secondary text-[16px]">
            어차피 타는 지하철, 조금만 설레어 볼까요?
          </p>
        </div>
      </div>

      <div className="w-full space-y-4 max-w-sm">
        <button
          onClick={handleKakaoLogin}
          disabled={isLoading}
          className="w-full h-14 rounded-xl bg-[#FEE500] text-[#191919] font-bold text-[16px] flex items-center justify-center transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isLoading ? (
            <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#191919]" />
          ) : (
            "카카오로 시작하기"
          )}
        </button>
        <p className="text-center text-[13px] text-text-muted">
          가입 시 이용약관과 개인정보처리방침에 동의하게 됩니다.
        </p>
      </div>
    </main>
  );
}
