"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { BottomNav } from "@/components/layout/BottomNav";
import { TicketIcon } from "@/components/ui/TicketIcon";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const lines = [
  { id: "1호선", color: "bg-[#0052A4]" },
  { id: "2호선", color: "bg-[#009D3E]" },
  { id: "3호선", color: "bg-[#EF7C1C]" },
  { id: "4호선", color: "bg-[#00A5DE]" },
  { id: "5호선", color: "bg-[#996CAC]" },
  { id: "6호선", color: "bg-[#CD7C2F]" },
  { id: "7호선", color: "bg-[#747F00]" },
  { id: "8호선", color: "bg-[#E6186C]" },
  { id: "9호선", color: "bg-[#BDB092]" },
  { id: "신분당", color: "bg-[#D4003B]" },
];

export default function HomePage() {
  const supabase = createClient();
  const router = useRouter();
  
  const [ticketCount, setTicketCount] = useState<number>(0);
  const [isWaitingSubway, setIsWaitingSubway] = useState<boolean>(false);
  const [selectedLine, setSelectedLine] = useState<string>("2호선");
  const [totalBoardingCount, setTotalBoardingCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch initial data
  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth');
        return;
      }

      // Fetch tickets
      const { data: tickets } = await supabase
        .from('tickets')
        .select('amount')
        .eq('user_id', user.id)
        .single();
      if (tickets) setTicketCount(tickets.amount);

      // Fetch personal boarding status
      const { data: boarding } = await supabase
        .from('boarding_status')
        .select('is_boarding, line')
        .eq('user_id', user.id)
        .order('boarded_at', { ascending: false })
        .limit(1)
        .single();

      if (boarding && boarding.is_boarding) {
        setSelectedLine(boarding.line);
      }

      // Initial total boarding count (today)
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

  // Realtime subscription for total boarding count
  useEffect(() => {
    const channel = supabase.channel('boarding-count')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'boarding_status' }, () => {
        // Re-fetch today count when new boarding starts
        const today = new Date().toISOString().split("T")[0];
        supabase.from('boarding_status').select('*', { count: 'exact', head: true }).gte('boarded_at', `${today}T00:00:00.000Z`)
          .then(({ count }) => setTotalBoardingCount(count || 0));
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleBoardToggle = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 로딩 화면 전환
    setIsWaitingSubway(true);

    // 하차 상태 모두 탑승 종료 처리 후 새로 탑승
    await supabase.from('boarding_status').update({ is_boarding: false, alighted_at: new Date().toISOString() }).eq('user_id', user.id).eq('is_boarding', true);

    const { error } = await supabase
      .from('boarding_status')
      .insert({
        user_id: user.id,
        is_boarding: true,
        line: selectedLine, // 기본값 2호선
        boarded_at: new Date().toISOString()
      });

    if (error) {
      toast.error("탑승 처리에 실패했습니다.");
      setIsWaitingSubway(false);
      return;
    }

    // 3초 대기 후 매칭 화면으로 이동
    setTimeout(() => {
      router.push('/match');
    }, 3000);
  };

  if (isLoading) return <div className="min-h-screen bg-base" />;

  return (
    <div className="relative flex flex-col h-screen bg-base">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white/70 backdrop-blur-md z-40">
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
          설레철
        </h1>
        <div className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-full font-bold text-text-primary border border-border-default">
          <TicketIcon className="w-5 h-5 text-primary" />
          <span>{ticketCount}</span>
        </div>
      </header>

      {/* Main Area */}
      <main className="flex-1 flex flex-col items-center justify-center -mt-10 overflow-y-auto pb-24">
        
        {isWaitingSubway ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center w-full h-full space-y-8">
            <div className="relative flex items-center justify-center w-48 h-48">
              <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} className="absolute w-full h-full rounded-full bg-primary/20 pointer-events-none" />
              <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-primary to-primary-light flex flex-col items-center justify-center text-white shadow-xl">
                <span className="text-4xl mb-1">🚇</span>
              </div>
            </div>
            <div className="text-center">
               <h2 className="text-2xl font-extrabold text-text-primary animate-pulse">지하철 기다리는 중...</h2>
               <p className="text-text-secondary font-semibold mt-2">나의 운명을 만날 준비를 하고 있어요</p>
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center w-full space-y-10">
            
            {/* Inactive Big Button */}
            <button onClick={handleBoardToggle} className="group relative flex items-center justify-center w-56 h-56 transition-transform active:scale-95 z-10 mt-6">
              <div className="absolute w-full h-full rounded-full border-4 border-dashed border-primary/40 animate-[spin_10s_linear_infinite]" />
              <div className="w-44 h-44 rounded-full bg-white shadow-xl flex flex-col items-center justify-center text-primary border-2 border-border-default group-hover:border-primary transition-colors">
                <span className="text-5xl mb-2 grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all">🚇</span>
                <span className="font-extrabold text-[17px]">탑승 시작하기</span>
              </div>
            </button>

            {/* Live Count */}
            <div className="flex flex-col items-center bg-white border border-border-default px-6 py-4 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] mt-8">
              <span className="text-sm font-semibold text-text-secondary mb-1">오늘 하루, 대중교통 안에서</span>
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <p className="text-lg font-bold text-text-primary">
                  <span className="text-primary text-xl font-extrabold mr-1">{totalBoardingCount}</span>명이 설레는 중
                </p>
              </div>
            </div>

          </motion.div>
        )}

      </main>

      {/* Bottom Navigation */}
      <BottomNav />
      {/* 
        Tailwind class for hide-scrollbar (requires custom css if not built-in, 
        fallback applied via tailwind utilities inside global css usually.
        We'll just add inline style below or let browser default if scrollbar shows slightly 
      */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
