"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BottomNav } from "@/components/layout/BottomNav";
import { TicketStoreDrawer } from "@/components/ui/TicketStoreDrawer";
import { TicketIcon } from "@/components/ui/TicketIcon";
import { Button } from "@/components/ui/Button";

type UserProfile = {
  nickname: string;
  age: number;
  mbti: string;
  bio: string;
  quiz_answers: Record<string, string>;
  regular_boarding_times: string[];
  kakao_id: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tickets, setTickets] = useState(0);
  const [stats, setStats] = useState({ todayChats: 0, totalExchanges: 0 });
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth");
        return;
      }
      setUser(user);

      const [profRes, tickRes, chatsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("tickets").select("amount").eq("user_id", user.id).single(),
        supabase.from("chats").select("status, started_at, user_a, user_b").or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      ]);

      if (profRes.data) setProfile(profRes.data);
      if (tickRes.data) setTickets(tickRes.data.amount);

      if (chatsRes.data) {
        const today = new Date().toISOString().split("T")[0];
        const todayChats = chatsRes.data.filter(c => c.started_at.startsWith(today)).length;
        const totalExchanges = chatsRes.data.filter(c => c.status === "kakao_exchanged").length;
        setStats({ todayChats, totalExchanges });
      }

      setIsLoading(false);
    }
    loadData();
  }, [router, supabase]);

  if (isLoading || !profile) {
    return <div className="h-screen bg-base flex flex-col items-center justify-center text-text-muted">Loading profile...</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-base overflow-hidden relative max-w-[430px] mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white/70 backdrop-blur-md shrink-0 border-b border-border-default z-10">
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
          내 프로필
        </h1>
        <button 
          onClick={() => router.push("/profile/edit")}
          className="text-sm font-bold text-primary bg-primary/10 px-4 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
        >
          수정하기
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-24 p-5 space-y-6">
        {/* Profile Card */}
        <div className="bg-surface border border-border-default rounded-3xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full pointer-events-none" />
          
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-3xl font-extrabold text-text-primary">{profile.nickname}</h2>
            <span className="text-lg font-semibold text-text-secondary">{profile.age}세</span>
          </div>
          <div className="inline-block px-2.5 py-1 bg-primary text-white font-black text-xs rounded-lg mb-4 shadow-sm">
            {profile.mbti}
          </div>
          <p className="text-[15px] font-medium text-text-secondary whitespace-pre-wrap leading-relaxed">
            "{profile.bio || "설레는 마음으로 지하철을 타요!"}"
          </p>
          {profile.kakao_id && (
            <div className="mt-4 pt-4 border-t border-border-default/50 flex items-center gap-2">
               <span className="text-xs font-bold text-text-muted uppercase">Kakao</span>
               <span className="text-sm font-semibold text-text-primary bg-white px-2 py-0.5 rounded-md border border-border-default">{profile.kakao_id}</span>
            </div>
          )}
        </div>

        {/* Tickets Section */}
        <div className="bg-white border text-center border-border-default rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-center gap-2">
             <TicketIcon className="w-8 h-8 text-primary" />
             <span className="text-3xl font-extrabold text-text-primary">{tickets}</span>
             <span className="text-lg font-bold text-text-secondary mt-1">장</span>
          </div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">잔여 티켓 (Remaining)</p>
          <Button onClick={() => setIsStoreOpen(true)} className="w-full bg-ticket text-white font-bold h-12 shadow-sm">
            티켓 충전소 열기
          </Button>
        </div>

        {/* Stats Section */}
        <div className="flex gap-3">
          <div className="flex-1 bg-surface border border-border-default rounded-2xl p-4 flex flex-col items-center justify-center gap-1">
             <span className="text-2xl font-black text-primary">{stats.todayChats}</span>
             <span className="text-xs font-bold text-text-secondary">오늘 열린 채팅</span>
          </div>
          <div className="flex-1 bg-surface border border-border-default rounded-2xl p-4 flex flex-col items-center justify-center gap-1">
             <span className="text-2xl font-black text-green-600">{stats.totalExchanges}</span>
             <span className="text-xs font-bold text-text-secondary">성사된 인연</span>
          </div>
        </div>

        {/* Quiz Section */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest pl-1">My Subway Style</h3>
          <div className="flex flex-wrap gap-2">
            {profile.quiz_answers && Object.entries(profile.quiz_answers).map(([q, a], i) => {
              // Extract a short keyword if possible
              let keyword = q;
              if (q.includes("에스컬레이터")) keyword = "에스컬레이터";
              else if (q.includes("빈자리")) keyword = "빈자리 캐치";
              else if (q.includes("지하철 안에서")) keyword = "탑승 중엔";
              else if (q.includes("문이 닫히려고")) keyword = "문 닫힐 땐";
              else if (q.includes("좌석 위치")) keyword = "선호 좌석";

              return (
                <div key={i} className="bg-muted text-text-secondary px-3 py-1.5 rounded-full text-[13px] font-bold border border-border-default/50 flex gap-2 items-center">
                   <span className="opacity-50">•</span>
                   <span className="font-semibold">{keyword}</span>
                   <span className="opacity-30">|</span>
                   <span className="text-text-primary">{a}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Schedule Section */}
        <div className="space-y-3 pb-8">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest pl-1">My Boarding routine</h3>
          {profile.regular_boarding_times && profile.regular_boarding_times.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {profile.regular_boarding_times.map((time, idx) => (
                <span key={idx} className="bg-ticket-light border border-ticket text-ticket font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm">
                  ⏰ {time}
                </span>
              ))}
            </div>
          ) : (
            <div className="bg-surface border border-border-default rounded-xl p-4 text-center">
               <span className="font-semibold text-text-secondary text-sm">🕰️ 유동적인 시간대의 무법자</span>
            </div>
          )}
        </div>

      </main>

      <TicketStoreDrawer isOpen={isStoreOpen} onClose={() => setIsStoreOpen(false)} userId={user?.id} onSuccess={(amt) => setTickets(amt)} />
      <BottomNav />
    </div>
  );
}
