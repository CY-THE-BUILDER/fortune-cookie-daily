"use client";

import { motion } from "framer-motion";
import { toBlob } from "html-to-image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FavoriteFortune,
  HistoryState,
  STORAGE_KEYS,
  StreakState,
  createSeed,
  getTodayString,
  getYesterdayString,
  safeStorageGet,
  safeStorageSet
} from "@/lib/storage";
import {
  FortuneMessage,
  formatDisplayDate,
  getDailyFortune,
  getExtraFortune
} from "@/lib/messages";

type AppStage = "idle" | "cracking" | "paper" | "message";
type ActiveMessage = {
  mode: "daily" | "extra";
  drawIndex: number;
  message: FortuneMessage;
  sourceDate: string;
};

const streakMilestones: Record<number, string> = {
  3: "連續 3 天了，你正在養成自己的幸運儀式。",
  7: "滿 7 天，這份穩定感會帶你走得更遠。",
  14: "14 天的堅持很不簡單，今天也值得替自己鼓掌。",
  30: "30 天達成，你已經把溫柔的習慣留在生活裡。"
};

const shareFallbackTitle = "Fortune Cookie Daily";
const crumbPieces = [
  { id: "crumb-1", x: -96, y: -34, rotate: -42, delay: 0.02, width: 14, height: 9 },
  { id: "crumb-2", x: -82, y: 30, rotate: 32, delay: 0.06, width: 16, height: 10 },
  { id: "crumb-3", x: -34, y: -76, rotate: 56, delay: 0.08, width: 10, height: 10 },
  { id: "crumb-4", x: 20, y: -82, rotate: -24, delay: 0.12, width: 18, height: 10 },
  { id: "crumb-5", x: 88, y: -28, rotate: -48, delay: 0.1, width: 14, height: 8 },
  { id: "crumb-6", x: 102, y: 26, rotate: 36, delay: 0.15, width: 16, height: 10 },
  { id: "crumb-7", x: 40, y: 76, rotate: -18, delay: 0.18, width: 12, height: 8 },
  { id: "crumb-8", x: -28, y: 82, rotate: 22, delay: 0.2, width: 14, height: 9 }
];
const dustPieces = [
  { id: "dust-1", x: -54, y: -18, delay: 0.02 },
  { id: "dust-2", x: -22, y: -48, delay: 0.06 },
  { id: "dust-3", x: 24, y: -44, delay: 0.1 },
  { id: "dust-4", x: 58, y: -8, delay: 0.13 },
  { id: "dust-5", x: -44, y: 24, delay: 0.16 },
  { id: "dust-6", x: 44, y: 28, delay: 0.18 }
];

function FullCookieArtwork() {
  return (
    <svg viewBox="0 0 320 240" className="h-full w-full drop-shadow-[0_24px_30px_rgba(120,72,25,0.28)]">
      <defs>
        <linearGradient id="cookieShell" x1="76" y1="54" x2="244" y2="196" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f7cf8b" />
          <stop offset="0.45" stopColor="#e9a75c" />
          <stop offset="1" stopColor="#bf722f" />
        </linearGradient>
        <linearGradient id="cookieRim" x1="112" y1="80" x2="238" y2="168" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f9dfa9" />
          <stop offset="1" stopColor="#cc8041" />
        </linearGradient>
        <radialGradient id="cookieGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(166 90) rotate(90) scale(78 112)">
          <stop stopColor="white" stopOpacity="0.62" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path
        d="M71 154C71 105 113 68 161 68C197 68 229 90 244 121C250 132 257 148 257 161C257 178 248 190 232 196C208 206 186 176 167 173C146 170 121 205 94 196C79 191 71 176 71 154Z"
        fill="url(#cookieShell)"
      />
      <path
        d="M105 163C119 151 132 129 150 107C162 93 178 82 198 78C226 73 247 94 247 121C247 139 231 150 216 151C199 152 189 137 174 137C160 137 149 148 142 157C131 170 120 189 102 190C85 191 74 178 74 160C74 140 87 123 103 108"
        fill="none"
        stroke="url(#cookieRim)"
        strokeWidth="23"
        strokeLinecap="round"
      />
      <path
        d="M92 168C109 171 119 161 131 145C146 124 158 107 176 94C190 84 208 78 223 80"
        fill="none"
        stroke="#8e5322"
        strokeOpacity="0.32"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M171 111C175 130 164 149 145 161"
        fill="none"
        stroke="#9f5e28"
        strokeOpacity="0.32"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <ellipse cx="163" cy="111" rx="82" ry="50" fill="url(#cookieGlow)" />
      <ellipse cx="181" cy="177" rx="75" ry="18" fill="#8f5626" opacity="0.18" />
    </svg>
  );
}

function CookieHalfArtwork({ side }: { side: "left" | "right" }) {
  const isLeft = side === "left";

  return (
    <svg viewBox="0 0 170 170" className="h-full w-full drop-shadow-[0_16px_24px_rgba(120,72,25,0.24)]">
      <defs>
        <linearGradient id={`halfShell-${side}`} x1="20" y1="24" x2="150" y2="150" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f8d392" />
          <stop offset="0.45" stopColor="#e3a25a" />
          <stop offset="1" stopColor="#bf732f" />
        </linearGradient>
        <linearGradient id={`halfInner-${side}`} x1="56" y1="58" x2="122" y2="126" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8f5524" />
          <stop offset="1" stopColor="#cf8750" />
        </linearGradient>
      </defs>
      <path
        d={
          isLeft
            ? "M25 112C25 62 62 25 108 25C129 25 146 34 154 48C159 57 159 73 152 84C143 98 127 98 116 107C99 120 91 147 66 147C41 147 25 134 25 112Z"
            : "M145 112C145 62 108 25 62 25C41 25 24 34 16 48C11 57 11 73 18 84C27 98 43 98 54 107C71 120 79 147 104 147C129 147 145 134 145 112Z"
        }
        fill={`url(#halfShell-${side})`}
      />
      <path
        d={
          isLeft
            ? "M103 55C92 67 86 81 77 92C66 106 49 110 35 109C35 83 51 57 76 42C89 34 105 31 118 33C117 42 111 47 103 55Z"
            : "M67 55C78 67 84 81 93 92C104 106 121 110 135 109C135 83 119 57 94 42C81 34 65 31 52 33C53 42 59 47 67 55Z"
        }
        fill={`url(#halfInner-${side})`}
        opacity="0.78"
      />
      <path
        d={isLeft ? "M108 46C95 61 88 74 81 88" : "M62 46C75 61 82 74 89 88"}
        stroke="#fff4de"
        strokeOpacity="0.34"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d={isLeft ? "M113 101C99 109 92 120 87 133" : "M57 101C71 109 78 120 83 133"}
        stroke="#8f5423"
        strokeOpacity="0.28"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FoldedPaperArtwork() {
  return (
    <svg viewBox="0 0 120 160" className="h-full w-full drop-shadow-[0_14px_22px_rgba(117,87,58,0.18)]">
      <rect x="18" y="18" width="42" height="124" rx="12" fill="#fffdf8" stroke="#d8c2a7" />
      <rect x="60" y="18" width="42" height="124" rx="12" fill="#f7eedf" stroke="#d8c2a7" />
      <path d="M60 20V142" stroke="#d0b99b" strokeOpacity="0.8" />
      <path d="M28 48H92" stroke="#d8c2a7" strokeOpacity="0.5" />
      <path d="M28 79H92" stroke="#d8c2a7" strokeOpacity="0.35" />
    </svg>
  );
}

export default function HomePage() {
  const [seed, setSeed] = useState("");
  const [stage, setStage] = useState<AppStage>("idle");
  const [today, setToday] = useState("");
  const [drawCount, setDrawCount] = useState(0);
  const [activeMessage, setActiveMessage] = useState<ActiveMessage | null>(null);
  const [favorites, setFavorites] = useState<FavoriteFortune[]>([]);
  const [history, setHistory] = useState<HistoryState>({});
  const [streak, setStreak] = useState<StreakState>({
    todayOpened: false,
    lastOpenDate: null,
    streakCount: 0
  });
  const [notice, setNotice] = useState("今天會拆出什麼樣的幸運話語呢？");
  const shareCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentDate = getTodayString();
    setToday(currentDate);

    const existingSeed = safeStorageGet<string | null>(STORAGE_KEYS.seed, null);
    const nextSeed = existingSeed ?? createSeed();
    if (!existingSeed) {
      safeStorageSet(STORAGE_KEYS.seed, nextSeed);
    }
    setSeed(nextSeed);

    const storedFavorites = safeStorageGet<FavoriteFortune[]>(STORAGE_KEYS.favorites, []);
    setFavorites(storedFavorites);

    const storedHistory = safeStorageGet<HistoryState>(STORAGE_KEYS.history, {});
    setHistory(storedHistory);
    if (storedHistory[currentDate]) {
      setDrawCount(storedHistory[currentDate].extraDrawCount + 1);
    }

    const storedStreak = safeStorageGet<StreakState>(STORAGE_KEYS.streak, {
      todayOpened: false,
      lastOpenDate: null,
      streakCount: 0
    });

    if (storedStreak.lastOpenDate !== currentDate) {
      const resetStreak = {
        ...storedStreak,
        todayOpened: false
      };
      setStreak(resetStreak);
      safeStorageSet(STORAGE_KEYS.streak, resetStreak);
    } else {
      setStreak(storedStreak);
    }
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(""), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const streakHint = useMemo(() => {
    if (!streak.streakCount) {
      return "今天拆開第一顆，開始你的幸運連續紀錄。";
    }

    return streakMilestones[streak.streakCount] ?? "每天留一點時間給自己，幸運感會慢慢長出來。";
  }, [streak.streakCount]);

  const dailyLabel = activeMessage?.mode === "daily" ? "今日命定句" : "再抽一張";

  function persistHistory(currentDate: string, messageId: string, extraDrawCount: number) {
    setHistory((previous) => {
      const next = {
        ...previous,
        [currentDate]: {
          date: currentDate,
          dailyMessageId: previous[currentDate]?.dailyMessageId ?? messageId,
          extraDrawCount
        }
      };
      safeStorageSet(STORAGE_KEYS.history, next);
      return next;
    });
  }

  function updateStreak(currentDate: string) {
    setStreak((previous) => {
      if (previous.todayOpened && previous.lastOpenDate === currentDate) {
        return previous;
      }

      const yesterday = getYesterdayString(currentDate);
      const nextCount = previous.lastOpenDate === yesterday ? previous.streakCount + 1 : 1;
      const nextState = {
        todayOpened: true,
        lastOpenDate: currentDate,
        streakCount: nextCount
      };
      safeStorageSet(STORAGE_KEYS.streak, nextState);
      return nextState;
    });
  }

  function handleCookieTap() {
    if (!seed || !today || stage === "cracking" || stage === "paper") {
      return;
    }

    setNotice("餅乾裂開中...");
    setStage("cracking");

    window.setTimeout(() => {
      setStage("paper");
      setNotice("點一下紙條，看看它想對你說什麼。");
    }, 820);
  }

  function revealMessage(nextMessage: ActiveMessage) {
    setActiveMessage(nextMessage);
    setStage("message");
    setNotice(nextMessage.mode === "daily" ? "今天的命定句已經出現了。" : "新的鼓勵紙條來了。");
  }

  function handlePaperTap() {
    if (!seed || !today || stage !== "paper") {
      return;
    }

    const isDailyDraw = drawCount === 0;
    const nextDrawIndex = drawCount + 1;
    const message = isDailyDraw
      ? getDailyFortune(today, seed)
      : getExtraFortune(today, seed, nextDrawIndex);

    revealMessage({
      mode: isDailyDraw ? "daily" : "extra",
      drawIndex: nextDrawIndex,
      message,
      sourceDate: today
    });

    setDrawCount(nextDrawIndex);
    if (isDailyDraw) {
      persistHistory(today, message.id, 0);
      updateStreak(today);
    } else {
      persistHistory(today, history[today]?.dailyMessageId ?? message.id, nextDrawIndex - 1);
    }
  }

  function handleExtraDraw() {
    if (!seed || !today) {
      return;
    }

    setStage("cracking");
    setNotice("再拆一顆新的幸運餅乾...");

    window.setTimeout(() => {
      const nextDrawIndex = drawCount + 1;
      const message = getExtraFortune(today, seed, nextDrawIndex);

      revealMessage({
        mode: "extra",
        drawIndex: nextDrawIndex,
        message,
        sourceDate: today
      });

      setDrawCount(nextDrawIndex);
      persistHistory(today, history[today]?.dailyMessageId ?? message.id, nextDrawIndex - 1);
    }, 700);
  }

  function handleResetScene() {
    if (!activeMessage) {
      return;
    }

    setStage("idle");
    setNotice("想再感受一次拆餅乾的儀式，就再點一次餅乾。");
  }

  function handleFavorite() {
    if (!activeMessage) {
      return;
    }

    const nextFavorite: FavoriteFortune = {
      id: `${activeMessage.sourceDate}-${activeMessage.drawIndex}-${activeMessage.message.id}`,
      text: activeMessage.message.text,
      dateSaved: getTodayString(),
      sourceDate: activeMessage.sourceDate
    };

    setFavorites((previous) => {
      if (previous.some((item) => item.id === nextFavorite.id)) {
        setNotice("這張紙條已經收藏好了。");
        return previous;
      }

      const next = [nextFavorite, ...previous];
      safeStorageSet(STORAGE_KEYS.favorites, next);
      setNotice("已收藏到幸運紙條盒。");
      return next;
    });
  }

  async function handleCopyShare() {
    if (!activeMessage) {
      return;
    }

    const shareText = `今天的幸運餅乾說：\n\n「${activeMessage.message.text}」\n\n— Fortune Cookie Daily`;

    try {
      await navigator.clipboard.writeText(shareText);
      setNotice("文字已複製，可以分享給喜歡的人。");
    } catch {
      setNotice("這次複製失敗了，請再試一次。");
    }
  }

  async function handleShareImage() {
    if (!activeMessage || !shareCardRef.current) {
      return;
    }

    try {
      const blob = await toBlob(shareCardRef.current, {
        cacheBust: true,
        pixelRatio: 2
      });

      if (!blob) {
        throw new Error("blob-not-created");
      }

      const file = new File([blob], "fortune-cookie-daily.png", { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: shareFallbackTitle,
          text: activeMessage.message.text,
          files: [file]
        });
        setNotice("已打開分享選單。");
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "fortune-cookie-daily.png";
      link.click();
      URL.revokeObjectURL(url);
      setNotice("圖片已準備好，已為你下載。");
    } catch {
      setNotice("目前無法輸出圖片，請稍後再試。");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10 pt-6 text-ink">
      <header className="space-y-3 text-center">
        <p className="font-display text-xl tracking-[0.2em] text-ink/55">Fortune Cookie Daily</p>
        <h1 className="text-balance font-display text-5xl leading-none text-ink">每日幸運餅乾</h1>
        <p className="mx-auto max-w-xs text-sm leading-6 text-ink/70">
          點一下看看今天的幸運餅乾想對你說什麼
        </p>
      </header>

      <section className="mt-6 rounded-[2rem] border border-white/60 bg-white/35 px-4 py-3 shadow-paper backdrop-blur-sm">
        <div className="flex items-center justify-between text-sm text-ink/70">
          <span>已連續開啟 {streak.streakCount} 天</span>
          <span>{today ? formatDisplayDate(today) : "讀取中"}</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-ink/80">{streakHint}</p>
      </section>

      <section className="relative mt-8 flex min-h-[400px] items-center justify-center overflow-hidden rounded-[2.5rem] border border-white/50 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.8),transparent_42%),linear-gradient(180deg,rgba(255,247,232,0.9),rgba(248,220,180,0.92))] px-4 py-8 shadow-cookie">
        <div className="absolute -top-10 h-32 w-32 rounded-full bg-white/30 blur-3xl" />
        <div className="absolute bottom-4 left-1/2 h-24 w-64 -translate-x-1/2 rounded-full bg-[#c98e4d]/25 blur-3xl" />
        <motion.div
          animate={{ opacity: [0.3, 0.55, 0.3], scale: [0.92, 1.04, 0.92] }}
          transition={{ duration: 4.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          className="absolute left-1/2 top-[22%] h-32 w-32 -translate-x-1/2 rounded-full bg-white/35 blur-3xl"
        />

        {stage !== "message" && (
          <div className="flex w-full flex-col items-center justify-center gap-6">
            <motion.button
              type="button"
              onClick={handleCookieTap}
              animate={
                stage === "cracking"
                  ? {
                      rotate: [0, -6, 8, -9, 5, 0],
                      scale: [1, 0.98, 1.02, 1],
                      y: [0, -2, 0]
                    }
                  : { rotate: 0, scale: 1 }
              }
              transition={{ duration: 0.7 }}
              className="relative flex h-[250px] w-[290px] items-center justify-center"
              aria-label="Open fortune cookie"
            >
              <motion.span
                animate={stage === "idle" ? { opacity: [0.14, 0.28, 0.14], scale: [0.96, 1.04, 0.96] } : { opacity: 0 }}
                transition={{ duration: 2.6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                className="absolute inset-x-8 top-9 h-28 rounded-full border border-white/40"
              />
              <motion.span
                animate={
                  stage === "cracking"
                    ? { opacity: [0.1, 0.28, 0], scaleX: [0.8, 1.15, 1.2] }
                    : { opacity: 0.14, scaleX: 1 }
                }
                transition={{ duration: 0.45 }}
                className="absolute bottom-7 h-8 w-44 rounded-full bg-[#8b5424]/25 blur-xl"
              />

              {crumbPieces.map((crumb) => (
                <motion.span
                  key={crumb.id}
                  animate={
                    stage === "cracking"
                      ? {
                          opacity: [0, 1, 0],
                          x: [0, crumb.x],
                          y: [0, crumb.y],
                          rotate: [0, crumb.rotate],
                          scale: [0.8, 1, 0.88]
                        }
                      : { opacity: 0, x: 0, y: 0, rotate: 0, scale: 0.6 }
                  }
                  transition={{ duration: 0.55, delay: crumb.delay, ease: "easeOut" }}
                  style={{ width: crumb.width, height: crumb.height }}
                  className="absolute left-1/2 top-1/2 rounded-full bg-[#d7944f] shadow-[0_6px_10px_rgba(126,75,30,0.18)]"
                />
              ))}

              {dustPieces.map((dust) => (
                <motion.span
                  key={dust.id}
                  animate={
                    stage === "cracking"
                      ? {
                          opacity: [0, 0.34, 0],
                          x: [0, dust.x],
                          y: [0, dust.y],
                          scale: [0.2, 1.4, 1.8]
                        }
                      : { opacity: 0, x: 0, y: 0, scale: 0.1 }
                  }
                  transition={{ duration: 0.5, delay: dust.delay, ease: "easeOut" }}
                  className="absolute left-1/2 top-1/2 h-6 w-6 rounded-full bg-[#f1cf9f]/60 blur-md"
                />
              ))}

              <motion.div
                animate={
                  stage === "idle"
                    ? { opacity: 1, scale: 1, rotate: 0, y: 0 }
                    : stage === "cracking"
                      ? { opacity: [1, 1, 0], scale: [1, 0.98, 1.05], rotate: [0, -3, 3], y: [0, 2, -2] }
                      : { opacity: 0, scale: 1.05, rotate: 0, y: -4 }
                }
                transition={{ duration: 0.42, ease: "easeOut" }}
                className="absolute z-20 h-[176px] w-[236px]"
              >
                <FullCookieArtwork />
              </motion.div>

              <motion.span
                animate={
                  stage === "cracking"
                    ? { opacity: [0, 0.92, 0], scaleY: [0.3, 1.1, 0.82], y: [0, -4, 2] }
                    : { opacity: 0, scaleY: 0.2, y: 0 }
                }
                transition={{ duration: 0.32, delay: 0.12 }}
                className="absolute left-1/2 top-[31%] z-40 h-[82px] w-[4px] -translate-x-1/2 rounded-full bg-[linear-gradient(180deg,rgba(255,245,225,0.95),rgba(110,60,22,0.95),rgba(255,255,255,0.1))]"
              />

              <motion.div
                animate={
                  stage === "paper"
                    ? { opacity: 1, y: 0, scale: 1, rotate: 0 }
                    : stage === "cracking"
                      ? { opacity: [0, 1, 0.96], y: [34, 12, 2], scale: [0.64, 0.9, 0.96], rotate: [0, -2, 0] }
                      : { opacity: 0, y: 30, scale: 0.65, rotate: 0 }
                }
                transition={{ duration: 0.54, delay: 0.18, ease: "easeOut" }}
                className="absolute left-1/2 top-[38%] z-30 -translate-x-1/2"
              >
                <div className="h-[104px] w-[84px]">
                  <FoldedPaperArtwork />
                </div>
              </motion.div>

              <motion.div
                animate={
                  stage === "paper"
                    ? { opacity: 1, x: -70, y: 10, rotate: -28, scale: 1 }
                    : stage === "cracking"
                      ? { opacity: [0, 1, 1], x: [-8, -22, -46], y: [0, 2, 8], rotate: [-4, -14, -22], scale: [0.94, 1, 1] }
                      : { opacity: 0, x: -10, y: 0, rotate: -8, scale: 0.92 }
                }
                transition={{ duration: 0.56, ease: "easeOut" }}
                className="absolute z-30 h-[150px] w-[156px]"
              >
                <CookieHalfArtwork side="left" />
              </motion.div>
              <motion.div
                animate={
                  stage === "paper"
                    ? { opacity: 1, x: 72, y: 16, rotate: 30, scale: 1 }
                    : stage === "cracking"
                      ? { opacity: [0, 1, 1], x: [8, 24, 48], y: [0, 4, 10], rotate: [4, 14, 22], scale: [0.94, 1, 1] }
                      : { opacity: 0, x: 10, y: 0, rotate: 8, scale: 0.92 }
                }
                transition={{ duration: 0.56, ease: "easeOut" }}
                className="absolute z-30 h-[150px] w-[156px]"
              >
                <CookieHalfArtwork side="right" />
              </motion.div>
            </motion.button>

            <motion.button
              type="button"
              onClick={handlePaperTap}
              initial={false}
              animate={
                stage === "paper"
                  ? {
                      opacity: 1,
                      y: -6,
                      scale: [0.86, 1.06, 1],
                      rotate: [0, -3, 0],
                      rotateX: [84, 0, 0]
                    }
                  : { opacity: 0, y: 12, scale: 0.9, rotate: -2, rotateX: 84 }
              }
              transition={{ duration: 0.62, delay: 0.18 }}
              style={{ transformPerspective: 900 }}
              className="paper-grain relative z-40 rounded-2xl border border-[var(--paper-edge)] px-6 py-4 text-center shadow-paper"
            >
              <span className="absolute inset-x-5 top-2 h-px bg-[#b88d5d]/20" />
              <p className="text-xs tracking-[0.3em] text-ink/45">FORTUNE</p>
              <p className="mt-2 text-sm text-ink/75">點一下紙條</p>
            </motion.button>

            <p className="max-w-xs text-center text-sm leading-6 text-ink/70">
              {stage === "idle"
                ? "先輕點餅乾，沿著中間裂開，紙條才會慢慢浮出來。"
                : "餅乾碎開了，點紙條把它完整展開。"}
            </p>
          </div>
        )}

        {stage === "message" && activeMessage && (
          <motion.article
            initial={{ opacity: 0, scale: 0.82, y: 28, rotateX: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{ transformPerspective: 1100 }}
            className="paper-grain relative w-full rounded-[2rem] border border-[var(--paper-edge)] px-6 py-7 shadow-paper"
          >
            <div className="absolute inset-x-6 top-3 h-px bg-[#ba9667]/20" />
            <div className="absolute bottom-3 left-6 right-6 h-px bg-[#ba9667]/12" />
            <div className="space-y-2 text-center">
              <p className="text-xs tracking-[0.3em] text-ink/45">{dailyLabel}</p>
              <p className="text-sm text-ink/60">{formatDisplayDate(activeMessage.sourceDate)}</p>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.12 }}
                className="pt-4 font-display text-4xl leading-tight text-ink"
              >
                「{activeMessage.message.text}」
              </motion.p>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleFavorite}
                className="rounded-full border border-[#cfa16c] bg-white/70 px-3 py-3 text-sm font-medium text-ink transition hover:bg-white"
              >
                收藏
              </button>
              <button
                type="button"
                onClick={handleCopyShare}
                className="rounded-full border border-[#cfa16c] bg-white/70 px-3 py-3 text-sm font-medium text-ink transition hover:bg-white"
              >
                分享文字
              </button>
              <button
                type="button"
                onClick={handleShareImage}
                className="rounded-full border border-[#cfa16c] bg-[#d4633a] px-3 py-3 text-sm font-medium text-white transition hover:bg-[#bf5730]"
              >
                分享圖片
              </button>
            </div>

            <button
              type="button"
              onClick={handleExtraDraw}
              className="mt-3 w-full rounded-full border border-transparent bg-ink px-4 py-3 text-sm font-medium text-white transition hover:bg-[#422d1b]"
            >
              再抽一張
            </button>

            <button
              type="button"
              onClick={handleResetScene}
              className="mt-3 w-full rounded-full border border-[#d7b180] bg-transparent px-4 py-3 text-sm font-medium text-ink/75 transition hover:bg-white/40"
            >
              回到餅乾
            </button>

            <p className="mt-6 text-center text-sm leading-6 text-ink/60">
              明天再來拆一顆新的幸運餅乾
            </p>
          </motion.article>
        )}
      </section>

      <div className="mt-4 min-h-6 text-center text-sm text-ink/70">{notice}</div>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-3xl text-ink">收藏紙條</h2>
          <span className="text-sm text-ink/60">{favorites.length} 張</span>
        </div>

        {favorites.length === 0 ? (
          <div className="paper-grain rounded-[1.75rem] border border-[var(--paper-edge)] px-5 py-6 text-sm leading-6 text-ink/65 shadow-paper">
            收藏喜歡的句子後，它們會安靜地留在這裡。
          </div>
        ) : (
          <div className="space-y-3">
            {favorites.map((favorite) => (
              <article
                key={favorite.id}
                className="paper-grain rounded-[1.75rem] border border-[var(--paper-edge)] px-5 py-5 shadow-paper"
              >
                <p className="font-display text-2xl leading-snug text-ink">「{favorite.text}」</p>
                <div className="mt-3 flex items-center justify-between text-sm text-ink/55">
                  <span>收藏於 {favorite.dateSaved.replace(/-/g, "/")}</span>
                  <span>來自 {favorite.sourceDate.replace(/-/g, "/")}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="pointer-events-none fixed left-[-9999px] top-0">
        <div
          ref={shareCardRef}
          className="paper-grain relative flex h-[720px] w-[720px] flex-col justify-between overflow-hidden rounded-[48px] border border-[#dfc9aa] p-16 text-ink"
        >
          <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-[#f2c07a]/25 blur-3xl" />
          <div className="absolute -bottom-24 -left-8 h-64 w-64 rounded-full bg-[#cf8f50]/20 blur-3xl" />
          <div>
            <p className="text-xl tracking-[0.4em] text-ink/45">FORTUNE COOKIE DAILY</p>
            <p className="mt-6 text-lg text-ink/60">{activeMessage ? formatDisplayDate(activeMessage.sourceDate) : ""}</p>
          </div>
          <div className="relative rounded-[40px] border border-white/60 bg-white/55 px-12 py-16">
            <p className="font-display text-[54px] leading-[1.28] text-ink">
              {activeMessage ? `「${activeMessage.message.text}」` : ""}
            </p>
          </div>
          <div className="flex items-center justify-between text-xl text-ink/55">
            <span>今天的幸運餅乾說</span>
            <span className="rounded-full border border-[#d4a777] px-5 py-2">Fortune Seal</span>
          </div>
        </div>
      </div>
    </main>
  );
}
