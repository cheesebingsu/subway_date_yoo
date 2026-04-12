"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const mbtiPairs = [['E', 'I'], ['S', 'N'], ['T', 'F'], ['J', 'P']];
const timeSlots = {
  "아침 (Morning)": ["07:00~07:59", "08:00~08:59", "09:00~09:59", "10:00~10:59", "11:00~11:59"],
  "오후 (Afternoon)": ["12:00~12:59", "13:00~13:59", "14:00~14:59", "15:00~15:59", "16:00~16:59"],
  "저녁 (Evening)": ["17:00~17:59", "18:00~18:59", "19:00~19:59", "20:00~20:59"]
};
const quizQuestions = [
  { q: "Q1. 엄청 긴 에스컬레이터 앞, 나는 보통", a: "바빠! 걸어 올라간다", b: "가만히 한 줄로 서서 올라간다" },
  { q: "Q2. 지하철 안, 앞에 자리가 났을 때 나는", a: "1정거장이어도 냉큼 앉는다", b: "금방 내리면 그냥 서 있는다" },
  { q: "Q3. 지하철 안에서 보통 하는 행동은", a: "노이즈캔슬링 켜고 나만의 세계로", b: "주변 사람 구경하거나 바깥 보기" },
  { q: "Q4. 문이 닫히려고 하면 보통", a: "내일은 없다! 전력 질주해서 탄다", b: "쿨하게 다음 열차를 기다린다" },
  { q: "Q5. 지하철 좌석에 앉을 때 선호하는 자리는", a: "무조건 기댈 수 있는 양쪽 끝자리", b: "비어있으면 한가운데라도 상관없다" }
];

export default function ProfileEditPage() {
  const router = useRouter();
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push("/auth");

      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (profile) {
        if (!profile.mbti) profile.mbti = "    "; // defaults
        setData(profile);
      }
      setIsLoading(false);
    }
    loadData();
  }, [supabase, router]);

  const handleSave = async () => {
    // Validation
    if (!data.nickname || data.nickname.length > 8) return toast.error("닉네임은 1~8자로 입력해주세요.");
    if (!data.age || data.age < 18 || data.age > 45) return toast.error("나이는 18~45세로 입력해주세요.");
    if (data.mbti?.length !== 4 || data.mbti.includes(" ")) return toast.error("MBTI 4자리를 모두 선택해주세요.");

    setIsSaving(true);
    const { error } = await supabase.from("profiles").update({
      nickname: data.nickname,
      age: data.age,
      mbti: data.mbti,
      bio: data.bio,
      preferred_age_min: data.preferred_age_min,
      preferred_age_max: data.preferred_age_max,
      quiz_answers: data.quiz_answers,
      regular_boarding_times: data.regular_boarding_times,
      kakao_id: data.kakao_id
    }).eq("id", data.id);

    setIsSaving(false);
    if (error) {
      toast.error("저장 중 오류가 발생했습니다.");
    } else {
      toast.success("프로필이 수정되었습니다 🎫");
      router.push("/profile"); // refresh
    }
  };

  if (isLoading || !data) return <div className="h-screen bg-base" />;

  return (
    <div className="flex flex-col h-screen bg-base max-w-[430px] mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-border-default z-10 shrink-0">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-text-secondary font-semibold">취소</button>
        <h1 className="font-bold text-[17px] text-text-primary">프로필 수정</h1>
        <button onClick={handleSave} disabled={isSaving} className="p-2 -mr-2 text-primary font-bold disabled:opacity-50">저장</button>
      </header>

      <main className="flex-1 overflow-y-auto px-5 py-6 pb-20 space-y-8">
        
        {/* Section 1: Basic Info */}
        <section className="space-y-5">
           <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest pl-1">Basic Info</h3>
           
           <div className="space-y-2">
             <label className="text-sm font-semibold text-text-secondary pl-1">닉네임</label>
             <input type="text" value={data.nickname} onChange={e => setData({...data, nickname: e.target.value.substring(0,8)})} placeholder="8자 이내" className="w-full px-4 py-3 rounded-xl border border-border-default focus:ring-2 focus:ring-primary text-text-primary bg-white outline-none"/>
           </div>

           <div className="space-y-2">
             <label className="text-sm font-semibold text-text-secondary pl-1">나이</label>
             <input type="number" value={data.age || ""} onChange={e => setData({...data, age: e.target.value ? Number(e.target.value) : 0})} placeholder="숫자로 입력" className="w-full px-4 py-3 rounded-xl border border-border-default focus:ring-2 focus:ring-primary text-text-primary bg-white outline-none"/>
           </div>

           <div className="space-y-2">
              <label className="text-sm font-semibold text-text-secondary pl-1">MBTI</label>
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-4 gap-2">
                  {['E', 'S', 'T', 'J'].map((char, idx) => (
                    <button key={char} onClick={() => { const n = data.mbti.split(''); n[idx] = char; setData({...data, mbti: n.join('')}); }} className={cn("py-3 rounded-xl text-[16px] font-bold border-2 transition-colors", data.mbti[idx] === char ? "bg-primary text-white border-primary" : "bg-white text-text-secondary border-border-default hover:border-primary-light")}>
                      {char}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {['I', 'N', 'F', 'P'].map((char, idx) => (
                    <button key={char} onClick={() => { const n = data.mbti.split(''); n[idx] = char; setData({...data, mbti: n.join('')}); }} className={cn("py-3 rounded-xl text-[16px] font-bold border-2 transition-colors", data.mbti[idx] === char ? "bg-primary text-white border-primary" : "bg-white text-text-secondary border-border-default hover:border-primary-light")}>
                      {char}
                    </button>
                  ))}
                </div>
              </div>
           </div>

           <div className="space-y-2">
             <label className="flex justify-between items-end text-sm font-semibold text-text-secondary pl-1">
               한 줄 소개 <span className="text-xs font-medium opacity-60">{data.bio?.length || 0}/20</span>
             </label>
             <input type="text" value={data.bio || ""} onChange={e => setData({...data, bio: e.target.value.substring(0,20)})} placeholder="나의 매력을 한 줄로!" className="w-full px-4 py-3 rounded-xl border border-border-default focus:ring-2 focus:ring-primary text-text-primary bg-white outline-none"/>
           </div>
        </section>

        <hr className="border-border-default/50" />

        {/* Section 2: Ideal Type */}
        <section className="space-y-5">
           <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest pl-1">Ideal Type</h3>
           <div className="space-y-4 bg-surface border border-border-default p-5 rounded-2xl">
              <div>
                <label className="text-sm font-bold text-text-primary block mb-1">상대방의 선호 나이대</label>
                <div className="text-xs font-semibold text-text-muted mb-4">{data.preferred_age_min === 18 && data.preferred_age_max === 45 ? "나이는 숫자에 불과하죠! (전체)" : `${data.preferred_age_min}세 ~ ${data.preferred_age_max}세`}</div>
              </div>
              <div className="flex gap-4 items-center">
                <input type="number" value={data.preferred_age_min} onChange={e => setData({...data, preferred_age_min: Number(e.target.value)})} className="w-16 p-2 text-center border rounded-lg bg-white" />
                <span className="text-text-muted font-bold">~</span>
                <input type="number" value={data.preferred_age_max} onChange={e => setData({...data, preferred_age_max: Number(e.target.value)})} className="w-16 p-2 text-center border rounded-lg bg-white" />
              </div>
              <label className="flex items-center gap-2 mt-4 cursor-pointer w-fit">
                <input type="checkbox" checked={data.preferred_age_min === 18 && data.preferred_age_max === 45} onChange={e => { if (e.target.checked) setData({...data, preferred_age_min: 18, preferred_age_max: 45}); }} className="w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded" />
                <span className="text-sm font-semibold text-text-secondary">상관없음 (18~45세)</span>
              </label>
           </div>
        </section>

        <hr className="border-border-default/50" />

        {/* Section 3: Subway Quiz */}
        <section className="space-y-5">
           <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest pl-1">My Subway Style</h3>
           <div className="space-y-6">
              {quizQuestions.map((q, i) => {
                 const currentAnswer = data.quiz_answers[q.q];
                 return (
                   <div key={i} className="space-y-3 bg-surface p-4 rounded-xl border border-border-default">
                     <p className="font-bold text-[14px] text-text-primary">{q.q}</p>
                     <div className="flex flex-col gap-2">
                       <button onClick={() => setData({...data, quiz_answers: {...data.quiz_answers, [q.q]: q.a}})} className={cn("px-4 py-3 rounded-lg text-sm font-bold text-left border transition-all", currentAnswer === q.a ? "bg-primary-light border-primary text-primary-dark shadow-sm" : "bg-white border-border-default text-text-secondary")}>A. {q.a}</button>
                       <button onClick={() => setData({...data, quiz_answers: {...data.quiz_answers, [q.q]: q.b}})} className={cn("px-4 py-3 rounded-lg text-sm font-bold text-left border transition-all", currentAnswer === q.b ? "bg-primary-light border-primary text-primary-dark shadow-sm" : "bg-white border-border-default text-text-secondary")}>B. {q.b}</button>
                     </div>
                   </div>
                 )
              })}
           </div>
        </section>

        <hr className="border-border-default/50" />

        {/* Section 4: Regular Boarding Times */}
        <section className="space-y-5">
           <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest pl-1">Boarding Schedule</h3>
           
           <div className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer bg-base p-1 w-fit rounded-lg">
                 <input type="checkbox" checked={data.regular_boarding_times && data.regular_boarding_times.length > 0} onChange={e => { if (!e.target.checked) setData({...data, regular_boarding_times: []}); else setData({...data, regular_boarding_times: ["08:00~08:59"]}) }} className="w-5 h-5 text-primary rounded" />
                 <span className="font-bold text-sm text-text-primary">규칙적인 출경/퇴근 시간대가 있나요?</span>
              </label>

              {(data.regular_boarding_times && data.regular_boarding_times.length > 0) && (
                 <div className="space-y-4 bg-surface p-4 rounded-2xl border border-border-default">
                    {Object.entries(timeSlots).map(([label, slots]) => (
                      <div key={label} className="space-y-2">
                        <div className="font-semibold text-xs text-text-secondary">{label}</div>
                        <div className="flex flex-wrap gap-2">
                          {slots.map(slot => (
                            <button
                              key={slot}
                              onClick={() => {
                                const active = data.regular_boarding_times.includes(slot);
                                setData({...data, regular_boarding_times: active ? data.regular_boarding_times.filter((t:string) => t !== slot) : [...data.regular_boarding_times, slot]})
                              }}
                              className={cn("px-3 py-2 rounded-lg text-[13px] font-bold border transition-colors", data.regular_boarding_times.includes(slot) ? "bg-ticket-light border-ticket text-ticket" : "bg-white border-border-default text-text-muted hover:border-gray-300")}
                            >
                              {slot.split('~')[0]}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                 </div>
              )}
           </div>
        </section>

        <hr className="border-border-default/50" />

        {/* Section 5: Kakao ID */}
        <section className="space-y-5">
           <div className="space-y-1 pl-1">
             <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest">Secret Contact</h3>
             <p className="text-[11px] font-semibold text-text-muted">내 카카오톡 아이디 (교환 수락 시에만 노출됩니다)</p>
           </div>
           
           <input type="text" value={data.kakao_id || ""} onChange={e => setData({...data, kakao_id: e.target.value})} placeholder="카카오톡 ID 입력 (선택)" className="w-full px-4 py-3 rounded-xl border border-border-default focus:ring-2 focus:ring-primary text-text-primary bg-white outline-none"/>
        </section>

        <div className="pt-4">
           <Button onClick={handleSave} isLoading={isSaving} className="w-full py-4 text-lg">프로필 저장하기</Button>
        </div>

      </main>
    </div>
  );
}
