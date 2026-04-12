"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TicketIcon } from "@/components/ui/TicketIcon";
import { cn } from "@/lib/utils";

type MatchProfile = {
  id: string;
  nickname: string;
  age: number;
  mbti: string;
  bio: string;
  quiz_answers: Record<string, string>;
  regular_boarding_times: string[];
  is_boarding: boolean;
  line: string;
};

// 시간대 양식 재활용
const timeSlots = {
  "아침 (Morning)": ["07:00~07:59", "08:00~08:59", "09:00~09:59", "10:00~10:59", "11:00~11:59"],
  "오후 (Afternoon)": ["12:00~12:59", "13:00~13:59", "14:00~14:59", "15:00~15:59", "16:00~16:59"],
  "저녁 (Evening)": ["17:00~17:59", "18:00~18:59", "19:00~19:59", "20:00~20:59"]
};

export default function MatchPage() {
  const router = useRouter();
  const supabase = createClient();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [myProfile, setMyProfile] = useState<any>(null);
  
  const [matches, setMatches] = useState<MatchProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // BottomSheet State
  const [selectedTarget, setSelectedTarget] = useState<MatchProfile | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadMatches() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth');
        return;
      }
      setCurrentUser(user);

      // 본인 탑승 여부 확인
      const { data: bs } = await supabase
        .from('boarding_status')
        .select('is_boarding')
        .eq('user_id', user.id)
        .order('boarded_at', { ascending: false })
        .limit(1)
        .single();
        
      if (!bs?.is_boarding) {
        toast.error("지하철 탑승 중에만 이용할 수 있습니다.");
        router.push('/');
        return;
      }

      // 내 프로필 (나이 필터 등)
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setMyProfile(profile);

      // RPC로 매칭 후보 가져오기
      fetchCandidates(user.id, profile?.preferred_age_min || 18, profile?.preferred_age_max || 45);
    }
    loadMatches();
  }, [supabase, router]);

  const fetchCandidates = async (userId: string, minAge: number, maxAge: number) => {
    setIsLoading(true);
    try {
      const { data: rpcData, error } = await supabase.rpc('get_match_candidates', {
        caller_id: userId,
        pref_min: minAge,
        pref_max: maxAge
      });
      
      if (error) {
        console.error('RPC error:', error);
        toast.error("매칭 후보를 불러오는 데 실패했습니다.");
        setMatches([]);
      } else {
        setMatches((rpcData || []) as MatchProfile[]);
      }
    } catch (err) {
      console.error('Match fetch error:', err);
      toast.error("서버 연결에 문제가 있어요. 잠시 후 다시 시도해주세요.");
      setMatches([]);
    }
    setIsLoading(false);
  };

  const handleRefresh = async () => {
    if (!myProfile) return;
    const safeRefreshCount = myProfile.refresh_count ?? 0;
    if (safeRefreshCount >= 3) {
      toast.error("오늘의 새로고침 횟수(3회)를 모두 사용했습니다.");
      return;
    }
    
    // Refresh 카운트 증가
    await supabase.from('profiles').update({ refresh_count: safeRefreshCount + 1 }).eq('id', currentUser.id);
    setMyProfile({ ...myProfile, refresh_count: safeRefreshCount + 1 });
    
    toast.success(`새로운 운명을 찾습니다! (남은 횟수: ${2 - safeRefreshCount}회)`);
    fetchCandidates(currentUser.id, myProfile.preferred_age_min || 18, myProfile.preferred_age_max || 45);
  };

  const handleActionClick = (target: MatchProfile) => {
    setSelectedTarget(target);
    setSelectedDates([]);
    setSelectedTimes([]);
    setIsSheetOpen(true);
  };

  const submitRequest = async () => {
    if (!selectedTarget || !currentUser) return;
    setIsSubmitting(true);

    try {
      // 티켓 보유량만 검사 (차감은 수락 시 진행된다는 기획)
      const { data: t } = await supabase.from('tickets').select('amount').eq('user_id', currentUser.id).single();
      if (!t || t.amount < 1) {
        toast.error("잔여 티켓이 부족합니다.");
        setIsSubmitting(false);
        return;
      }

      // 대상이 탑승 중이 아닐 때 스케줄 데이터 첨부
      let scheduleOptions = null;
      if (!selectedTarget.is_boarding) {
        if (selectedDates.length === 0 || selectedTimes.length === 0) {
          toast.error("만날 날짜와 시간을 1개 이상 선택해주세요.");
          setIsSubmitting(false);
          return;
        }
        scheduleOptions = { dates: selectedDates, times: selectedTimes };
      }

      // 요청 생성
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 3);

      const { error } = await supabase.from('chat_requests').insert({
        requester_id: currentUser.id,
        target_id: selectedTarget.id,
        status: 'pending',
        schedule_options: scheduleOptions,
        expires_at: expiresAt.toISOString()
      });

      if (error) throw error;

      toast.success(`${selectedTarget.nickname}님에게 요청을 보냈습니다!`, {
        action: { label: "신청 현황 보기", onClick: () => router.push('/chat') }
      });
      setIsSheetOpen(false);
      
      // 목록에서 제외
      setMatches(prev => prev.filter(m => m.id !== selectedTarget.id));
    } catch (err) {
      toast.error("요청 전송 중 오류가 발생했습니다.");
    }
    setIsSubmitting(false);
  };

  if (isLoading) return <div className="min-h-screen bg-base flex items-center justify-center">탐색 중... 📡</div>;

  return (
    <div className="relative flex flex-col h-screen bg-base overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white/70 backdrop-blur-md z-30 shadow-sm">
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
          오늘의 설렘 후보
        </h1>
        <button 
          onClick={handleRefresh}
          className="flex items-center gap-1 text-sm font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full active:scale-95 transition"
        >
          🔄 새로고침 ({3 - (myProfile?.refresh_count ?? 0)}/3)
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-5 py-6 pb-28 space-y-6">
        {matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-70 mt-20">
            <span className="text-6xl">🕳️</span>
            <div>
              <p className="font-bold text-lg text-text-primary">아직 같은 열차나 시간대에</p>
              <p className="font-bold text-lg text-text-primary">탑승한 인연이 없네요.</p>
            </div>
            <p className="text-sm text-text-muted">조금 뒤에 다시 새로고침을 돌려보세요!</p>
          </div>
        ) : (
          matches.map(profile => (
            <Card key={profile.id} className="overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-border-default/50 bg-white">
              <div className="p-5 space-y-4">
                {/* Headers */}
                <div className="flex items-center justify-between">
                  {profile.is_boarding ? (
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-black rounded-full animate-pulse border border-green-200">
                      🟢 {profile.line} 탑승 중
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-surface text-text-secondary text-xs font-bold rounded-full border border-border-default">
                      🎫 오늘 탑승 이력 있음
                    </span>
                  )}
                  <span className="px-2.5 py-1 bg-primary/10 text-primary-dark font-black text-xs rounded-lg">
                    {profile.mbti || "MBTI 미상"}
                  </span>
                </div>

                {/* Info */}
                <div>
                  <h2 className="text-xl font-extrabold text-text-primary mb-1">
                    {profile.nickname} <span className="font-medium text-text-muted text-base ml-1">{profile.age}세</span>
                  </h2>
                  <p className="text-sm font-medium text-text-secondary bg-surface p-3 rounded-xl">
                    "{profile.bio || "앗, 소개글을 적지 않은 분이에요!"}"
                  </p>
                </div>

                {/* Sub info */}
                <div className="space-y-2 pt-2 border-t border-border-default">
                  <div className="text-xs font-semibold text-text-muted">지하철 루틴</div>
                  <div className="text-[13px] font-medium text-text-secondary">
                    {profile.regular_boarding_times && Array.isArray(profile.regular_boarding_times) && profile.regular_boarding_times.length > 0
                      ? profile.regular_boarding_times.slice(0, 3).join(", ") + (profile.regular_boarding_times.length > 3 ? " 외" : "")
                      : "🕰️ 유동적인 스케줄의 소유자"}
                  </div>
                </div>

                <div className="pt-2">
                  <Button 
                    onClick={() => handleActionClick(profile)} 
                    variant={profile.is_boarding ? "primary" : "outline"} 
                    className="w-full font-bold shadow-md h-12 text-[15px]"
                  >
                    {profile.is_boarding ? "지금 인사 건네기 🎫" : "만남 스케줄 조율하기"}
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav />

      {/* Action BottomSheet */}
      <AnimatePresence>
        {isSheetOpen && selectedTarget && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsSheetOpen(false)}
              className="absolute inset-0 bg-black/60 z-50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 max-w-[430px] mx-auto bg-white rounded-t-3xl z-50 shadow-2xl p-6 flex flex-col max-h-[85vh]"
            >
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
              
              <div className="overflow-y-auto no-scrollbar pb-6 space-y-6">
                <div className="text-center space-y-1">
                  <h3 className="text-xl font-extrabold text-text-primary">
                    {selectedTarget.is_boarding ? "인사 건네기" : "약속 시간 조율하기"}
                  </h3>
                  <p className="text-sm font-medium text-text-secondary">
                    {selectedTarget.is_boarding 
                      ? "상대방과 바로 채팅방을 여는 요청을 보냅니다." 
                      : "3일 내 어느 날 언제쯤 만날지 제안해 보세요."}
                  </p>
                </div>

                {!selectedTarget.is_boarding && (
                  <div className="space-y-6">
                    {/* 날짜 선택 */}
                    <div className="space-y-3">
                      <div className="font-bold text-sm text-text-primary px-1">날짜 선택 (다중)</div>
                      <div className="flex gap-2">
                        {["오늘", "내일", "모레"].map(day => (
                          <button
                            key={day}
                            onClick={() => setSelectedDates(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
                            className={cn("flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors", selectedDates.includes(day) ? "bg-primary text-white border-primary" : "bg-white text-text-secondary border-border-default")}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* 시간 선택 */}
                    <div className="space-y-3">
                      <div className="font-bold text-sm text-text-primary px-1 mb-2">시간대 선택 (다중)</div>
                      {Object.entries(timeSlots).map(([label, slots]) => (
                         <div key={label} className="space-y-2 mb-3">
                           <div className="text-xs font-semibold text-text-muted">{label}</div>
                           <div className="flex flex-wrap gap-2">
                              {slots.map(slot => (
                                <button
                                  key={slot}
                                  onClick={() => setSelectedTimes(prev => prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot])}
                                  className={cn("px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors", selectedTimes.includes(slot) ? "bg-primary-light text-primary-dark border-primary" : "bg-surface text-text-secondary border-border-default")}
                                >
                                  {slot.split('~')[0]}
                                </button>
                              ))}
                           </div>
                         </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 겹침 프리뷰 배너 */}
                {!selectedTarget.is_boarding && selectedTarget.regular_boarding_times && selectedTarget.regular_boarding_times.length > 0 && selectedTimes.some(t => selectedTarget.regular_boarding_times.includes(t)) && (
                  <div className="p-3 bg-green-50 rounded-xl border border-green-200">
                    <p className="text-xs font-bold text-green-700 text-center">💡 앗! 상대방도 선택하신 시간대에 보통 탑승한대요!</p>
                  </div>
                )}

                <div className="pt-4 border-t border-border-default mt-4 space-y-3">
                  <div className="flex justify-between items-center px-2 text-sm">
                     <span className="font-semibold text-text-secondary">소모 티켓</span>
                     <span className="font-bold text-primary flex items-center gap-1">1 🎫 <span className="text-text-muted text-xs font-medium ml-1">(수락 시 차감)</span></span>
                  </div>
                  <Button 
                    onClick={submitRequest} 
                    isLoading={isSubmitting} 
                    className="w-full py-4 text-[16px] font-bold h-14"
                  >
                    요청 보내기
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
