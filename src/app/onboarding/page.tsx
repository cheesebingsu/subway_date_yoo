"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TicketIcon } from "@/components/ui/TicketIcon";
import { cn } from "@/lib/utils";

type OnboardingData = {
  nickname: string;
  age: number;
  mbti: string;
  bio: string;
  preferred_age_min: number;
  preferred_age_max: number;
  age_unimportant: boolean;
  quiz_answers: Record<string, string>;
  has_regular_schedule: boolean | null;
  regular_boarding_times: string[];
};

const mbtiOptions = [
  "ESTJ", "ESTP", "ENTJ", "ENTP", "ESFJ", "ESFP", "ENFJ", "ENFP",
  "ISTJ", "ISTP", "INTJ", "INTP", "ISFJ", "ISFP", "INFJ", "INFP"
];

const quizQuestions = [
  { id: "q1", text: "Q1. 에스컬레이터에서 나는:", a: "걸어 올라간다", b: "가만히 서 있는다" },
  { id: "q2", text: "Q2. 빈자리가 났을 때:", a: "무조건 앉는다", b: "한 정거장 남으면 서 있는다" },
  { id: "q3", text: "Q3. 지하철 안에서 나는 주로:", a: "이어폰 끼고 내 세상", b: "멍때리며 바깥 구경" },
  { id: "q4", text: "Q4. 문 닫히기 직전이라면:", a: "뛰어서 기어코 탄다", b: "안전하게 다음 열차를 기다린다" },
  { id: "q5", text: "Q5. 내가 선호하는 자리는:", a: "끝자리 (창가)", b: "가운데 자리" }
];

const timeSlots = {
  "아침 (Morning)": ["07:00~07:59", "08:00~08:59", "09:00~09:59", "10:00~10:59", "11:00~11:59"],
  "오후 (Afternoon)": ["12:00~12:59", "13:00~13:59", "14:00~14:59", "15:00~15:59", "16:00~16:59"],
  "저녁 (Evening)": ["17:00~17:59", "18:00~18:59", "19:00~19:59", "20:00~20:59"]
};

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const totalSteps = 5;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [data, setData] = useState<OnboardingData>({
    nickname: "",
    age: 0,
    mbti: "    ",
    bio: "",
    preferred_age_min: 20,
    preferred_age_max: 35,
    age_unimportant: false,
    quiz_answers: {},
    has_regular_schedule: null,
    regular_boarding_times: [],
  });

  const handleNext = () => {
    if (step === 1) {
      if (!data.nickname || data.nickname.length > 8) {
        toast.error("닉네임을 1~8자로 입력해주세요.");
        return;
      }
      if (!data.age || data.age < 18 || data.age > 45) {
        toast.error("나이는 18세에서 45세 사이로 입력해주세요.");
        return;
      }
      if (data.mbti.length !== 4 || data.mbti.includes(" ")) {
        toast.error("MBTI 4자리를 모두 선택해주세요.");
        return;
      }
      if (!data.bio || data.bio.length > 20) {
        toast.error("한 줄 소개를 1~20자로 입력해주세요.");
        return;
      }
    }
    if (step === 4 && data.has_regular_schedule && data.regular_boarding_times.length === 0) {
      toast.error("탑승 시간대를 최소 1개 이상 선택해주세요.");
      return;
    }
    setStep(s => s + 1);
  };

  const handleBack = () => {
    setStep(s => s - 1);
  };

  const submitProfile = async () => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("유저 정보를 찾을 수 없습니다.");

      const { error } = await supabase.from('profiles').update({
        nickname: data.nickname,
        age: data.age,
        mbti: data.mbti,
        bio: data.bio,
        preferred_age_min: data.age_unimportant ? 18 : data.preferred_age_min,
        preferred_age_max: data.age_unimportant ? 100 : data.preferred_age_max,
        quiz_answers: data.quiz_answers,
        has_regular_schedule: data.has_regular_schedule,
        regular_boarding_times: data.has_regular_schedule ? data.regular_boarding_times : [],
      }).eq('id', user.id);

      if (error) throw error;
      
      router.push('/home');
    } catch (err: any) {
      toast.error(err.message || "오류가 발생했습니다.");
      setIsSubmitting(false);
    }
  };

  const slideVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  return (
    <div className="flex flex-col h-full bg-base overflow-x-hidden">
      {/* Progress Bar & Header */}
      {step < 5 && (
        <div className="flex flex-col pt-8 px-6 pb-2">
          <div className="flex items-center justify-between mb-4">
            {step > 1 ? (
              <button onClick={handleBack} className="text-text-secondary text-sm font-semibold p-2 -ml-2">
                ← 이전
              </button>
            ) : <div className="w-10"></div>}
            <span className="text-sm font-bold text-primary">{step} / {totalSteps - 1}</span>
          </div>
          <div className="w-full bg-border-default h-1.5 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${(step / (totalSteps - 1)) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-24 relative">
        <AnimatePresence mode="wait">
          
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <motion.div key="step1" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="space-y-8">
              <h1 className="text-2xl font-bold text-text-primary">어떤 분이신지<br/>조금만 알려주세요!</h1>
              
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-secondary">닉네임</label>
                  <input type="text" maxLength={8} value={data.nickname} onChange={e => setData({...data, nickname: e.target.value})} placeholder="최대 8자 (영어/한글/숫자)" className="w-full px-4 py-3 rounded-xl border border-border-default focus:ring-2 focus:ring-primary focus:border-transparent text-text-primary bg-white"/>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-secondary">나이</label>
                  <input type="number" value={data.age || ""} onChange={e => setData({...data, age: e.target.value ? Number(e.target.value) : 0})} placeholder="본인의 나이를 숫자로 입력하세요" className="w-full px-4 py-3 rounded-xl border border-border-default focus:ring-2 focus:ring-primary focus:border-transparent text-text-primary bg-white outline-none"/>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-secondary">MBTI</label>
                  <div className="flex flex-col gap-2 pt-1">
                    <div className="grid grid-cols-4 gap-2">
                      {['E', 'S', 'T', 'J'].map((char, idx) => (
                        <button
                          key={char}
                          onClick={() => {
                            const newMbti = data.mbti.split('');
                            newMbti[idx] = char;
                            setData({...data, mbti: newMbti.join('')});
                          }}
                          className={cn("py-3 rounded-xl text-[16px] font-bold border-2 transition-colors shadow-sm", data.mbti[idx] === char ? "bg-primary text-white border-primary" : "bg-white text-text-secondary border-border-default hover:border-primary-light")}
                        >
                          {char}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {['I', 'N', 'F', 'P'].map((char, idx) => (
                        <button
                          key={char}
                          onClick={() => {
                            const newMbti = data.mbti.split('');
                            newMbti[idx] = char;
                            setData({...data, mbti: newMbti.join('')});
                          }}
                          className={cn("py-3 rounded-xl text-[16px] font-bold border-2 transition-colors shadow-sm", data.mbti[idx] === char ? "bg-primary text-white border-primary" : "bg-white text-text-secondary border-border-default hover:border-primary-light")}
                        >
                          {char}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-secondary">한 줄 소개</label>
                  <input type="text" maxLength={20} value={data.bio} onChange={e => setData({...data, bio: e.target.value})} placeholder="지하철 탈 때 주로 뭐하세요?" className="w-full px-4 py-3 rounded-xl border border-border-default focus:ring-2 focus:ring-primary focus:border-transparent text-text-primary bg-white"/>
                </div>
              </div>
              <Button onClick={handleNext} className="w-full h-14">다음으로</Button>
            </motion.div>
          )}

          {/* Step 2: Ideal Type */}
          {step === 2 && (
            <motion.div key="step2" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="space-y-8">
              <h1 className="text-2xl font-bold text-text-primary">이번엔 상대방의<br/>선호 나이대를 골라볼까요?</h1>
              
              <div className="space-y-6">
                {!data.age_unimportant && (
                  <div className="flex items-center gap-4 bg-white p-6 rounded-2xl border border-border-default">
                    <select value={data.preferred_age_min} onChange={e => setData({...data, preferred_age_min: Number(e.target.value)})} className="flex-1 py-2 text-center text-lg font-bold border-b-2 border-primary focus:outline-none bg-transparent">
                      {Array.from({length: 45 - 18 + 1}, (_, i) => 18 + i).map(y => <option key={`min-${y}`} value={y}>{y}세</option>)}
                    </select>
                    <span className="text-text-muted font-bold">~</span>
                    <select value={data.preferred_age_max} onChange={e => setData({...data, preferred_age_max: Number(e.target.value)})} className="flex-1 py-2 text-center text-lg font-bold border-b-2 border-primary focus:outline-none bg-transparent">
                      {Array.from({length: 45 - 18 + 1}, (_, i) => 18 + i).filter(y => y >= data.preferred_age_min).map(y => <option key={`max-${y}`} value={y}>{y}세</option>)}
                    </select>
                  </div>
                )}

                <label className="flex items-center gap-3 p-4 rounded-xl border border-border-default bg-white cursor-pointer hover:bg-surface">
                  <input type="checkbox" checked={data.age_unimportant} onChange={e => setData({...data, age_unimportant: e.target.checked})} className="w-5 h-5 accent-primary" />
                  <span className="text-[16px] font-semibold text-text-primary">나이는 상관없어요</span>
                </label>
              </div>
              <Button onClick={handleNext} className="w-full h-14 mt-8">다음으로</Button>
            </motion.div>
          )}

          {/* Step 3: Subway Quiz */}
          {step === 3 && (
            <motion.div key="step3" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="space-y-8">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-text-primary">지하철 밸런스 게임!</h1>
                <p className="text-text-secondary text-[15px]">나와 잘 맞는 사람을 찾기 위해 쓰여요.</p>
              </div>
              
              <div className="relative min-h-[300px]">
                {quizQuestions.map((q, idx) => {
                  const currentQuizIndex = Object.keys(data.quiz_answers).length;
                  if (idx !== currentQuizIndex) return null;
                  return (
                    <motion.div key={q.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="w-full">
                      <Card className="flex flex-col gap-6 p-6 py-10 shadow-sm border-2 border-primary-light bg-white text-center">
                        <h3 className="text-xl font-bold text-text-primary break-keep leading-relaxed">{q.text}</h3>
                        <div className="space-y-3 mt-4">
                          <button onClick={() => { setData({...data, quiz_answers: {...data.quiz_answers, [q.id]: "A"} }); if(idx===4) handleNext(); }} className="w-full p-4 rounded-xl border-2 border-border-default hover:border-primary hover:bg-primary-light transition-colors text-left font-semibold text-text-secondary shadow-sm">
                            A. {q.a}
                          </button>
                          <button onClick={() => { setData({...data, quiz_answers: {...data.quiz_answers, [q.id]: "B"} }); if(idx===4) handleNext(); }} className="w-full p-4 rounded-xl border-2 border-border-default hover:border-primary hover:bg-primary-light transition-colors text-left font-semibold text-text-secondary shadow-sm">
                            B. {q.b}
                          </button>
                        </div>
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
              {Object.keys(data.quiz_answers).length < 5 && (
                <div className="text-center text-sm font-bold text-primary-dark">
                  {Object.keys(data.quiz_answers).length + 1} / 5 문항
                </div>
              )}
            </motion.div>
          )}

          {/* Step 4: Regular Boarding Times */}
          {step === 4 && (
            <motion.div key="step4" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="space-y-8">
              <h1 className="text-2xl font-bold text-text-primary leading-[1.4]">규칙적으로 타는<br/>지하철 시간이 있나요?</h1>
              <p className="text-text-secondary text-[15px] -mt-4">(주로 출퇴근이나 통학하는 시간대)</p>
              
              <div className="flex gap-4">
                <button onClick={() => setData({...data, has_regular_schedule: true})} className={cn("flex-1 p-4 rounded-xl border font-bold transition-colors", data.has_regular_schedule === true ? "bg-primary text-white border-primary" : "bg-white text-text-secondary border-border-default hover:border-primary-dark")}>
                  예
                </button>
                <button onClick={() => { setData({...data, has_regular_schedule: false, regular_boarding_times: []}); handleNext(); }} className={cn("flex-1 p-4 rounded-xl border font-bold transition-colors", data.has_regular_schedule === false ? "bg-primary text-white border-primary" : "bg-white text-text-secondary border-border-default hover:border-primary-dark")}>
                  아니오
                </button>
              </div>

              {data.has_regular_schedule && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 bg-white p-5 rounded-2xl border border-border-default">
                  {Object.entries(timeSlots).map(([label, slots]) => (
                    <div key={label} className="space-y-3">
                      <h4 className="font-semibold text-text-primary text-[15px]">{label}</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {slots.map(slot => {
                          const isSelected = data.regular_boarding_times.includes(slot);
                          return (
                            <button
                              key={slot}
                              onClick={() => {
                                const newTimes = isSelected ? data.regular_boarding_times.filter(t => t !== slot) : [...data.regular_boarding_times, slot];
                                setData({...data, regular_boarding_times: newTimes});
                              }}
                              className={cn("py-2 px-1 rounded border text-[13px] font-medium transition-colors", isSelected ? "bg-primary-light text-primary border-primary" : "bg-surface text-text-secondary border-transparent")}
                            >
                              {slot}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                  <Button onClick={handleNext} className="w-full mt-4">완료</Button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Step 5: Complete */}
          {step === 5 && (
            <motion.div key="step5" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="flex flex-col items-center justify-center h-full min-h-[60vh] space-y-8 text-center pt-10">
              <motion.div 
                initial={{ scale: 0, rotate: -180 }} 
                animate={{ scale: 1, rotate: 0 }} 
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="w-24 h-24 rounded-full bg-primary-light flex items-center justify-center border-4 border-white shadow-lg"
              >
                <TicketIcon className="w-12 h-12 text-primary" />
              </motion.div>
              
              <div className="space-y-3">
                <h1 className="text-3xl font-bold text-text-primary">탑승 준비 완료!</h1>
                <p className="text-[16px] text-text-secondary leading-relaxed">
                  오늘 당장 사용할 수 있는<br/>티켓 2장이 발급되었어요 🎫
                </p>
              </div>

              <div className="pt-8 w-full block">
                <Button onClick={submitProfile} isLoading={isSubmitting} size="lg" className="w-full h-14 text-lg">
                  지금 탑승하기
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
