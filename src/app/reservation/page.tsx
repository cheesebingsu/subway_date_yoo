"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TicketIcon } from "@/components/ui/TicketIcon";

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

export default function LandingPage() {
  const [count, setCount] = useState<number>(0);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchCount() {
      const { count: fetchedCount, error } = await supabase
        .from("waitlist")
        .select("*", { count: "exact", head: true });

      if (!error && fetchedCount !== null) {
        setCount(fetchedCount);
      }
    }
    fetchCount();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsSubmitting(true);

    const { error } = await supabase.from("waitlist").insert([{ email }]);

    if (error) {
      if (error.code === "23505") {
        toast.error("이미 사전예약된 이메일이에요.");
      } else {
        toast.error("오류가 발생했어요. 다시 시도해주세요.");
      }
    } else {
      toast.success("탑승 예약이 완료되었습니다! 🎫", {
        description: "앱 출시 시 가장 먼저 알려드릴게요.",
      });
      setCount((c) => c + 1);
      setEmail("");
    }
    setIsSubmitting(false);
  };

  const scrollToBottom = () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  return (
    <main className="flex flex-col w-full h-full pb-10">
      {/* Section 1 — Hero */}
      <section className="flex flex-col items-center justify-center min-h-[85vh] px-6 text-center bg-gradient-to-b from-primary-light to-base">
        <motion.div initial="hidden" animate="visible" variants={fadeInUp} className="space-y-6 mt-10">
          <h1 className="text-[28px] md:text-[32px] font-bold text-text-primary leading-[1.4]">
            지금 이 지하철 안,<br />
            나와 꽤 잘 통하는 누군가가<br />
            타고 있을지도 몰라요.
          </h1>
          <p className="text-[16px] text-text-secondary">
            어차피 타는 지하철. 조금만 설레어 볼까요?
          </p>

          <div className="pt-8 space-y-3 flex flex-col items-center">
            <Button size="lg" className="w-full max-w-xs shadow-sm" onClick={scrollToBottom}>
              사전예약하고 무료 티켓 10장 받기
            </Button>
            <p className="text-[13px] text-text-muted mt-2">
              벌써 <span className="text-primary font-semibold">{count}명</span>이 사전예약했어요
            </p>
          </div>
        </motion.div>
      </section>

      {/* Section 2 — How It Works (3 cards) */}
      <motion.section 
        className="px-6 py-16 space-y-8"
        initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={fadeInUp}
      >
        <div className="space-y-4">
          <Card className="flex flex-col gap-2 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <span className="text-primary font-bold text-sm">POINT 1</span>
            <h3 className="text-[20px] font-semibold text-text-primary">탈 때만 열려요</h3>
            <p className="text-[16px] text-text-secondary leading-relaxed">
              채팅은 오직 지하철에 타고 있을 때만 가능해요.<br/>
              내리면 자연스럽게 대화가 종료됩니다.
            </p>
          </Card>

          <Card className="flex flex-col gap-2 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-ticket" />
            <span className="text-ticket font-bold text-sm">POINT 2</span>
            <h3 className="text-[20px] font-semibold text-text-primary">얼굴 대신 퀴즈로 만나요</h3>
            <p className="text-[16px] text-text-secondary leading-relaxed">
              외모 평가 없이, 지하철 관련 A/B 퀴즈 5개로<br/>
              서로의 취향과 관심사를 알아봐요.
            </p>
          </Card>

          <Card className="flex flex-col gap-2 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-success" />
            <span className="text-success font-bold text-sm">POINT 3</span>
            <h3 className="text-[20px] font-semibold text-text-primary">부담 없이 무료로 시작</h3>
            <p className="text-[16px] text-text-secondary leading-relaxed">
              매일 2장의 무료 티켓이 제공돼요.<br/>
              가벼운 마음으로 앱을 열어보세요.
            </p>
          </Card>
        </div>
      </motion.section>

      {/* Section 3 — Usage Flow */}
      <motion.section 
        className="px-6 py-16 bg-surface space-y-8"
        initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={fadeInUp}
      >
        <h2 className="text-[24px] font-bold text-text-primary mb-8 text-center">
          이렇게 이용해요
        </h2>
        
        <div className="space-y-6">
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-light text-primary flex items-center justify-center font-bold">1</div>
            <div>
              <h4 className="text-[18px] font-semibold text-text-primary">탑승 버튼 누르기</h4>
              <p className="text-text-secondary text-[15px] mt-1">지하철에 타면 설레철의 탑승 버튼을 눌러요.</p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-light text-primary flex items-center justify-center font-bold">2</div>
            <div>
              <h4 className="text-[18px] font-semibold text-text-primary">오늘의 후보 3명 만나기</h4>
              <p className="text-text-secondary text-[15px] mt-1">나와 비슷한 취향의 사람들을 추천해드려요.</p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-light text-primary flex items-center justify-center font-bold">3</div>
            <div>
              <h4 className="text-[18px] font-semibold text-text-primary">마음에 들면 호감 보내기</h4>
              <p className="text-text-secondary text-[15px] mt-1">티켓 1장을 사용해 인사를 건네볼 수 있어요.</p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
              <TicketIcon className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="text-[18px] font-semibold text-text-primary">잘 맞으면 카톡 교환</h4>
              <p className="text-text-secondary text-[15px] mt-1">티켓 2장을 사용해 진짜 인연을 이어가세요!</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Section 4 — Pre-registration Form */}
      <motion.section 
        className="px-6 py-20 text-center"
        initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={fadeInUp}
      >
        <div className="bg-primary-light/50 p-6 rounded-[24px] border border-primary-light">
          <TicketIcon className="mx-auto w-10 h-10 mb-4" />
          <h2 className="text-[22px] font-bold text-text-primary mb-2">
            사전예약하고 티켓 10장 받기
          </h2>
          <p className="text-text-secondary text-[15px] mb-8">
            정식 출시 후 알림 이메일과 선물을 보내드려요.
          </p>

          <form onSubmit={handleRegister} className="flex flex-col gap-3 max-w-xs mx-auto">
            <input
              type="email"
              placeholder="이메일을 입력해주세요"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="px-4 py-3 rounded-xl border border-border-default focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-text-primary bg-white text-base"
            />
            <Button type="submit" size="lg" isLoading={isSubmitting}>
              미리 탑승하기
            </Button>
          </form>
        </div>
      </motion.section>

      {/* Section 5 — Footer */}
      <footer className="mt-10 mb-4 text-center space-y-4 text-text-muted text-[13px]">
        <p className="font-semibold text-text-secondary text-[15px]">설레철 (Seullecheol)</p>
        <div className="flex justify-center gap-4">
          <a href="#" className="hover:text-text-secondary transition-colors">이용약관</a>
          <a href="#" className="hover:text-text-secondary transition-colors">개인정보처리방침</a>
        </div>
        <p>Built by a solo developer</p>
      </footer>
    </main>
  );
}
