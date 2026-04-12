"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { TicketStoreDrawer } from "@/components/ui/TicketStoreDrawer";
import { Button } from "@/components/ui/Button";

type Message = { id: string; sender_id: string; content: string; created_at: string };
type ChatOptions = { 
  status: string; 
  guaranteed_until: string; 
  opponent: any;
  user_a: string;
};

export default function ChatRoomPage() {
  const { chatId } = useParams();
  const router = useRouter();
  const supabase = createClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [chatInfo, setChatInfo] = useState<ChatOptions | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [dailyQuestion, setDailyQuestion] = useState("오늘 대중교통에서 본 가장 신기한 것은?");
  
  // States related to logic
  const [isWindingDown, setIsWindingDown] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 mins in seconds
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [myTickets, setMyTickets] = useState(0);
  const [showKakaoModal, setShowKakaoModal] = useState(false);
  const [kakaoInput, setKakaoInput] = useState("");

  useEffect(() => {
    async function loadChat() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push("/auth");
      setCurrentUser(user);

      // fetch chat info
      const { data: chat } = await supabase.from("chats").select("*").eq("id", chatId).single();
      if (!chat) return router.push("/home");
      
      const opponentId = chat.user_a === user.id ? chat.user_b : chat.user_a;
      
      // fetch opponent profile & boarding status
      const { data: opponent } = await supabase.from("profiles").select("*").eq("id", opponentId).single();
      const { data: opBoarding } = await supabase.from("boarding_status").select("*").eq("user_id", opponentId).order("boarded_at", { ascending: false }).limit(1).single();

      setChatInfo({ 
        status: chat.status, 
        guaranteed_until: chat.guaranteed_until, 
        opponent: { ...opponent, is_boarding: opBoarding?.is_boarding, line: opBoarding?.line, kakao_id: null },
        user_a: chat.user_a
      });

      if (chat.status === 'kakao_exchanged') {
         // Fetch revealed kakao ID from secure API
         const rev = await fetch('/api/kakao/reveal', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ chatId })
         });
         const revData = await rev.json();
         if (rev.ok) {
           setChatInfo(prev => prev ? { ...prev, opponent: { ...prev.opponent, kakao_id: revData.kakao_id } } : null);
         }
      }

      // fetch messages
      const { data: msgs } = await supabase.from("messages").select("*").eq("chat_id", chatId).order("created_at", { ascending: true });
      if (msgs) {
        setMessages(msgs);
        // Mark opponent messages as read
        await supabase.from("messages").update({ is_read: true }).eq("chat_id", chatId).neq("sender_id", user.id).eq("is_read", false);
      }

      // fetch daily question
      const { data: dq } = await supabase.from("daily_questions").select("question").eq("ask_date", new Date().toISOString().split("T")[0]).single();
      if (dq) setDailyQuestion(dq.question);

      // fetch my tickets
      const { data: tData } = await supabase.from("tickets").select("amount").eq("user_id", user.id).single();
      if (tData) setMyTickets(tData.amount);

      // Realtime subscription for messages
      const channel = supabase.channel(`chat_${chatId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` }, (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
          setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chats", filter: `id=eq.${chatId}` }, (payload) => {
          setChatInfo(prev => prev ? { ...prev, status: payload.new.status } : null);
        })
        .subscribe();

      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "auto" }), 200);

      return () => { supabase.removeChannel(channel); };
    }
    loadChat();
  }, [chatId]);

  // Timer checking logic (Winding Down)
  useEffect(() => {
    if (!chatInfo || chatInfo.status === "ended" || chatInfo.status === "kakao_exchanged") return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const guaranteedTime = new Date(chatInfo.guaranteed_until).getTime();

      // 보장 20분 초과 & 상대방 하차 시 5분 타이머 발동
      if (now > guaranteedTime && !chatInfo.opponent.is_boarding && !isWindingDown) {
        setIsWindingDown(true);
        // 타이머 기준점을 5분(300초)으로 설정 후 DB 업데이트 가능 (간단히 클라이언트 기준 처리)
      }

      if (isWindingDown) {
        setTimeLeft(prev => {
          if (prev <= 1) {
            // 종료
            supabase.from("chats").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", chatId);
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [chatInfo, isWindingDown]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || chatInfo?.status === "ended") return;
    
    const msg = inputVal;
    setInputVal("");
    
    await supabase.from("messages").insert({
      chat_id: chatId,
      sender_id: currentUser.id,
      content: msg
    });
  };

  const handleKakaoExchangeClick = async () => {
    if (chatInfo?.status === "ended") return toast.error("종료된 채팅입니다.");
    
    if (myTickets < 2) {
      toast.error("잔여 티켓이 부족합니다.");
      setIsStoreOpen(true);
      return;
    }

    // 내 카카오톡 ID가 있는지 확인
    const { data: prof } = await supabase.from("kakao_ids").select("kakao_id").eq("user_id", currentUser.id).single();
    if (!prof?.kakao_id) {
      setShowKakaoModal(true);
      return;
    }

    executeExchange();
  };

  const executeExchange = async () => {
    try {
      const res = await fetch("/api/tickets/deduct-kakao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId })
      });
      
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "티켓 차감 실패");
        return;
      }

      setMyTickets(prev => prev - 2);
      
      const opponentKakao = chatInfo?.user_a === currentUser.id ? data.user_b_kakao : data.user_a_kakao;
      setChatInfo(prev => prev ? { ...prev, status: "kakao_exchanged", opponent: { ...prev.opponent, kakao_id: opponentKakao } } : null);
      
      toast.success("상대방과 아이디 교환에 성공했습니다! 🎉");
      setShowKakaoModal(false);
    } catch (e) {
      toast.error("오류가 발생했습니다.");
    }
  };

  if (!currentUser || !chatInfo) return <div className="h-screen bg-base" />;

  const isExchanged = chatInfo.status === "kakao_exchanged";
  const isEnded = chatInfo.status === "ended";

  return (
    <div className="flex flex-col h-screen bg-surface relative overflow-hidden max-w-[430px] mx-auto">
      {/* Header */}
      <header className="flex items-center px-4 py-3 bg-white border-b border-border-default z-10 shrink-0">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-text-secondary">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1 flex flex-col items-center">
          <div className="flex items-center gap-1.5">
            <h2 className="font-extrabold text-base text-text-primary">{chatInfo.opponent.nickname}</h2>
            <span className="px-1.5 py-0.5 bg-primary/10 text-primary font-black text-[10px] rounded-md">{chatInfo.opponent.mbti}</span>
          </div>
          {chatInfo.opponent.is_boarding ? (
            <span className="text-green-600 text-xs font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> {chatInfo.opponent.line} 탑승 중
            </span>
          ) : (
             <span className="text-text-muted text-xs font-semibold">지하철 하차 완료</span>
          )}
        </div>
        <button className="p-2 -mr-2 text-text-muted">
           {/* More dots icon */}
           <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
        </button>
      </header>

      {/* Daily Question Bar */}
      <div className="bg-primary/5 border-b border-primary/10 px-4 py-2.5 flex items-center gap-2 shrink-0">
         <span className="text-lg">💬</span>
         <div>
            <p className="text-[10px] font-black text-primary-dark">오늘의 공통 질문</p>
            <p className="text-[13px] font-bold text-text-primary">{dailyQuestion}</p>
         </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-10">
        {messages.map((m, idx) => {
          const isMe = m.sender_id === currentUser.id;
          return (
            <div key={m.id} className={cn("flex w-full", isMe ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[70%] px-4 py-2.5 rounded-2xl text-[14px]",
                isMe ? "bg-primary text-white rounded-tr-sm" : "bg-white border border-border-default text-text-primary rounded-tl-sm shadow-sm"
              )}>
                {m.content}
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* Winding Down Banner */}
      <AnimatePresence>
        {isWindingDown && !isExchanged && !isEnded && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: 50, opacity: 0 }}
            className="absolute bottom-20 left-4 right-4 bg-[#FF453A]/10 border border-[#FF453A]/30 backdrop-blur-md p-4 rounded-2xl shadow-lg z-20 flex flex-col items-center gap-3"
          >
            <div className="text-center w-full flex justify-between items-center">
               <p className="text-[#FF453A] font-extrabold text-[15px]">⏳ 5분 뒤 채팅이 종료됩니다!</p>
               <span className="bg-[#FF453A] text-white font-mono font-bold px-2 py-1 rounded-md text-sm shadow-sm">
                 {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
               </span>
            </div>
            <p className="text-xs font-semibold text-[#8E8E93]">상대방이 하차하여 대화 보장 시간이 끝났어요.<br/>계속 연락하고 싶다면 아이디를 교환해 보세요!</p>
            <Button onClick={handleKakaoExchangeClick} className="w-full bg-[#FF453A] hover:bg-[#FF3B30] h-12 text-[15px]">
              카톡 아이디 교환 (🎫 2)
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="bg-white border-t border-border-default px-4 py-3 shrink-0 pb-safe pb-4 relative z-30">
        {isEnded ? (
          <div className="text-center py-4 bg-muted text-text-muted font-bold rounded-xl border border-border-default/50 shadow-sm">
            This chat has ended. (종료된 채팅입니다)
          </div>
        ) : isExchanged ? (
          <div className="bg-ticket-light border border-ticket rounded-xl p-4 text-center shadow-sm space-y-2">
            <span className="text-xs font-black text-ticket-dark uppercase tracking-wide block">You exchanged KakaoTalk 🎫</span>
            <span className="font-extrabold text-lg text-text-primary bg-white px-4 py-2 rounded-lg shadow-sm border border-ticket/30 block mx-auto w-fit">
              상대방 카톡: {chatInfo.opponent.kakao_id || "알 수 없음"}
            </span>
            <Button className="w-full mt-2 h-11 text-sm shadow-sm" onClick={() => window.open(`kakaotalk://search?q=${chatInfo.opponent.kakao_id}`)}>
              Open KakaoTalk (카카오톡 열기)
            </Button>
          </div>
        ) : (
          <form onSubmit={sendMessage} className="flex gap-2 items-end">
            <button type="button" onClick={handleKakaoExchangeClick} className="pb-1 text-primary p-2 bg-primary/5 rounded-full hover:bg-primary/10 transition shrink-0">
               <TicketIcon className="w-6 h-6 " />
            </button>
            <div className="flex-1 bg-surface border border-border-default rounded-2xl flex items-center px-4 py-1 min-h-[44px]">
              <input
                type="text"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                placeholder="메시지를 입력하세요..."
                className="w-full bg-transparent outline-none text-[15px]"
              />
            </div>
            <button 
              type="submit" 
              disabled={!inputVal.trim()}
              className="bg-primary text-white p-3 rounded-full disabled:opacity-50 disabled:bg-gray-300 transition-colors shrink-0"
            >
              <svg className="w-5 h-5 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </form>
        )}
      </div>

      {/* Kakao ID Input Modal (For Requester) */}
      <AnimatePresence>
        {showKakaoModal && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 z-[60] flex items-center justify-center p-6">
             <motion.div className="bg-white rounded-2xl w-full p-6 shadow-2xl relative" initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
                <h3 className="text-xl font-bold mb-2">카카오톡 ID 등록</h3>
                <p className="text-sm text-text-secondary mb-4">안전한 아이디 교환을 위해 본인의 카톡 ID를 먼저 등록해야 합니다.</p>
                <input 
                  type="text" value={kakaoInput} onChange={e => setKakaoInput(e.target.value)} 
                  placeholder="카카오톡 ID 입력" 
                  className="w-full p-3 border border-border-default rounded-xl bg-surface mb-4 outline-primary"
                />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowKakaoModal(false)} className="flex-1">취소</Button>
                  <Button 
                    className="flex-1"
                    onClick={async () => {
                      if (!kakaoInput.trim()) return toast.error("아이디를 입력해주세요.");
                      
                      // 1. Check if profile has kakao_ids entry, if not create, else update
                      const { data: ext } = await supabase.from('kakao_ids').select('kakao_id').eq('user_id', currentUser.id).single();
                      if (ext) {
                        await supabase.from("kakao_ids").update({ kakao_id: kakaoInput }).eq("user_id", currentUser.id);
                      } else {
                        await supabase.from("kakao_ids").insert({ user_id: currentUser.id, kakao_id: kakaoInput });
                      }
                      
                      executeExchange(); // Proceed with ticket deduction & exchange
                    }}
                  >
                    등록 및 티켓 사용
                  </Button>
                </div>
             </motion.div>
           </motion.div>
        )}
      </AnimatePresence>

      <TicketStoreDrawer 
        isOpen={isStoreOpen} 
        onClose={() => setIsStoreOpen(false)} 
        userId={currentUser?.id} 
        onSuccess={(amt) => setMyTickets(amt)} 
      />
    </div>
  );
}
