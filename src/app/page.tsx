"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { BottomNav } from "@/components/layout/BottomNav";
import { TicketIcon } from "@/components/ui/TicketIcon";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const supabase = createClient();
  const router = useRouter();
  
  const [ticketCount, setTicketCount] = useState<number>(0);
  const [isCurrentlyBoarding, setIsCurrentlyBoarding] = useState(false);
  const [totalBoardingCount, setTotalBoardingCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // 초기 데이터 로드
  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth');
        return;
      }

      // 티켓 조회
      const { data: tickets } = await supabase
        .from('tickets')
        .select('amount')
        .eq('user_id', user.id)
        .single();
      if (tickets) setTicketCount(tickets.amount);

      // 현재 탑승 상태 확인
      const { data: boarding } = await supabase
        .from('boarding_status')
        .select('is_boarding')
        .eq('user_id', user.id)
        .order('boarded_at', { ascending: false })
        .limit(1)
        .single();

      if (boarding && boarding.is_boarding) {
        setIsCurrentlyBoarding(true);
      }

      // 오늘 탑승 인원 수
      const today = new Date().toISOString().split("T")[0];
      const { count } = await supabase
        .from('boarding_status')
        .select('*', { count: 'exact', head: true })
        .gte('boarded_at', `${today}T00:00:00.000Z`);
        
      setTotalBoardingCount(count || 0);
      setIsLoading(false);
    }
    loadData();
  }, [supabase, router]);

  // 실시간 탑승 카운트 구독
  useEffect(() => {
    const channel = supabase.channel('boarding-count')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'boarding_status' }, () => {
        const today = new Date().toISOString().split("T")[0];
        supabase.from('boarding_status').select('*', { count: 'exact', head: true }).gte('boarded_at', `${today}T00:00:00.000Z`)
          .then(({ count }) => setTotalBoardingCount(count || 0));
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // 탑승 기다리기 → 즉시 /match 이동
  const handleBoardStart = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 기존 탑승 기록 종료
    await supabase.from('boarding_status')
      .update({ is_boarding: false, alighted_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('is_boarding', true);

    // 새 탑승 기록 생성 (matching_started_at 포함)
    const { error } = await supabase
      .from('boarding_status')
      .insert({
        user_id: user.id,
        is_boarding: true,
        line: '',
        boarded_at: new Date().toISOString(),
        matching_started_at: new Date().toISOString()
      });

    if (error) {
      toast.error("탑승 처리에 실패했습니다.");
      return;
    }

    // 즉시 매칭 페이지로 이동
    router.push('/match');
  };

  // 하차 처리
  const handleBoardEnd = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('boarding_status')
      .update({ is_boarding: false, alighted_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('is_boarding', true);

    setIsCurrentlyBoarding(false);
    toast.success("다음에 또 만나요! 👋");
  };

  if (isLoading) return <div className="min-h-screen bg-base" />;

  return (
    <div className="relative flex flex-col h-screen bg-base">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-6 py-4 bg-white/70 backdrop-blur-md z-40">
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
          설레철
        </h1>
        <div className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-full font-bold text-text-primary border border-border-default">
          <TicketIcon className="w-5 h-5 text-primary" />
          <span>{ticketCount}</span>
        </div>
      </header>

      {/* 메인 영역 */}
      <main className="flex-1 flex flex-col items-center justify-center -mt-10 overflow-y-auto pb-24">
        
        {isCurrentlyBoarding ? (
          /* 현재 탑승 중 */
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center w-full space-y-8">
            <button onClick={() => router.push('/match')} className="group relative flex items-center justify-center w-56 h-56 transition-transform active:scale-95 z-10 mt-6">
              <div className="absolute w-full h-full rounded-full border-4 border-dashed border-green-400/60 animate-[spin_10s_linear_infinite]" />
              <div className="w-44 h-44 rounded-full bg-gradient-to-tr from-green-500 to-green-400 shadow-xl flex flex-col items-center justify-center text-white">
                <span className="text-4xl mb-1">🚇</span>
                <span className="font-extrabold text-sm">탑승 중이에요</span>
                <span className="text-xs font-semibold opacity-80 mt-1">매칭 보러 가기 →</span>
              </div>
            </button>

            <button 
              onClick={handleBoardEnd}
              className="px-6 py-3 rounded-full bg-white border-2 border-red-300 text-red-500 font-bold text-sm hover:bg-red-50 transition active:scale-95"
            >
              🚪 탑승 끝내기
            </button>

            <div className="flex flex-col items-center bg-white border border-border-default px-6 py-4 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
              <span className="text-sm font-semibold text-text-secondary mb-1">오늘 하루, 대중교통 안에서</span>
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <p className="text-lg font-bold text-text-primary">
                  <span className="text-primary text-xl font-extrabold mr-1">{totalBoardingCount}</span>명이 오늘 탑승했어요
                </p>
              </div>
            </div>
          </motion.div>

        ) : (
          /* 미탑승 상태 */
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center w-full space-y-6">
            <button onClick={handleBoardStart} className="group relative flex items-center justify-center w-56 h-56 transition-transform active:scale-95 z-10 mt-6">
              <div className="absolute w-full h-full rounded-full border-4 border-dashed border-primary/40 animate-[spin_10s_linear_infinite]" />
              <div className="w-44 h-44 rounded-full bg-white shadow-xl flex flex-col items-center justify-center text-primary border-2 border-border-default group-hover:border-primary transition-colors">
                <span className="text-5xl mb-2 grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all">🚇</span>
                <span className="font-extrabold text-[17px]">탑승 기다리기</span>
              </div>
            </button>

            {/* 안내 문구 */}
            <p className="text-sm text-text-muted font-medium text-center">
              버튼을 누르면 5분간 실시간으로 인연을 탐색해요
            </p>

            {/* 실시간 탑승 카운트 */}
            <div className="flex flex-col items-center bg-white border border-border-default px-6 py-4 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] mt-2">
              <span className="text-sm font-semibold text-text-secondary mb-1">오늘 하루, 대중교통 안에서</span>
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <p className="text-lg font-bold text-text-primary">
                  <span className="text-primary text-xl font-extrabold mr-1">{totalBoardingCount}</span>명이 오늘 탑승했어요
                </p>
              </div>
            </div>
          </motion.div>
        )}

      </main>

      <BottomNav />
    </div>
  );
}
