"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type ChatItem = {
  id: string;
  status: string;
  started_at: string;
  guaranteed_until: string;
  ended_at: string;
  opponent: { id: string; nickname: string; mbti: string; is_boarding: boolean };
  lastMessage: string | null;
  lastMessageTime: string | null;
  unreadCount: number;
};

type RequestItem = {
  id: string;
  requester_id: string;
  target_id: string;
  status: string;
  schedule_options: any;
  confirmed_time: string | null;
  created_at: string;
  opponent: { id: string; nickname: string; mbti: string; is_boarding: boolean };
  amIRequester: boolean;
};

// Reusing same timeSlots from match logic for bottom sheet
const timeSlots = {
  "아침 (Morning)": ["07:00~07:59", "08:00~08:59", "09:00~09:59", "10:00~10:59", "11:00~11:59"],
  "오후 (Afternoon)": ["12:00~12:59", "13:00~13:59", "14:00~14:59", "15:00~15:59", "16:00~16:59"],
  "저녁 (Evening)": ["17:00~17:59", "18:00~18:59", "19:00~19:59", "20:00~20:59"]
};

export default function ChatListPage() {
  const router = useRouter();
  const supabase = createClient();
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const [activeTab, setActiveTab] = useState<"Active" | "Ended" | "Requests">("Active");
  const [activeChats, setActiveChats] = useState<ChatItem[]>([]);
  const [endedChats, setEndedChats] = useState<ChatItem[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // BottomSheet variables for Schedule Proposal
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<RequestItem | null>(null);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);

  useEffect(() => {
    async function loadAll() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push("/auth");
      setCurrentUser(user);

      // Fetch profiles to map opponent data
      const { data: profData } = await supabase.from('profiles').select('id, nickname, mbti');
      const { data: bsData } = await supabase.from('boarding_status').select('user_id, is_boarding').order('boarded_at', { ascending: false });
      
      const getOpponentInfo = (opponentId: string) => {
        const p = profData?.find(x => x.id === opponentId);
        const b = bsData?.find(x => x.user_id === opponentId);
        return { 
          id: opponentId, 
          nickname: p?.nickname || "알 수 없음", 
          mbti: p?.mbti || "   ",
          is_boarding: b?.is_boarding || false
        };
      };

      // 1. Fetch Chats & Messages
      const { data: chatsData } = await supabase
        .from('chats')
        .select(`*, messages(content, created_at, sender_id, is_read)`)
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order('started_at', { ascending: false });

      const aChats: ChatItem[] = [];
      const eChats: ChatItem[] = [];

      if (chatsData) {
        chatsData.forEach(c => {
          const m = c.messages || [];
          m.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          
          const opponentId = c.user_a === user.id ? c.user_b : c.user_a;
          const unreadCount = m.filter(x => x.sender_id === opponentId && !x.is_read).length;
          
          const item: ChatItem = {
            id: c.id,
            status: c.status,
            started_at: c.started_at,
            guaranteed_until: c.guaranteed_until,
            ended_at: c.ended_at,
            opponent: getOpponentInfo(opponentId),
            lastMessage: m.length > 0 ? m[0].content : null,
            lastMessageTime: m.length > 0 ? m[0].created_at : null,
            unreadCount
          };

          if (["active", "winding_down"].includes(c.status)) aChats.push(item);
          else eChats.push(item);
        });
      }
      
      setActiveChats(aChats);
      setEndedChats(eChats);

      // 2. Fetch Chat Requests
      const { data: reqData } = await supabase
        .from('chat_requests')
        .select('*')
        .or(`requester_id.eq.${user.id},target_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (reqData) {
        const mappedReqs = reqData.map(r => ({
          ...r,
          amIRequester: r.requester_id === user.id,
          opponent: getOpponentInfo(r.requester_id === user.id ? r.target_id : r.requester_id)
        })) as RequestItem[];
        setRequests(mappedReqs);
      }

      setIsLoading(false);
    }
    loadAll();
  }, [supabase, router]);

  const updateRequestStatus = async (reqId: string, newStatus: string, confirmedTime: string | null = null) => {
    if (newStatus === 'accepted') {
      try {
        const res = await fetch("/api/tickets/deduct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: reqId }),
        });
        const data = await res.json();
        
        if (!res.ok) {
           toast.error(data.error || "티켓 차감 및 대화방 생성 실패");
           return;
        }

        toast.success("상대방과 대화방이 생성되었습니다! 🎉");
        // Remove from requests view or update status
        setRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'connected' } : r));
        router.push(`/chat/${data.chatId}`); // Redirect directly to new chat
      } catch (e) {
        toast.error("통신 오류가 발생했습니다.");
      }
      return;
    }

    const { error } = await supabase.from('chat_requests').update({ status: newStatus, confirmed_time: confirmedTime }).eq('id', reqId);
    if (!error) {
       setRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: newStatus, confirmed_time: confirmedTime } : r));
       if (newStatus === 'declined') {
          toast.success("요청을 정중히 거절했습니다.");
       } else if (newStatus === 'scheduled') {
          toast.success("약속이 즐겁게 확정되었습니다!");
       }
    }
  };

  const submitProposal = async () => {
    if (!selectedReq) return;
    if (selectedDates.length === 0 || selectedTimes.length === 0) return toast.error("제안할 날짜와 시간을 선택해주세요.");
    
    // 상대방에게 시간 제안 업데이트 (역제안도 본질적으론 옵션 덮어씌움)
    const { error } = await supabase.from('chat_requests').update({
       schedule_options: { dates: selectedDates, times: selectedTimes },
       status: 'pending' // 다시 펜딩으로 (상대방이 수락 대기)
       // 로직 단순화를 위해 서로 상태 교환을 amIRequester 기준으로 바꾼다 생각 (실제론 복잡하지만 우선 펜딩)
    }).eq('id', selectedReq.id);

    if (error) { toast.error("오류 발생"); return; }
    
    toast.success("나의 제안 시간을 보냈습니다.");
    setRequests(prev => prev.map(r => r.id === selectedReq.id ? { ...r, schedule_options: { dates: selectedDates, times: selectedTimes }, status: "pending" } : r));
    setSheetOpen(false);
  };

  const getFormatTime = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  return (
    <div className="relative flex flex-col h-screen bg-base overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 bg-white/80 backdrop-blur-md shrink-0 border-b border-border-default z-10 font-sans">
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">My Chats</h1>
      </header>

      {/* Tabs */}
      <div className="flex bg-surface px-4 shadow-sm z-0">
        {(["Active", "Ended", "Requests"] as const).map(tab => {
          let badgeCnt = 0;
          if (tab === "Active") badgeCnt = activeChats.reduce((acc, c) => acc + c.unreadCount, 0);
          if (tab === "Requests") badgeCnt = requests.filter(r => !r.amIRequester && r.status === 'pending').length;

          return (
            <button key={tab} onClick={() => setActiveTab(tab)} className="flex-1 relative py-4 font-bold text-[14px]">
              <span className={cn(activeTab === tab ? "text-primary" : "text-text-muted")}>
                {tab}
                {badgeCnt > 0 && <span className="absolute ml-1.5 -top-0.5 bg-danger text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{badgeCnt}</span>}
              </span>
              {activeTab === tab && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />}
            </button>
          )
        })}
      </div>

      <main className="flex-1 overflow-y-auto pb-24 p-4">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-text-muted font-bold">로딩 중...</div>
        ) : (
          <div className="space-y-4">
            
            {/* ACTIVE TAB */}
            {activeTab === "Active" && (
              activeChats.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4 mt-24 opacity-80">
                   <div className="text-6xl grayscale opacity-50">🚇</div>
                   <div>
                      <p className="font-extrabold text-text-primary text-lg">진행 중인 대화가 없어요</p>
                      <p className="text-sm font-semibold text-text-muted mt-1">지하철에 탑승해서 반갑게 인사해 보세요</p>
                   </div>
                   <Button onClick={() => router.push('/match')} className="h-12 w-48 shadow-md">매칭하러 가기</Button>
                </div>
              ) : (
                activeChats.map(chat => {
                  const now = new Date().getTime();
                  const endT = new Date(chat.guaranteed_until).getTime();
                  const isWinding = now > endT && !chat.opponent.is_boarding;
                  
                  return (
                    <div key={chat.id} onClick={() => router.push(`/chat/${chat.id}`)} className="bg-surface border border-border-default rounded-[16px] p-4 flex gap-4 cursor-pointer hover:bg-white transition-colors overflow-hidden">
                      {/* Avatar */}
                      <div className="w-14 h-14 bg-primary-light text-primary-dark font-black text-xl rounded-full flex items-center justify-center shrink-0">
                        {chat.opponent.nickname.charAt(0)}
                      </div>
                      <div className="flex-1 flex flex-col justify-center min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="font-extrabold text-text-primary truncate mr-2">{chat.opponent.nickname}</span>
                          <span className="text-muted text-xs whitespace-nowrap">{getFormatTime(chat.lastMessageTime)}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="px-1.5 py-0.5 bg-primary/10 text-primary font-black text-[10px] rounded-md">{chat.opponent.mbti}</span>
                          <span className="text-text-secondary text-sm truncate">{chat.lastMessage || "메시지가 없습니다."}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-bold">
                           <div className="flex items-center gap-1.5">
                             {isWinding ? (
                               <><span className="w-2 h-2 rounded-full bg-coral-500 animate-pulse bg-[#D97B6C]"/> <span className="text-[#D97B6C] font-semibold">종료 임박 (5분 남음)</span></>
                             ) : chat.opponent.is_boarding ? (
                               <><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/> <span className="text-green-700 font-semibold">현재 탑승 중 (대화)</span></>
                             ) : (
                               <><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"/> <span className="text-amber-700 font-semibold">상대 하차 (보장 시간 적용)</span></>
                             )}
                           </div>
                           {chat.unreadCount > 0 && (
                             <span className="bg-primary text-white text-[10px] px-1.5 py-[2px] rounded-full min-w-[20px] text-center">{chat.unreadCount}</span>
                           )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            )}

            {/* ENDED TAB */}
            {activeTab === "Ended" && (
              endedChats.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-3 mt-24 opacity-80">
                   <div className="text-6xl grayscale opacity-50">💌</div>
                   <p className="font-extrabold text-text-primary text-lg">아직 과거 대화록이 없네요.</p>
                   <p className="text-sm font-semibold text-text-muted mt-1">지하철에서의 인연들이 이곳에 기록됩니다.</p>
                </div>
              ) : (
                endedChats.map(chat => (
                  <div key={chat.id} onClick={() => router.push(`/chat/${chat.id}`)} className="bg-surface border border-border-default rounded-[16px] p-4 flex gap-4 cursor-pointer hover:bg-white transition-colors opacity-90 grayscale-[0.2]">
                      <div className="w-14 h-14 bg-gray-200 text-gray-500 font-black text-xl rounded-full flex items-center justify-center shrink-0 border border-gray-300">
                        {chat.opponent.nickname.charAt(0)}
                      </div>
                      <div className="flex-1 flex flex-col justify-center min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="font-extrabold text-text-primary truncate mr-2">{chat.opponent.nickname}</span>
                          <span className="text-muted text-[11px] whitespace-nowrap">{chat.started_at?.split('T')[0]}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-text-secondary text-sm truncate opacity-70">{chat.lastMessage || "메시지가 텅 비었네요"}</span>
                        </div>
                        {chat.status === "kakao_exchanged" ? (
                           <span className="w-fit bg-ticket-light text-ticket px-2 py-1 rounded-md text-[10px] font-black tracking-widest flex items-center gap-1">
                             <span className="text-xs">🎫</span> KAKAO EXCHANGED
                           </span>
                        ) : (
                           <span className="w-fit bg-gray-200 text-gray-500 px-2 py-1 rounded-md text-[10px] font-bold">
                             대화 종료됨
                           </span>
                        )}
                      </div>
                  </div>
                ))
              )
            )}

            {/* REQUESTS TAB */}
            {activeTab === "Requests" && (
              requests.length === 0 ? (
                <div className="text-center text-text-muted font-bold mt-20">요청 내역이 없습니다.</div>
              ) : (
                requests.map(req => (
                  <div key={req.id} className="bg-surface border border-border-default rounded-[16px] p-5 space-y-3">
                     <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-lg text-text-primary">{req.opponent?.nickname || "알 수 없음"}</span>
                          <span className="px-1.5 py-0.5 bg-primary/10 text-primary font-black text-[10px] rounded-md">{req.opponent?.mbti}</span>
                        </div>
                        {req.status === 'scheduled' ? (
                           <span className="bg-primary-light text-primary-dark font-black text-xs px-2 py-1 rounded-md">약속 확정됨</span>
                        ) : req.status === 'pending' ? (
                           <span className="bg-warning/20 text-warning font-black text-xs px-2 py-1 rounded-md">일정 조율 대기</span>
                        ) : (
                           <span className="bg-gray-200 text-gray-500 font-black text-xs px-2 py-1 rounded-md">거절됨</span>
                        )}
                     </div>

                     <div className="bg-white p-3 rounded-xl border border-border-default/50 space-y-1">
                        <p className="text-xs font-bold text-text-secondary mb-1">상대방의 희망 시간대</p>
                        {req.schedule_options ? (
                           <p className="text-sm font-semibold text-text-primary text-balance">
                             {req.schedule_options.dates?.join(', ')}<br/>{req.schedule_options.times?.join(', ')}
                           </p>
                        ) : <p className="text-sm font-semibold text-text-primary text-balance">즉시 대화(지금 탑승 중) 요청</p>}
                        
                        {req.status === 'scheduled' && (
                           <p className="text-primary font-black text-sm mt-2 border-t pt-2">🎯 확정 시간: {req.confirmed_time}</p>
                        )}
                     </div>

                     {/* Action Buttons */}
                     {req.status === 'pending' && (
                        req.amIRequester ? (
                          <div className="flex justify-between items-center text-sm pt-1">
                             <span className="text-text-muted font-bold">답변을 기다리고 있어요...</span>
                             <button onClick={() => updateRequestStatus(req.id, 'cancelled')} className="text-danger font-bold opacity-80 hover:opacity-100">요청 취소</button>
                          </div>
                        ) : (
                           <div className="flex gap-2">
                              {!req.schedule_options ? (
                                <>
                                 <Button variant="outline" onClick={() => updateRequestStatus(req.id, 'declined')} className="flex-1 py-3 text-sm h-11 border-border-default text-text-secondary">거절</Button>
                                 <Button onClick={() => updateRequestStatus(req.id, 'accepted')} className="flex-1 py-3 text-sm h-11 font-bold">수락 및 대화시작</Button>
                                </>
                              ) : (
                                <>
                                 {/* Pick from options randomly for demo, or let user pick. For now, open bottom sheet or auto-pick first option */}
                                 <Button variant="outline" onClick={() => { setSelectedReq(req); setSheetOpen(true); }} className="flex-[0.8] py-3 text-[13px] h-11 border-border-default text-text-secondary">새로 제안하기</Button>
                                 <Button onClick={() => updateRequestStatus(req.id, 'scheduled', `${req.schedule_options.dates[0]} ${req.schedule_options.times[0]}`)} className="flex-1 py-3 text-sm h-11 font-bold shadow-sm bg-primary text-white">이 시간으로 확정!</Button>
                                </>
                              )}
                           </div>
                        )
                     )}
                  </div>
                ))
              )
            )}
          </div>
        )}
      </main>

      <BottomNav />

      {/* Schedule Proposal BottomSheet (for Counter-Offer) */}
      <AnimatePresence>
        {sheetOpen && selectedReq && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheetOpen(false)} className="absolute inset-0 bg-black/60 z-50 backdrop-blur-sm" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="absolute bottom-0 left-0 right-0 max-w-[430px] mx-auto bg-white rounded-t-3xl z-50 shadow-2xl p-6 pb-12 flex flex-col">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
              <h3 className="text-xl font-extrabold text-text-primary text-center mb-6">나의 시간 제안하기</h3>
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="font-bold text-sm text-text-primary px-1">날짜 선택</div>
                  <div className="flex gap-2">
                    {["오늘", "내일", "모레"].map(day => (
                      <button key={day} onClick={() => setSelectedDates(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])} className={cn("flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors", selectedDates.includes(day) ? "bg-primary text-white border-primary" : "bg-white text-text-secondary border-border-default")}>{day}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3 pb-4">
                  <div className="font-bold text-sm text-text-primary px-1 mb-2">시간대 선택</div>
                  {Object.entries(timeSlots).map(([label, slots]) => (
                     <div key={label} className="space-y-2 mb-3">
                       <div className="flex flex-wrap gap-2">
                          {slots.map(s => (
                            <button key={s} onClick={() => setSelectedTimes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} className={cn("px-3 py-1.5 rounded-lg text-[13px] font-bold border transition-colors", selectedTimes.includes(s) ? "bg-primary-light text-primary-dark border-primary" : "bg-surface text-text-secondary border-border-default")}>{s.split('~')[0]}</button>
                          ))}
                       </div>
                     </div>
                  ))}
                </div>
                <Button onClick={submitProposal} className="w-full py-4 text-lg">이 시간으로 제안 수정하기</Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
