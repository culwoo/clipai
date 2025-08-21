import React, { useState, useRef } from "react";
import { Upload, Film, Image as ImageIcon, Type, Play, Loader2, Download, Copy, CreditCard, User, History, ChevronRight } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

const Button: React.FC<ButtonProps> = ({ children, className = "", ...props }) => (
  <button className={"px-4 py-2 rounded-2xl shadow-sm text-sm font-medium transition active:scale-[0.99] bg-indigo-600 text-white hover:bg-indigo-700 " + className} {...props}>{children}</button>
);

const GhostButton: React.FC<ButtonProps> = ({ children, className = "", ...props }) => (
  <button className={"px-4 py-2 rounded-2xl text-sm font-medium transition active:scale-[0.99] bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 " + className} {...props}>{children}</button>
);

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = "" }) => (
  <div className={"rounded-2xl bg-white shadow-sm border border-gray-100 " + className}>{children}</div>
);

interface SectionTitleProps {
  icon: React.FC<{ size?: number }>;
  title: string;
  subtitle?: string;
}

const SectionTitle: React.FC<SectionTitleProps> = ({ icon: Icon, title, subtitle }) => (
  <div className="flex items-center gap-3 mb-3">
    <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600"><Icon size={18} /></div>
    <div>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
    </div>
  </div>
);

type Tab = "home" | "history" | "billing" | "account";
type Phase = "idle" | "processing" | "result";

export default function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>("home");
  const [phase, setPhase] = useState<Phase>("idle");
  const fileRef = useRef<HTMLInputElement>(null);

  const startMockProcess = (): void => {
    setPhase("processing");
    setTimeout(() => setPhase("result"), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600" />
            <span className="font-semibold text-gray-900">ClipAI</span>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <GhostButton onClick={() => setTab("home")}>홈</GhostButton>
            <GhostButton onClick={() => setTab("history")}><History size={16} className="inline mr-1" />내 변환</GhostButton>
            <GhostButton onClick={() => setTab("billing")}><CreditCard size={16} className="inline mr-1" />결제/구독</GhostButton>
            <Button onClick={() => setTab("account")}><User size={16} className="inline mr-1" />마이페이지</Button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {tab === "home" && (
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
            {/* 왼쪽 업로드 카드: 오른쪽 2개 높이와 동일하게 row-span-2 */}
            <Card className="p-6 lg:row-span-2 h-full">
              <SectionTitle icon={Upload} title="영상 업로드 또는 링크 입력" subtitle="드래그 앤 드롭하거나, 유튜브/틱톡 URL을 붙여넣으세요" />
              {phase === "idle" && (
                <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center bg-gray-50 flex flex-col items-center justify-center h-full">
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3"><Upload /></div>
                  <p className="text-gray-700 font-medium">여기로 파일을 끌어다 놓거나 클릭해서 선택</p>
                  <p className="text-xs text-gray-500 mt-1">MP4, MOV · 최대 500MB</p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <GhostButton onClick={() => fileRef.current?.click()}>파일 선택</GhostButton>
                    <input type="file" ref={fileRef} className="hidden" />
                    <span className="text-xs text-gray-400">또는</span>
                    <input placeholder="https://youtube.com/..." className="px-3 py-2 rounded-xl border border-gray-200 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                    <Button onClick={startMockProcess} className="ml-2">변환 시작</Button>
                  </div>
                </div>
              )}
              {phase === "processing" && (
                <div className="p-8 text-indigo-700 font-medium flex items-center gap-2">
                  <Loader2 className="animate-spin" /> 분석 중... 잠시만요
                </div>
              )}
              {phase === "result" && (
                <div className="space-y-6">
                  <SectionTitle icon={Film} title="하이라이트 클립" subtitle="자동 추출된 30~60초 클립" />
                  <div className="grid sm:grid-cols-2 gap-4">
                    {[0, 1, 2].map((i) => (
                      <Card key={i} className="p-3">
                        <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                          <Play />
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <div className="text-xs text-gray-600">하이라이트 #{i + 1} · 42s</div>
                          <div className="flex gap-2">
                            <GhostButton className="px-3 py-1">미리보기</GhostButton>
                            <Button className="px-3 py-1"><Download size={14} className="inline mr-1" />다운로드</Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  <SectionTitle icon={ImageIcon} title="썸네일 제안" subtitle="가장 역동적인 프레임에서 캡처" />
                  <div className="grid grid-cols-3 gap-3">
                    {[1,2,3].map((i) => (
                      <div key={i} className="w-full h-28 bg-gray-100 rounded-xl border border-gray-100" />
                    ))}
                  </div>

                  <SectionTitle icon={Type} title="자동 캡션/설명문" subtitle="플랫폼별로 바로 붙여넣기" />
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-gray-500">YouTube · SEO 키워드 포함</div>
                      <div className="flex gap-2">
                        <GhostButton className="px-3 py-1"><Copy size={14} className="inline mr-1" />복사</GhostButton>
                        <Button className="px-3 py-1"><Download size={14} className="inline mr-1" />TXT 저장</Button>
                      </div>
                    </div>
                    <p className="text-sm leading-6 text-gray-800">
                      오늘 영상에서는 초보 크리에이터도 따라 할 수 있는 3가지 편집 루틴을 소개합니다. ⏱️ 타임스탬프: 00:12 인트로 · 01:03 컷 편집 · 02:20 자막 템플릿 · 03:05 썸네일 팁. #영상편집 #숏폼 #유튜브스타터
                    </p>
                  </Card>
                </div>
              )}
            </Card>

            {/* 오른쪽 사이드 */}
            <Card className="p-6">
              <SectionTitle icon={History} title="최근 변환" subtitle="오늘 · 어제" />
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-10 rounded-lg bg-gray-200" />
                      <div>
                        <div className="text-sm font-medium text-gray-800">튜토리얼 {i}</div>
                        <div className="text-xs text-gray-500">클립 3 · 썸네일 3 · 캡션 1</div>
                      </div>
                    </div>
                    <ChevronRight className="text-gray-300" />
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <SectionTitle icon={CreditCard} title="크레딧 & 구독" subtitle="무료 5회 남음" />
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-semibold text-gray-900">5</div>
                  <div className="text-xs text-gray-500">/ 월 5회 무료</div>
                </div>
                <div className="flex gap-2">
                  <GhostButton>크레딧 충전</GhostButton>
                  <Button>프리미엄 구독</Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {tab === "history" && <div className="max-w-6xl mx-auto">내 변환 탭</div>}
        {tab === "billing" && <div className="max-w-6xl mx-auto">결제/구독 탭</div>}
        {tab === "account" && <div className="max-w-6xl mx-auto">마이페이지 탭</div>}
      </main>

      <footer className="border-t border-gray-100 py-8 text-center text-xs text-gray-500">© 2025 ClipAI · 영상 자동 리사이클링</footer>
    </div>
  );
}