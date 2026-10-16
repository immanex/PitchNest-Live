import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Video,
  VideoOff,
  Sparkles,
  Mic,
  MicOff,
  VolumeX,
  Volume2,
  Monitor,
  MonitorOff,
  Send,
  ArrowRightLeft,
  Loader2,
  AlertTriangle,
  MessageSquare,
  Timer,
  Activity,
  TrendingUp,
  Users,
  Lightbulb,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  Layers,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../lib/utils";
import { LogoMark } from "../components/Logo";
import {
  SlideDeckViewer,
  SlideDeckControls,
  canPaginateDeck,
} from "../components/SlideDeckViewer";
import { useMediaRecorder } from "../hooks/useMediaRecorder";
import { useScreenCapture } from "../hooks/useScreenCapture";
import { useSocketContext } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";
import { useUpgrade } from "../components/ui/UpgradeModal";
import { ThemeToggle } from "../components/ThemeToggle";
import { UserAvatar } from "../components/ui/UserAvatar";
import { matchAnswerTip, type AnswerTip } from "../lib/answerTips";
import { FirstTimeTour } from "../components/FirstTimeTour";
import { API_BASE_URL } from "../lib/apiBase";
import { getStoredUser } from "../lib/authStorage";

declare global {
  interface Window {
    firstAudioSent?: number;
    firstAudioReceived?: number;
    _pcmCount?: number;
    _sentChunks?: number;
  }
}

// Per-frame audio logging is OFF by default — it produces thousands of lines in
// a long session, dragging tab performance and memory. Devs can enable it with
// `localStorage.setItem("pn_audio_debug", "1")` then reloading.
const AUDIO_DEBUG =
  typeof window !== "undefined" &&
  window.localStorage?.getItem("pn_audio_debug") === "1";

const TTS_LANG = "en-US";
const TTS_MAX_CHARS = 420;
const TTS_MAX_SENTENCES = 2;
// Playback sample rate for AI audio. MUST match the backend TTS output format
// (ttsService.ts → SpeechSynthesisOutputFormat.Raw24Khz16BitMonoPcm).
const TTS_OUTPUT_SAMPLE_RATE = 24000;

// ── Voice-activity / barge-in tuning ────────────────────────────────────────
// Barge-in fires when mic RMS stays above an ADAPTIVE threshold for a sustained
// window. The threshold is derived from the room's measured noise floor rather
// than a fixed magic constant, so it adapts to loud rooms and soft talkers.
// pcm-processor.js posts one frame per 1024 samples @16kHz ≈ 64ms.
const VAD_CALIBRATION_FRAMES = 24; // ~1.5s of ambient audio to learn the noise floor
const VAD_THRESHOLD_MULTIPLIER = 2.5; // speech must exceed 2.5× the noise floor
const VAD_MIN_THRESHOLD = 0.04; // absolute floor so a silent room can't make VAD hair-trigger
const VAD_SUSTAIN_FRAMES = 3; // ~190ms of sustained loudness before counting as speech
const VAD_BARGE_IN_MS = 600; // sustained speech duration that confirms an intentional interruption
// One PCM frame from pcm-processor.js holds 1024 samples at 16kHz. Speech time
// is accumulated as a COUNT of loud frames times this, rather than by clocking
// wall time between two timestamps: a burst of late frames then still measures
// exactly the audio it represents, and a stall in the audio thread measures as
// silence instead of inflating the turn.
const TTS_STREAM_FLUSH_MS = 650;
const TTS_STREAM_SPEAK_MIN_CHARS = 120;

function normalizeWhitespace(text: string) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function trimToSentences(text: string, maxSentences: number) {
  const t = normalizeWhitespace(text);
  if (!t) return "";
  const parts = t.split(/(?<=[.!?])\s+/);
  return parts.slice(0, Math.max(1, maxSentences)).join(" ") || t;
}

function limitSpokenText(text: string) {
  const t = trimToSentences(text, TTS_MAX_SENTENCES);
  if (t.length <= TTS_MAX_CHARS) return t;
  return (
    t
      .slice(0, TTS_MAX_CHARS)
      .replace(/\s+\S*$/, "")
      .trimEnd() + "…"
  );
}

function resample(
  inputBuffer: Float32Array,
  inSampleRate: number,
  outSampleRate: number,
): Float32Array {
  if (inSampleRate === outSampleRate) return inputBuffer;
  const ratio = inSampleRate / outSampleRate;
  const newLength = Math.round(inputBuffer.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const index = Math.floor(srcIndex);
    const interpolation = srcIndex - index;
    if (index + 1 < inputBuffer.length) {
      result[i] =
        inputBuffer[index] * (1 - interpolation) +
        inputBuffer[index + 1] * interpolation;
    } else {
      result[i] = inputBuffer[index];
    }
  }
  return result;
}

const VoiceWaveform = ({ isActive }: { isActive?: boolean }) => (
  <div className="flex items-center gap-0.75 h-4 px-1">
    {[...Array(4)].map((_, i) => (
      <motion.div
        key={i}
        className={cn(
          "w-1 rounded-full",
          isActive ? "bg-sky-500" : "bg-slate-200 dark:bg-zinc-800",
        )}
        animate={
          isActive ? { height: ["20%", "100%", "20%"] } : { height: "20%" }
        }
        transition={
          isActive
            ? {
                duration: 0.5,
                repeat: Infinity,
                delay: i * 0.1,
                ease: "easeInOut",
              }
            : {}
        }
      />
    ))}
  </div>
);

const PANELIST_COLORS: Record<string, [string, string]> = {
  marcus: ["#0284c7", "#312e81"],
  sarah: ["#7c3aed", "#be185d"],
  chen: ["#059669", "#155e75"],
  elena: ["#db2777", "#7c3aed"],
  david: ["#ea580c", "#b91c1c"],
  james: ["#4f46e5", "#0f766e"],
  riley: ["#0d9488", "#4338ca"],
  taylor: ["#9333ea", "#0369a1"],
};

function getPanelistAvatar(name: string): string {
  const normalized = name.toLowerCase().trim();
  const key = Object.keys(PANELIST_COLORS).find((candidate) => normalized.includes(candidate));
  const [start, end] = key ? PANELIST_COLORS[key] : ["#475569", "#0f172a"];
  const initials = name
    .split(/\s+/)
    .map((part) => part.replace(/[^a-z]/gi, "").charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase() || "AI";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${start}"/><stop offset="1" stop-color="${end}"/></linearGradient></defs><rect width="160" height="160" rx="80" fill="url(#g)"/><circle cx="80" cy="62" r="31" fill="white" fill-opacity=".2"/><path d="M25 151c4-35 25-55 55-55s51 20 55 55" fill="white" fill-opacity=".2"/><text x="80" y="91" text-anchor="middle" font-family="Arial,sans-serif" font-size="42" font-weight="700" fill="white">${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Panel-mode only: each panelist's live interest in the deal, pushed by the
// server as the session unfolds (warming | neutral | cooling | out).
const INTEREST_DOT: Record<string, string> = {
  warming: "bg-emerald-500",
  cooling: "bg-amber-500",
};

const AIPanelist = ({
  name,
  role,
  isActive,
  interest,
}: {
  name: string;
  role: string;
  isActive?: boolean;
  interest?: string;
  key?: React.Key;
}) => {
  const isOut = interest === "out";
  return (
    <div
      className={cn(
        "w-full shrink-0 relative overflow-hidden bg-white/80 dark:bg-zinc-900/60 backdrop-blur-md rounded-2xl transition-all duration-500 group flex flex-row items-center gap-3 p-2.5 border",
        isActive
          ? "border-sky-500 shadow-[0_0_20px_rgba(14,165,233,0.15)] bg-sky-50/50 dark:bg-zinc-800"
          : "border-slate-200 dark:border-white/5",
        isOut && "opacity-60",
      )}
    >
      {isActive && (
        <div className="absolute inset-0 bg-linear-to-r from-sky-500/10 to-transparent pointer-events-none" />
      )}

      <div className="relative w-14 h-14 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <img
          src={getPanelistAvatar(name)}
          alt={name}
          className={cn(
            "w-full h-full object-cover transition-transform duration-700",
            isActive ? "scale-110" : "scale-100",
            isOut && "grayscale",
          )}
        />
        {isActive && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
        )}
      </div>

      <div className="flex-1 min-w-0 relative z-10">
        <p className="text-[11px] font-bold text-slate-800 dark:text-white uppercase tracking-wider truncate flex items-center gap-1.5">
          {name}
          {isOut ? (
            <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-slate-200 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 tracking-widest">
              OUT
            </span>
          ) : (
            interest && INTEREST_DOT[interest] && (
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  INTEREST_DOT[interest],
                )}
                title={interest === "warming" ? "Warming up" : "Cooling off"}
              />
            )
          )}
        </p>
        <span className="text-[9px] font-bold text-sky-600 dark:text-sky-400/80 uppercase tracking-widest">
          {role}
        </span>
      </div>

      <div className="opacity-70 group-hover:opacity-100 transition-opacity shrink-0">
        <VoiceWaveform isActive={isActive} />
      </div>
    </div>
  );
};

const getArchetypeLabel = (archetype: string) => {
  if (archetype?.includes("Angel")) return "Angel investor panel";
  if (archetype?.includes("Y Combinator")) return "YC partner panel";
  if (archetype?.includes("Shark")) return "Shark Tank panel";
  if (archetype?.includes("Private Equity")) return "PE diligence panel";
  if (archetype?.includes("Corporate")) return "Corporate VC panel";
  if (archetype?.includes("Family")) return "Family Office panel";
  if (archetype?.includes("Growth") || archetype?.includes("Series")) return "Growth-stage panel";
  if (archetype?.includes("Impact") || archetype?.includes("ESG")) return "ESG & Impact panel";
  if (archetype?.includes("Demo")) return "Demo review panel";
  return archetype || "Seed-stage VC panel";
};

const PERSONA_ROLE_LABELS: Record<string, { marcus: string; sarah: string; chen: string }> = {
  "Seed Stage - Venture Capital": { marcus: "Lead Partner", sarah: "Financial Analyst", chen: "Technical Partner" },
  "Angel Investor Group": { marcus: "Lead Angel", sarah: "Angel Investor", chen: "Angel Investor" },
  "Growth Stage - Venture Capital": { marcus: "Lead Partner", sarah: "Growth Analyst", chen: "Ops & Scale Partner" },
  "Shark Tank Judge": { marcus: "Lead Shark", sarah: "Shark", chen: "Shark" },
  "Private Equity": { marcus: "Managing Partner", sarah: "PE Analyst", chen: "Diligence Partner" },
  "Strategic Corporate VC": { marcus: "Lead Partner", sarah: "Strategy Lead", chen: "Integration Partner" },
  "Family Office": { marcus: "Lead Advisor", sarah: "Wealth Advisor", chen: "Values Advisor" },
  "Y Combinator Partner": { marcus: "Lead Partner", sarah: "Growth Partner", chen: "Product Partner" },
  "ESG & Impact Investor": { marcus: "Lead Partner", sarah: "Impact Analyst", chen: "Sustainability Partner" },
  "Demo Presentation": { marcus: "Lead Reviewer", sarah: "UX Reviewer", chen: "Technical Reviewer" },
};

const getPersonas = (archetype: string, mode: string) => {
  if (mode === "coach") {
    return [{ name: "Riley", role: "Pitch Coach" }];
  }
  const roles = PERSONA_ROLE_LABELS[archetype] || PERSONA_ROLE_LABELS["Seed Stage - Venture Capital"];
  return [
    { name: "Marcus", role: roles.marcus },
    { name: "Sarah", role: roles.sarah },
    { name: "Chen", role: roles.chen },
  ];
};

// ─── Verdict phase overlay ───────────────────────────────────────────────────
const VerdictOverlay = ({
  verdictPhase,
  verdictCountdown,
  verdictMessages,
  activeSpeakerName,
  isSpeaking,
}: {
  verdictPhase: boolean;
  verdictCountdown: number;
  verdictMessages: {
    speaker: string;
    text: string;
    verdict: "invest" | "pass" | "maybe";
  }[];
  activeSpeakerName: string;
  isSpeaking: boolean;
}) => {
  if (!verdictPhase) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-90 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
    >
      <div className="mb-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-sky-500/20 border border-sky-500/40 rounded-full mb-4">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          <span className="text-sky-300 text-xs font-bold uppercase tracking-widest">
            Panel Verdict
          </span>
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-1">
          The Panel is Deliberating
        </h2>
        <p className="text-slate-400 text-sm">
          Closing in{" "}
          <span className="text-sky-400 font-bold">{verdictCountdown}s</span>{" "}
          after verdicts
        </p>
      </div>

      {isSpeaking && (
        <div className="flex items-center gap-2 mb-4 px-4 py-2 bg-sky-500/10 border border-sky-500/20 rounded-xl">
          <VoiceWaveform isActive={true} />
          <span className="text-sky-300 text-xs font-medium">
            {activeSpeakerName} is speaking…
          </span>
        </div>
      )}

      <div className="w-full max-w-lg space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
        {verdictMessages.map((vm, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.15 }}
            className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-2xl p-3 text-left"
          >
            <img
              src={getPanelistAvatar(vm.speaker)}
              alt={vm.speaker}
              className="w-9 h-9 rounded-full object-cover shrink-0 border-2 border-white/10"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">
                  {vm.speaker}
                </span>
                <span
                  className={cn(
                    "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                    vm.verdict === "invest"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : vm.verdict === "pass"
                        ? "bg-rose-500/20 text-rose-400"
                        : "bg-amber-500/20 text-amber-400",
                  )}
                >
                  {vm.verdict === "invest"
                    ? "✓ Invest"
                    : vm.verdict === "pass"
                      ? "✗ Pass"
                      : "◎ Maybe"}
                </span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                {vm.text}
              </p>
            </div>
          </motion.div>
        ))}
        {verdictMessages.length === 0 && (
          <div className="text-slate-500 text-xs py-4">
            Waiting for panelists…
          </div>
        )}
      </div>
    </motion.div>
  );
};
// DECK RENDERING. This is now a thin adapter over SlideDeckViewer, which shows
// ONE COMPLETE SLIDE at a time (see that file for why it works the way it does).
// Keeping the adapter means every existing call site — desktop main area,
// desktop thumbnail, mobile main area, mobile PIP — keeps its current shape and
// only gains the slide props, and there is exactly one place that decides how a
// deck is drawn. Screen-share and the empty state are unchanged.
const DeckViewer = React.memo(
  ({
    className = "",
    isCapturing = false,
    screenRef,
    deckUrl,
    pageCount = 0,
    slide = 1,
    onSlideChange,
    showControls = true,
    captureKeyboard = false,
  }: {
    className?: string;
    /** Screen-share replaces the slide surface. Omitted by preview instances,
     *  which never host the capture element. */
    isCapturing?: boolean;
    screenRef?: any;
    deckUrl?: string;
    pageCount?: number;
    slide?: number;
    onSlideChange?: (slide: number) => void;
    /** Arrows on the slide surface. Off for thumbnails/PIPs. */
    showControls?: boolean;
    /** Window-level arrow keys. Only ONE mounted viewer may claim these. */
    captureKeyboard?: boolean;
  }) => {
    const noop = React.useCallback(() => {}, []);
    return (
      <SlideDeckViewer
        className={className}
        isCapturing={isCapturing}
        screenRef={screenRef}
        url={deckUrl || ""}
        pageCount={pageCount}
        slide={slide}
        onSlideChange={onSlideChange || noop}
        showControls={showControls && !!onSlideChange}
        captureKeyboard={captureKeyboard}
      />
    );
  },
);
/**
 * Monotonic transcript-message ids.
 *
 * Ids used to be `${prefix}-${Date.now()}`, which is only unique when no two
 * messages are created within the same millisecond. Verdicts are now synthesized
 * in parallel on the server and arrive as a burst, so two panelists can land on
 * an identical key — React then treats them as the same element and one verdict
 * silently disappears from the transcript. A counter cannot collide.
 */
let messageSeq = 0;
const nextMessageId = (prefix: string) =>
  `${prefix}-${Date.now()}-${++messageSeq}`;

const getDeckDisplayUrl = (url: string) => {
  if (!url) return "";
  let parsed: URL;
  try {
    parsed = new URL(url, window.location.origin);
  } catch {
    return "";
  }
  const hostname = window.location.hostname;
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    hostname.endsWith(".local");
  if (
    parsed.username ||
    parsed.password ||
    (parsed.protocol !== "https:" && !(isLocal && parsed.protocol === "http:"))
  ) return "";
  // Token-gated local files are returned as a backend-relative API URL.
  if (url.startsWith("/api/files/")) return `${API_BASE_URL}${url}`;
  return parsed.toString();
};

// ─── Stable camera viewer — lives OUTSIDE LivePitchRoom so its identity never
//     changes between renders, which would unmount/remount the <video> element
//     and cause the visible skip/crack during a pitch session. ────────────────
// Camera recording is disabled for now (we're avoiding heavy video storage), so
// this tile shows the founder's profile picture (or default avatar) instead of a
// camera feed, with a "listening" glow driven by the mic VAD signal so the user
// can see the system is hearing them. A hidden <video> keeps the ref wiring
// intact. (`stream`/`isCameraMuted` stay in the prop type for call-site
// compatibility but are intentionally unused.)
// ─── Answer-Tips coaching card ───────────────────────────────────────────────
// A read-only, presentational overlay shown over the founder's avatar box while
// the floor is theirs (AWAITING_FOUNDER). It explains the concept in the
// panelist's question and gives DIRECTION only — never a model answer. It fades
// in (quick), but is HIDDEN INSTANTLY by the parent un-mounting it the moment the
// founder starts speaking (same VAD signal that drives the glow) — there is no
// exit animation, so the hide can never lag behind the founder's voice.
const TipCard = React.memo(({ tip }: { tip: AnswerTip }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.2, ease: "easeOut" }}
    className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 p-3 pb-20 md:p-5 md:pb-28 text-center bg-slate-950/82 backdrop-blur-sm overflow-y-auto custom-scrollbar"
  >
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/20 border border-sky-500/40 shrink-0">
      <Lightbulb size={12} className="text-sky-300" />
      <span className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest text-sky-300">
        Answer Tip
      </span>
    </div>
    <h4 className="text-sm md:text-lg font-extrabold text-white leading-tight shrink-0">
      {tip.term}
    </h4>
    <p className="text-[10px] md:text-xs text-slate-300 leading-snug max-w-xs">
      {tip.definition}
    </p>
    <div className="mt-1 pt-2 border-t border-white/10 max-w-xs">
      <p className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest text-emerald-400 mb-1">
        How to answer
      </p>
      <p className="text-[11px] md:text-sm text-white/90 leading-snug font-medium">
        {tip.tip}
      </p>
    </div>
  </motion.div>
));
TipCard.displayName = "TipCard";

const CameraViewer = React.memo(
  ({
    videoRef,
    isPitching,
    avatarUrl,
    userName,
    isUserSpeaking = false,
    className = "",
  }: {
    videoRef: (el: HTMLVideoElement | null) => void;
    stream: MediaStream | null;
    isCameraMuted: boolean;
    isPitching: boolean;
    avatarUrl?: string;
    userName?: string;
    isUserSpeaking?: boolean;
    className?: string;
  }) => (
    <div
      className={cn(
        "w-full h-full relative flex items-center justify-center bg-slate-900 overflow-hidden",
        className,
      )}
    >
      <video ref={videoRef} autoPlay muted playsInline className="opacity-0 absolute pointer-events-none w-0 h-0" />
      <div className="relative flex flex-col items-center justify-center gap-4">
        <div className="relative flex items-center justify-center">
          {isUserSpeaking && (
            <>
              <span className="absolute w-32 h-32 md:w-40 md:h-40 rounded-full bg-emerald-400/20 animate-ping" />
              <span className="absolute w-28 h-28 md:w-36 md:h-36 rounded-full ring-4 ring-emerald-400/40 animate-pulse" />
            </>
          )}
          <UserAvatar
            name={userName}
            avatarUrl={avatarUrl}
            className={cn(
              "relative w-24 h-24 md:w-28 md:h-28 text-3xl md:text-4xl border-4 transition-all duration-200",
              isUserSpeaking
                ? "border-emerald-400 shadow-[0_0_45px_rgba(52,211,153,0.55)]"
                : "border-white/15",
            )}
          />
        </div>
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-widest transition-colors",
            isUserSpeaking ? "text-emerald-400" : "text-white/40",
          )}
        >
          {isUserSpeaking ? "Listening…" : userName || "You"}
        </span>
      </div>
      {isPitching && (
        <div className="absolute top-3 right-3 bg-rose-500 px-2.5 py-1 rounded-full text-[8px] font-bold animate-pulse shadow-lg z-10 uppercase tracking-widest text-white">
          Live
        </div>
      )}
    </div>
  ),
);
CameraViewer.displayName = "CameraViewer";

const RESUME_KEY = "pn_activeSession";

type ResumeRecord = {
  v: number;
  endsAt: number;
  startedAt: number;
  messages: any[];
  mode: string | null;
};

// Reads the in-progress session snapshot saved to sessionStorage. sessionStorage
// is per-tab and cleared by the browser when the tab closes, so a refresh keeps
// it (we resume) while a real close drops it (the session is abandoned).
function readResumeRecord(): ResumeRecord | null {
  try {
    const raw = sessionStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw);
    if (!rec || typeof rec.endsAt !== "number") return null;
    return rec as ResumeRecord;
  } catch {
    return null;
  }
}

export default function LivePitchRoom() {
  const location = useLocation();
  const navigate = useNavigate();

  const [pitchConfig, setPitchConfig] = useState(() => {
    if (location.state?.pitchConfig) {
      sessionStorage.setItem(
        "pitchConfig",
        JSON.stringify(location.state.pitchConfig),
      );
      return location.state.pitchConfig;
    }
    const saved = sessionStorage.getItem("pitchConfig");
    return saved ? JSON.parse(saved) : null;
  });

  const { stream, streamRef, startStream, stopStream } = useMediaRecorder();
  const { socket, isConnected } = useSocketContext();
  const { isCapturing, startCapture, stopCapture, screenStream } =
    useScreenCapture(() => {});
  const { user, authFetch } = useAuth();
  const { showUpgrade } = useUpgrade();
  const canScreenShare =
    typeof navigator?.mediaDevices?.getDisplayMedia === "function";

  // ── Deck display URL (Item A: private-bucket access) ────────────────────
  // The media bucket is private, so the deck's stored file_url (a bare object
  // path for new uploads) is NOT directly renderable.
  // Resolve a short-lived signed URL from the server once per selected deck and
  // feed that to every deck consumer. A signing failure leaves the viewer blank
  // rather than navigating an arbitrary legacy URL from a database row.
  const [deckDisplayUrl, setDeckDisplayUrl] = useState<string>("");
  // Number of pages in the deck, measured server-side from the document itself
  // (decks.page_count). This is what makes "Slide 4 of 12" real rather than a
  // frontend guess — and it is the SAME number the AI's deck context is built
  // from, so the founder's slide 4 and the panel's slide 4 are one page.
  const [deckPageCount, setDeckPageCount] = useState(0);
  const deckId = pitchConfig?.selectedDeck?.id;

  useEffect(() => {
    let cancelled = false;
    const selectedDeck = pitchConfig?.selectedDeck;
    if (!selectedDeck?.file_url) {
      setDeckDisplayUrl("");
      setDeckPageCount(0);
      return;
    }
    if (!selectedDeck.id) {
      setDeckDisplayUrl("");
      setDeckPageCount(0);
      return;
    }
    authFetch(`/api/decks/${selectedDeck.id}/signed-url`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) throw new Error(`signed-url ${res.status}`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        setDeckDisplayUrl(getDeckDisplayUrl(data?.url || ""));
        // Absent/zero means the server could not measure the document. The
        // viewer then renders the deck plainly instead of inventing slides.
        const pages = Number(data?.pageCount);
        setDeckPageCount(Number.isFinite(pages) && pages > 0 ? pages : 0);
      })
      .catch(() => {
        if (!cancelled) {
          setDeckDisplayUrl("");
          setDeckPageCount(0);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  // Final URL used by every deck consumer is always server-issued.
  const resolvedDeckUrl = deckDisplayUrl;

  const [roomState, setRoomState] = useState<
    "waiting" | "countdown" | "live" | "resume"
  >(() => {
    const rec = readResumeRecord();
    return rec && rec.endsAt > Date.now() ? "resume" : "waiting";
  });
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(() => {
    const resumeRec = readResumeRecord();
    if (resumeRec && resumeRec.endsAt > Date.now()) {
      return Math.max(1, Math.round((resumeRec.endsAt - Date.now()) / 1000));
    }
    if (location.state?.pitchConfig) {
      return (location.state.pitchConfig.duration || 15) * 60;
    }
    const saved = sessionStorage.getItem("pitchConfig");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return (parsed.duration || 15) * 60;
      } catch (e) {}
    }
    return 15 * 60;
  });

  // Live per-panelist interest (panel mode only), pushed by the server.
  const [panelInterest, setPanelInterest] = useState<Record<string, string>>(
    {},
  );

  const [mainView, setMainView] = useState<"slide" | "camera">("slide");

  // ── Deck slide position (req 5/6/10) ───────────────────────────────────────
  // One source of truth for "which slide is on screen", so the main view, the
  // thumbnail and the server all agree. 1-based, clamped by the viewer.
  const [currentSlide, setCurrentSlide] = useState(1);
  // Reset to slide 1 whenever a different deck loads.
  useEffect(() => {
    setCurrentSlide(1);
  }, [deckId]);
  // True only when the deck is a real multi-page document the server measured.
  const deckIsPaginated = canPaginateDeck(resolvedDeckUrl, deckPageCount);

  // ── Deck panel visibility (req 8) ──────────────────────────────────────────
  // Hiding the deck gives the freed space to the conversation: the main area
  // shows the founder/panel view and the transcript grows to fill the rest of
  // the column, so nothing is left blank.
  const [isDeckHidden, setIsDeckHidden] = useState(false);
  // With the deck hidden there is nothing to swap TO, so the main view is pinned
  // to the camera side without destroying the founder's swap preference.
  const effectiveMainView: "slide" | "camera" = isDeckHidden
    ? "camera"
    : mainView;

  // ── Full-screen presentation mode (req 9) ──────────────────────────────────
  // Shows only the main session view, the AI panel and the swap control. The
  // live session monitor, data chart, chat box and transcript are hidden.
  const [isFullscreen, setIsFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    // Track the real document state, not our own intent — the user can leave
    // native full-screen with Escape or the OS, and the layout must follow.
    if (!document.fullscreenElement) {
      el?.requestFullscreen?.().catch(() => {
        // Native full-screen refused (permissions, unsupported). Still switch to
        // the focused layout — that is the part the founder actually asked for.
        setIsFullscreen(true);
      });
    } else {
      document.exitFullscreen?.().catch(() => setIsFullscreen(false));
    }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const [chatInput, setChatInput] = useState("");
  const chatInputRef = useRef("");
  const [activeSpeakerName, setActiveSpeakerName] = useState("");
  const [isPitching, setIsPitching] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isSpeakingRef = useRef(false);
  // True from the moment a barge-in is detected until the next clean turn
  // boundary (turn_complete / turn_aborted). While set, any late-arriving AI
  // audio chunks are dropped so the interrupted sentence can't resume.
  const bargedInRef = useRef(false);
  // True for the WHOLE panelist turn — from the first audio chunk until the
  // turn's clean boundary (turn_complete / turn_aborted / error). A turn is
  // spoken as several back-to-back sentences, each its own TTS round-trip, so
  // `isSpeaking` briefly drops to false in the gaps between sentences. We must
  // NOT reopen the mic-to-server STT stream during those gaps, or ambient
  // noise/breathing gets transcribed mid-turn and the server treats it as a
  // barge-in, cutting the panelist off. This flag holds the echo guard closed
  // across the gaps; intentional barge-in still works via the RMS/VAD path.
  const aiTurnActiveRef = useRef(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const pulseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastAiSpeakingEndedTimeRef = useRef(0);
  const setSpeakingState = useCallback((val: boolean) => {
    setIsSpeaking(val);
    isSpeakingRef.current = val;
    if (!val) {
      lastAiSpeakingEndedTimeRef.current = Date.now();
    }
  }, []);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraMuted, setIsCameraMuted] = useState(false);

  // ── Mute is purely LOCAL (req 11) ──────────────────────────────────────────
  // Muting disables the mic track and the two upstream paths (PCM frames and the
  // STT stream) already bail on `isMicMuted`, so no muted audio reaches the AI.
  // Nothing about the mute is ever SENT: there is no "founder muted" message in
  // the protocol, and the panel must not change its behaviour because of it — it
  // simply hears silence, exactly as if the founder had stopped talking.
  //
  // The cost of that is a founder who forgets they are muted and gets no reply,
  // so after ~10s of a muted mic we tell them. (The timer effect lives further
  // down, next to the verdict state it depends on.)
  const [showUnmuteHint, setShowUnmuteHint] = useState(false);

  // ── Answer-Tips coaching layer (read-only, additive visual overlay) ────────
  // Gated behind a toggle (default ON). When OFF the avatar box behaves exactly
  // as before. This layer only OBSERVES existing conversation state — it never
  // feeds back into the panel, audio, or scoring.
  const [coachingTipsEnabled, setCoachingTipsEnabled] = useState(
    () =>
      (typeof window !== "undefined"
        ? window.localStorage?.getItem("pn_coaching_tips")
        : null) !== "off",
  );
  const [currentTip, setCurrentTip] = useState<AnswerTip | null>(null);
  // Latest AI-generated tip for the current question (server `answer_tip`). Held
  // in a ref so the socket handler can stash it the instant it arrives (often
  // while the panel is still speaking) and `turn_complete` can prefer it over the
  // local keyword card. Null = no AI tip yet → fall back to matchAnswerTip().
  const pendingAiTipRef = useRef<AnswerTip | null>(null);
  // True from a question's turn_complete until the founder (or the panel) speaks
  // again. Combined with the live VAD signal to decide whether the card shows.
  const [awaitingFounderTip, setAwaitingFounderTip] = useState(false);
  // Mirror of awaitingFounderTip for the socket handler (avoids a stale closure
  // when deciding whether a late-arriving AI tip should upgrade the live card).
  const awaitingFounderTipRef = useRef(false);
  useEffect(() => {
    awaitingFounderTipRef.current = awaitingFounderTip;
  }, [awaitingFounderTip]);

  // ── Hint visibility is SEPARATE from hint availability (req 12) ─────────────
  //
  // The bug this fixes: the card's visibility was derived entirely from
  // `awaitingFounderTip`, which is a one-shot flag — set at a question's
  // turn_complete and cleared the moment the founder starts speaking. So once the
  // founder had spoken, clicking the hint button did nothing at all until the NEXT
  // question, and the button read as broken. Worse, the next turn_complete would
  // build a fresh card, so a founder who toggled the button off and on could come
  // back to a DIFFERENT hint than the one they were reading.
  //
  // Now `currentTip` is the hint for the current question and it STAYS until a new
  // question replaces it, while this override records what the founder asked for:
  //   null  → follow the automatic behaviour (show between questions, hide while
  //           either side is speaking) — unchanged from before
  //   true  → founder pressed the button to see the hint: keep it up
  //   false → founder pressed the button to dismiss it: keep it down
  // The override resets to null when a NEW hint arrives, so the automatic rhythm
  // resumes on the next question. Toggling never re-requests or re-derives a hint,
  // which is what guarantees the founder gets the same card back.
  const [tipVisibilityOverride, setTipVisibilityOverride] = useState<
    boolean | null
  >(null);

  /**
   * The hint button — show / hide / show / hide, any number of times.
   *
   * The press is resolved against what is EFFECTIVELY visible right now (the
   * override if the founder has one, otherwise the saved preference), so the
   * button always does the opposite of what the founder currently sees. The new
   * value is persisted as the default too, which is what keeps "exam mode" (hints
   * off) sticky across sessions the way it was before.
   */
  const toggleTipVisibility = useCallback(() => {
    setTipVisibilityOverride((prev) => {
      const next = !(prev === null ? coachingTipsEnabled : prev);
      setCoachingTipsEnabled(next);
      try {
        window.localStorage?.setItem("pn_coaching_tips", next ? "on" : "off");
      } catch {}
      return next;
    });
  }, [coachingTipsEnabled]);

  /**
   * A hint always exists to show. Before the panel has asked anything there is no
   * question-specific card, so the button would otherwise appear dead on the first
   * press — the generic card is a better answer than nothing happening.
   */
  const fallbackTip = React.useMemo(() => matchAnswerTip(undefined), []);


  const [messages, setMessages] = useState<
    {
      id: string;
      text: string;
      type: "user" | "ai";
      speaker?: string;
      inputMethod?: "voice" | "chat";
      /**
       * Seconds of speech the VAD measured for this turn, or absent when it was
       * not measured (a typed answer, or a client that does not time audio).
       * Travelling on the transcript is what lets the server compute speaking
       * pace from real timing instead of leaving it permanently unknown — see
       * backend/src/utils/deliveryMetrics.ts.
       */
      speakSeconds?: number;
    }[]
  >(() => {
    const rec = readResumeRecord();
    return rec && rec.endsAt > Date.now() && Array.isArray(rec.messages)
      ? rec.messages
      : [];
  });
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ── Level A session resume (survive accidental refresh) ────────────────────
  const sessionEndsAtRef = useRef<number>(0);
  const isResumeRef = useRef(false);
  const didInitResumeRef = useRef(false);

  const persistActiveSession = useCallback(() => {
    if (!sessionEndsAtRef.current) return;
    try {
      sessionStorage.setItem(
        RESUME_KEY,
        JSON.stringify({
          v: 1,
          endsAt: sessionEndsAtRef.current,
          startedAt: pitchStartTimeRef.current,
          messages: messagesRef.current,
          mode: pitchConfig?.mode || null,
        }),
      );
    } catch {}
  }, [pitchConfig?.mode]);

  // Restore an in-progress session after a refresh. roomState/timeLeft/messages
  // are already rehydrated by the lazy initializers above; here we restore the
  // refs and flag the socket handshake so it resumes instead of greeting.
  useEffect(() => {
    if (didInitResumeRef.current) return;
    didInitResumeRef.current = true;
    const rec = readResumeRecord();
    if (!rec) return;
    if (rec.endsAt <= Date.now() || !pitchConfig) {
      try {
        sessionStorage.removeItem(RESUME_KEY);
      } catch {}
      setRoomState((s) => (s === "resume" ? "waiting" : s));
      return;
    }
    pitchStartTimeRef.current = rec.startedAt || Date.now();
    sessionEndsAtRef.current = rec.endsAt;
    isResumeRef.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the resume snapshot fresh as the transcript grows.
  useEffect(() => {
    if (!isPitching) return;
    persistActiveSession();
  }, [messages, isPitching, persistActiveSession]);

  // Once the founder starts answering (VAD glow), retire the tip so it doesn't
  // flash back during a mid-answer pause — it returns only on the NEXT question's
  // turn_complete. NOTE: we deliberately do NOT clear on `isSpeaking`. While the
  // panel speaks the card is already hidden by the `!isSpeaking` term in
  // `showCoachingTip`; clearing here would let a trailing/duplicate audio chunk
  // permanently kill an awaiting tip so it never reappears.
  useEffect(() => {
    if (isUserSpeaking) setAwaitingFounderTip(false);
  }, [isUserSpeaking]);

  // Diagnostics for the coaching layer. OFF by default — enable in the console
  // with `localStorage.setItem("pn_tips_debug","1")` then reload to see why a
  // card is/!isn't showing.
  const tipsDebug =
    typeof window !== "undefined" &&
    window.localStorage?.getItem("pn_tips_debug") === "1";
  useEffect(() => {
    if (!tipsDebug) return;
    console.log("[tips]", {
      coachingTipsEnabled,
      awaitingFounderTip,
      tip: currentTip?.term ?? null,
      isUserSpeaking,
      isSpeaking,
      isPitching,
    });
  }, [
    tipsDebug,
    coachingTipsEnabled,
    awaitingFounderTip,
    currentTip,
    isUserSpeaking,
    isSpeaking,
    isPitching,
  ]);
  const [isEvaluatingPitch, setIsEvaluatingPitch] = useState(false);
  const [isConcluding, setIsConcluding] = useState(false);
  const [isTurnComplete, setIsTurnComplete] = useState(false);
  const turnStartedRef = useRef(true);
  const [loadingStatus, setLoadingStatus] = useState(
    "Panel is grading your pitch...",
  );
  const sentReadyForSocketRef = useRef<WebSocket | null>(null);
  const sessionLockedRef = useRef(false);

  // ── Verdict phase state ──────────────────────────────────────────────────
  const [verdictPhase, setVerdictPhase] = useState(false);
  const [verdictCountdown, setVerdictCountdown] = useState(120);
  const [verdictMessages, setVerdictMessages] = useState<
    { speaker: string; text: string; verdict: "invest" | "pass" | "maybe" }[]
  >([]);
  const verdictCountdownRef = useRef<NodeJS.Timeout | null>(null);
  const verdictMaxTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Time-up safety net: when the clock hits 0 while a panelist is mid-turn we let
  // that turn finish (no silent cutoff), but if it hasn't ended within a few
  // seconds we force the close so time-up can never hang. Cleared by the terminal
  // transitions (triggerVerdictPhase / handleEndSession).
  const timeUpGraceRef = useRef<NodeJS.Timeout | null>(null);
  const verdictCompleteReceivedRef = useRef(false);
  // ────────────────────────────────────────────────────────────────────────

  const [userData, setUserData] = useState<{
    name: string;
    email?: string;
    bio?: string;
    avatarUrl?: string;
  }>({
    name: "Founder",
  });
  const [scores, setScores] = useState<{
    clarity: number | null;
    confidence: number | null;
    marketFit: number | null;
    readiness: number | null;
  }>({ clarity: null, confidence: null, marketFit: null, readiness: null });

  const [activeMobileTab, setActiveMobileTab] = useState<
    "room" | "panelists" | "vitals"
  >("room");

  // ── "Unmute to speak." after ~10s of a muted mic (req 11) ──────────────────
  // Declared here rather than beside `isMicMuted` because it reads verdictPhase.
  // Any speech we detect resets it, so the hint only ever appears when the
  // founder is genuinely inaudible to the panel.
  useEffect(() => {
    if (!isPitching || !isMicMuted || verdictPhase) {
      setShowUnmuteHint(false);
      return;
    }
    setShowUnmuteHint(false);
    const timer = setTimeout(() => setShowUnmuteHint(true), 10_000);
    return () => clearTimeout(timer);
  }, [isPitching, isMicMuted, verdictPhase]);

  // ── Tell the server which slide the founder is presenting (req 6) ──────────
  // The backend already infers a slide from what the founder SAYS; this reports
  // what they are actually LOOKING AT, which the server prefers when present. It
  // is an additive message: an older server ignores an unknown type, so nothing
  // breaks if the two sides are deployed out of step.
  const lastSentSlideRef = useRef<number | null>(null);
  useEffect(() => {
    if (!socket || !isConnected || !isPitching) return;
    if (!deckIsPaginated) return;
    if (lastSentSlideRef.current === currentSlide) return;
    lastSentSlideRef.current = currentSlide;
    try {
      socket.send(
        JSON.stringify({
          type: "deck_slide",
          slide: currentSlide,
          total: deckPageCount,
        }),
      );
    } catch {
      // A closing socket must never break slide navigation.
      lastSentSlideRef.current = null;
    }
  }, [socket, isConnected, isPitching, currentSlide, deckPageCount, deckIsPaginated]);

  // ── Attempt state for this pitch (reqs 13/16/17) ───────────────────────────
  // Display only. The server is the authority — it re-derives the count from the
  // session chain and refuses a 6th attempt at the socket handshake regardless of
  // anything this component believes.
  const [attemptState, setAttemptState] = useState<{
    attemptsUsed: number;
    attemptsRemaining: number;
    maxAttempts: number;
    canStartNewAttempt: boolean;
  } | null>(null);
  const parentSessionIdForAttempts =
    (pitchConfig as any)?.parentSessionId ?? (pitchConfig as any)?.sessionId ?? null;
  useEffect(() => {
    let cancelled = false;
    if (!parentSessionIdForAttempts) {
      setAttemptState(null);
      return;
    }
    authFetch(`/api/sessions/${parentSessionIdForAttempts}/attempts`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`attempts ${res.status}`);
        const data = await res.json().catch(() => null);
        if (cancelled || !data) return;
        setAttemptState({
          attemptsUsed: Number(data.attemptsUsed) || 0,
          attemptsRemaining: Number(data.attemptsRemaining) || 0,
          maxAttempts: Number(data.maxAttempts) || 5,
          canStartNewAttempt: !!data.canStartNewAttempt,
        });
      })
      .catch(() => {
        // Non-fatal: the badge just doesn't render. The gate is server-side.
        if (!cancelled) setAttemptState(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentSessionIdForAttempts]);

  // `attemptsUsed` counts COMPLETED attempts (a session row is only written when
  // a pitch ends), so the one being pitched right now is the next one up. A brand
  // new pitch has no parent and is therefore attempt 1.
  const liveAttemptMax = attemptState?.maxAttempts ?? 5;
  const liveAttemptNumber = attemptState
    ? Math.min(attemptState.attemptsUsed + 1, liveAttemptMax)
    : 1;

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    chatInputRef.current = chatInput;
  }, [chatInput]);

  // ── Heartbeat Interval ───────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const interval = setInterval(() => {
      // If the user has typed anything, or the microphone thinks they are speaking, send a heartbeat
      if (
        chatInputRef.current.trim().length > 0 ||
        (isCapturing && !isMicMuted)
      ) {
        socket.send(JSON.stringify({ type: "heartbeat" }));
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [socket, isCapturing, isMicMuted]);
  // ────────────────────────────────────────────────────────────────────────

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const desktopScrollRef = useRef<HTMLDivElement>(null);
  const mobileEmbeddedScrollRef = useRef<HTMLDivElement>(null);
  const mobileFullScrollRef = useRef<HTMLDivElement>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const wakeLockRef = useRef<any>(null);
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pitchStartTimeRef = useRef<number>(0);

  const ttsStreamBufferRef = useRef<string>("");
  const ttsStreamFlushTimerRef = useRef<number | null>(null);
  const ttsDidStreamSpeakRef = useRef(false);
  const isAiStreamingRef = useRef(false);
  const preferredVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const uploadPromiseRef = useRef<Promise<any> | null>(null);
  const savedSessionIdRef = useRef<string | number | null>(null);
  const pendingRecordingRef = useRef<string | null>(null);
  const attachingRecordingRef = useRef(false);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const pendingTimeoutsRef = useRef<number[]>([]);

  const attachPendingRecording = useCallback(async () => {
    const sessionId = savedSessionIdRef.current;
    const recording = pendingRecordingRef.current;
    if (!sessionId || !recording || attachingRecordingRef.current) return;
    attachingRecordingRef.current = true;
    try {
      const response = await authFetch(`/api/sessions/${sessionId}/recording`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recording }),
        keepalive: true,
      });
      if (response.ok) pendingRecordingRef.current = null;
      else console.error("Audio recording could not be attached:", response.status);
    } catch (error) {
      console.error("Audio recording attach failed:", error);
    } finally {
      attachingRecordingRef.current = false;
    }
  }, [authFetch]);

  // ── Audio streaming pipeline refs ──────────────────────────────────────
  const audioStreamContextRef = useRef<AudioContext | null>(null);
  const audioStreamProcessorRef = useRef<AudioWorkletNode | null>(null);
  const audioStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const userSpeakingStartRef = useRef<number | null>(null);
  // Adaptive VAD state (see VAD_* constants and the worklet handler below)
  const noiseFloorSamplesRef = useRef<number[]>([]);
  const vadThresholdRef = useRef<number>(VAD_MIN_THRESHOLD);
  const vadCalibratedRef = useRef(false);
  const vadLoudFrameCountRef = useRef(0);
  // Drives the "listening" glow on the user's avatar. Tracked via refs so we
  // only call setState on transitions, not on every audio frame.
  const lastLoudFrameRef = useRef(0);
  const userSpeakingUiRef = useRef(false);
  // ──────────────────────────────────────────────────────────────────────

  // ── Keep the screen awake while in the live pitch room ──────────────────
  // Pitching is hands-free (the founder is talking, not tapping), so the phone
  // would otherwise dim/lock mid-pitch. The Screen Wake Lock API holds the
  // display on. The OS auto-releases the lock when the tab is backgrounded, so
  // we re-acquire on visibilitychange. Scoped to this component only — it is
  // released on unmount, so no other screen is affected. No-ops where the API
  // is unsupported (older iOS, etc.).
  useEffect(() => {
    let cancelled = false;
    const nav = navigator as any;
    if (!nav?.wakeLock?.request) return;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        if (wakeLockRef.current) return;
        const lock = await nav.wakeLock.request("screen");
        if (cancelled) {
          lock.release().catch(() => {});
          return;
        }
        wakeLockRef.current = lock;
        lock.addEventListener?.("release", () => {
          // Cleared by the OS (e.g. tab hidden); allow re-acquiring later.
          if (wakeLockRef.current === lock) wakeLockRef.current = null;
        });
      } catch {
        // Permission/feature unavailable — silently fall back to default behavior.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      const lock = wakeLockRef.current;
      wakeLockRef.current = null;
      if (lock) lock.release?.().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices() || [];
      const isEn = (v: SpeechSynthesisVoice) =>
        (v.lang || "").toLowerCase().startsWith("en");
      preferredVoiceRef.current =
        voices.find((v) => isEn(v) && /google/i.test(v.name)) ||
        voices.find((v) => v.lang.toLowerCase() === TTS_LANG.toLowerCase()) ||
        voices.find(isEn) ||
        null;
    };
    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;
    return () => {
      try {
        window.speechSynthesis.onvoiceschanged = null;
      } catch {}
    };
  }, []);

  useEffect(() => {
    const resumeAudio = async () => {
      if (
        audioContextRef.current &&
        audioContextRef.current.state === "suspended"
      ) {
        try {
          await audioContextRef.current.resume();
        } catch (e) {
          console.error("Audio Context resume failed:", e);
        }
      }
    };
    window.addEventListener("click", resumeAudio);
    window.addEventListener("touchstart", resumeAudio);
    return () => {
      window.removeEventListener("click", resumeAudio);
      window.removeEventListener("touchstart", resumeAudio);
    };
  }, []);

  useEffect(() => {
    const storedUser = getStoredUser();
    if (storedUser) {
      try {
        setUserData(JSON.parse(storedUser));
      } catch (e) {}
    }
  }, []);

  // const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    screenStreamRef.current = screenStream;
  }, [screenStream]);

  useEffect(() => {
    return () => {
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach((track) => track.stop());
        }
        stopStream();
        stopCapture();
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }
        activeSourcesRef.current.forEach((src) => {
          try {
            src.stop();
          } catch (e) {}
        });
        activeSourcesRef.current = [];
        pendingTimeoutsRef.current.forEach((t) => clearTimeout(t));
        pendingTimeoutsRef.current = [];
        if (typeof window !== "undefined" && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        if (verdictCountdownRef.current)
          clearInterval(verdictCountdownRef.current);
        if (verdictMaxTimerRef.current)
          clearTimeout(verdictMaxTimerRef.current);
        // Cleanup audio capture pipeline
        if (audioStreamProcessorRef.current) {
          try {
            audioStreamProcessorRef.current.disconnect();
          } catch {}
          audioStreamProcessorRef.current = null;
        }
        if (audioStreamSourceRef.current) {
          try {
            audioStreamSourceRef.current.disconnect();
          } catch {}
          audioStreamSourceRef.current = null;
        }
        if (audioStreamContextRef.current) {
          try {
            audioStreamContextRef.current.close();
          } catch {}
          audioStreamContextRef.current = null;
        }
      } catch (e) {}
    };
  }, [stopStream, stopCapture]);

  useEffect(() => {
    if (desktopScrollRef.current) {
      desktopScrollRef.current.scrollTop =
        desktopScrollRef.current.scrollHeight;
    }
    if (mobileEmbeddedScrollRef.current) {
      mobileEmbeddedScrollRef.current.scrollTop =
        mobileEmbeddedScrollRef.current.scrollHeight;
    }
    if (mobileFullScrollRef.current) {
      mobileFullScrollRef.current.scrollTop =
        mobileFullScrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!isPitching || isEvaluatingPitch || isConcluding || verdictPhase)
      return;
    if (timeLeft <= 0) {
      // Time's up. Don't slam into the verdict phase on top of a panelist who is
      // still mid-turn — that overlapped the closing with an in-flight response
      // (the reported bug). Instead: start the evaluation now, mark the session
      // as concluding, and let any in-flight turn FINISH cleanly (no silent
      // cutoff). The `isConcluding && isTurnComplete && !isSpeaking` effect below
      // then transitions to verdicts/close once the panel stops speaking — the
      // same clean boundary the manual/voice End paths use. If nothing is
      // speaking right now, transition immediately.
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "prepare_evaluation",
          }),
        );
      }
      setIsConcluding(true);
      const turnInFlight =
        isSpeakingRef.current || activeSourcesRef.current.length > 0;
      if (!turnInFlight) {
        if (pitchConfig?.mode === "panel") {
          triggerVerdictPhase();
        } else {
          handleEndSession();
        }
      } else {
        // Let the current turn land, but bound the wait so a stalled turn can't
        // hang the close. If it hasn't finished in time, cut over cleanly.
        if (timeUpGraceRef.current) clearTimeout(timeUpGraceRef.current);
        timeUpGraceRef.current = setTimeout(() => {
          if (
            isSpeakingRef.current ||
            activeSourcesRef.current.length > 0
          ) {
            bargedInRef.current = true;
            stopAiAudio();
            if (socket && socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: "interrupt" }));
            }
          }
          if (pitchConfig?.mode === "panel") {
            triggerVerdictPhase();
          } else {
            handleEndSession();
          }
        }, 9000);
      }
      return;
    }
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [isPitching, timeLeft, isEvaluatingPitch, isConcluding, verdictPhase]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const stopTts = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
    } catch {}
    ttsStreamBufferRef.current = "";
    ttsDidStreamSpeakRef.current = false;
    isAiStreamingRef.current = false;
    if (ttsStreamFlushTimerRef.current) {
      window.clearTimeout(ttsStreamFlushTimerRef.current);
      ttsStreamFlushTimerRef.current = null;
    }
  }, []);

  const speakShort = useCallback((rawText: string) => {
    // Disabled to prevent double-voice bug and clash with server-streamed Azure TTS audio
    return;
  }, []);

  const flushTtsStreamBuffer = useCallback((): boolean => {
    const segment = normalizeWhitespace(ttsStreamBufferRef.current);
    if (!segment) return false;
    ttsStreamBufferRef.current = "";
    ttsDidStreamSpeakRef.current = true;
    speakShort(segment);
    return true;
  }, [speakShort]);

  const handleStartClick = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
      }
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }
    } catch (e) {
      console.error("Audio Context Unlock Failed:", e);
    }
    setRoomState("countdown");
  };

  // Resume after a refresh: re-unlock the audio context (needs this user
  // gesture per browser autoplay policy), re-sync the clock against the saved
  // absolute end time, and continue the live session without restarting.
  const handleResumeClick = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
      }
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }
    } catch (e) {
      console.error("Audio Context Unlock Failed:", e);
    }
    setTimeLeft(
      Math.max(1, Math.round((sessionEndsAtRef.current - Date.now()) / 1000)),
    );
    setRoomState("live");
    handleAutoStart(true);
  };

  useEffect(() => {
    if (roomState === "countdown") {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setRoomState("live");
        handleAutoStart();
      }
    }
  }, [roomState, countdown]);

  const handleAutoStart = async (isResume = false) => {
    let activeStream = streamRef.current || stream;
    if (!activeStream) {
      try {
        activeStream = await startStream();
      } catch (e) {
        console.error("Failed to start microphone stream:", e);
      }
    }
    if (!activeStream) {
      alert(
        "Microphone access is required for live pitch. Please allow mic permission and try again.",
      );
      setRoomState("waiting");
      return;
    }

    setIsPitching(true);
    if (!isResume) {
      pitchStartTimeRef.current = Date.now();
      sessionEndsAtRef.current =
        Date.now() + (pitchConfig?.duration || 15) * 60 * 1000;
    }
    persistActiveSession();
    if (pitchConfig?.screenShareEnabled && !isCapturing) {
      try {
        startCapture();
      } catch (e) {}
    }

    if (activeStream) {
      try {
        chunksRef.current = [];
        // AUDIO ONLY (req 1). `startStream` acquires the microphone with
        // `video: false`, so this stream carries no video track — but the audio
        // tracks are taken explicitly so that adding a camera preview later can
        // never silently begin recording the founder's video.
        const audioOnly = new MediaStream(activeStream.getAudioTracks());
        // Let the browser pick its default hardware-accelerated codec (fixes mobile stuttering/cracking)
        const recorder = new MediaRecorder(audioOnly);
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };
        recorder.start(); // start recording without timeslice to prevent continuous encoder stutter on mobile
        mediaRecorderRef.current = recorder;
        if (AUDIO_DEBUG) console.log("🎙️ Audio recording started");
      } catch (recErr) {
        console.error("❌ Failed to start MediaRecorder:", recErr);
      }
    }
  };

  useEffect(() => {
    if (
      isPitching &&
      isConnected &&
      socket &&
      socket.readyState === WebSocket.OPEN &&
      sentReadyForSocketRef.current !== socket
    ) {
      socket.send(
        JSON.stringify({
          type: "client_ready",
          // browserLanguages lets the server pick a speech locale for founders
          // who have not chosen one in Settings (inferSttLocale).
          config: {
            ...pitchConfig,
            userId: user?.id,
            browserLanguages: Array.from(navigator.languages ?? []).slice(0, 5),
          },
          ...(isResumeRef.current
            ? {
                resume: true,
              }
            : {}),
        }),
      );
      sentReadyForSocketRef.current = socket;
    }
  }, [isPitching, isConnected, socket, pitchConfig, user?.id]);

  // ── Raw PCM audio streaming to backend (Azure STT transcribes the user) ───
  useEffect(() => {
    if (!isPitching || !socket || !isConnected || isMicMuted || verdictPhase) {
      // Cleanup audio pipeline
      if (audioStreamProcessorRef.current) {
        try {
          audioStreamProcessorRef.current.disconnect();
        } catch {}
        audioStreamProcessorRef.current = null;
      }
      if (audioStreamSourceRef.current) {
        try {
          audioStreamSourceRef.current.disconnect();
        } catch {}
        audioStreamSourceRef.current = null;
      }
      if (audioStreamContextRef.current) {
        try {
          audioStreamContextRef.current.close();
        } catch {}
        audioStreamContextRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const startAudioCapture = async () => {
      const activeStream = streamRef.current || stream;
      if (AUDIO_DEBUG) console.log("Stream tracks:", activeStream?.getTracks());
      if (cancelled || !activeStream) return;
      try {
      const ctx = new AudioContext({
        latencyHint: "interactive",
      });
      audioStreamContextRef.current = ctx;
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      await ctx.audioWorklet.addModule("/pcm-processor.js");
      const source = ctx.createMediaStreamSource(activeStream);
      audioStreamSourceRef.current = source;

      const worklet = new AudioWorkletNode(ctx, "pcm-processor");
      audioStreamProcessorRef.current = worklet as any;

      worklet.port.onmessage = ({ data }) => {
        const { pcm, rms } = data;
        if (!window.firstAudioSent) {
          window.firstAudioSent = performance.now();
          if (AUDIO_DEBUG) console.log("🎤 First audio sent:", window.firstAudioSent);
        }
        if (!window._pcmCount) window._pcmCount = 0;
        window._pcmCount++;

        if (AUDIO_DEBUG && window._pcmCount % 20 === 0) {
          const view = new Int16Array(pcm);
          const sample = Array.from(view.slice(0, 8)).join(", ");
          console.log(
            `🎙 PCM chunk #${window._pcmCount} | RMS: ${rms.toFixed(3)} | bytes: ${pcm.byteLength} | sample: [${sample}]`,
          );
        }
        if (!socket || socket.readyState !== WebSocket.OPEN || verdictPhase)
          return;

        // ── Adaptive VAD ─────────────────────────────────────────────────
        // Calibrate the noise floor from the first ~1.5s of ambient frames
        // (only while the AI isn't speaking, so its echo can't inflate the
        // floor), then set the barge-in threshold relative to it.
        if (!vadCalibratedRef.current && !isSpeakingRef.current) {
          noiseFloorSamplesRef.current.push(rms);
          if (noiseFloorSamplesRef.current.length >= VAD_CALIBRATION_FRAMES) {
            const samples = noiseFloorSamplesRef.current;
            const floor = samples.reduce((a, b) => a + b, 0) / samples.length;
            vadThresholdRef.current = Math.max(
              VAD_MIN_THRESHOLD,
              floor * VAD_THRESHOLD_MULTIPLIER,
            );
            vadCalibratedRef.current = true;
            if (AUDIO_DEBUG) {
              console.log(
                `🎚 VAD calibrated — noise floor ${floor.toFixed(3)}, threshold ${vadThresholdRef.current.toFixed(3)}`,
              );
            }
          }
        }

        // Require sustained loudness across consecutive frames (debounce) so a
        // single spike (cough, door slam) can't trigger a false barge-in.
        if (rms > vadThresholdRef.current && !isMicMuted) {
          vadLoudFrameCountRef.current++;
        } else {
          vadLoudFrameCountRef.current = 0;
        }

        if (vadLoudFrameCountRef.current >= VAD_SUSTAIN_FRAMES) {
          if (!userSpeakingStartRef.current) {
            userSpeakingStartRef.current = Date.now();
          }
          const speakingDuration = Date.now() - userSpeakingStartRef.current;
          if (
            speakingDuration > VAD_BARGE_IN_MS &&
            (isSpeakingRef.current || aiTurnActiveRef.current)
          ) {
            bargedInRef.current = true; // drop any late AI audio until next turn
            aiTurnActiveRef.current = false; // founder took the floor
            stopAiAudio();
            socket.send(JSON.stringify({ type: "interrupt" }));
          }
        } else {
          userSpeakingStartRef.current = null;
        }

        // ── "Listening" glow ──────────────────────────────────────────────
        // Drive the avatar glow from the same VAD signal. A ~350ms hangover
        // keeps the glow steady through the brief gaps between words, and we
        // only setState on the on/off transition to avoid per-frame renders.
        const loud = rms > vadThresholdRef.current && !isMicMuted;
        if (loud) lastLoudFrameRef.current = Date.now();
        const speakingNow = Date.now() - lastLoudFrameRef.current < 350;
        if (speakingNow !== userSpeakingUiRef.current) {
          userSpeakingUiRef.current = speakingNow;
          setIsUserSpeaking(speakingNow);
        }

        // ── Echo guard ──────────────────────────────────────────────────
        // Do NOT stream mic audio to the server STT while the AI is speaking
        // (or just finished). Otherwise the AI's own TTS leaks through the
        // speakers, gets transcribed, and is fed back as "user" input —
        // creating a self-talking loop. Barge-in still works via the RMS/VAD
        // interrupt above, which stops the AI audio and reopens the mic.
        const sinceAiSpoke = Date.now() - lastAiSpeakingEndedTimeRef.current;
        // aiTurnActiveRef stays true across the silent gaps BETWEEN a turn's
        // sentences, so the mic never reopens to the server mid-turn.
        if (aiTurnActiveRef.current || isSpeakingRef.current || sinceAiSpoke < 700)
          return;

        // Send raw binary — no JSON, no base64
        socket.send(pcm); // ArrayBuffer sent as binary frame
      };

      const silentSink = ctx.createGain();
      silentSink.gain.value = 0;
      source.connect(worklet);
      worklet.connect(silentSink);
      silentSink.connect(ctx.destination);
      if (AUDIO_DEBUG) {
        console.log(
          `🎙 Audio capture started (${ctx.sampleRate}Hz → 16kHz PCM for Azure STT)`,
        );
      }
      } catch (err) {
        console.error("Failed to start audio capture pipeline:", err);
      }
    };

    startAudioCapture();

    return () => {
      cancelled = true;
      if (audioStreamProcessorRef.current) {
        try {
          audioStreamProcessorRef.current.disconnect();
        } catch {}
        audioStreamProcessorRef.current = null;
      }
      if (audioStreamSourceRef.current) {
        try {
          audioStreamSourceRef.current.disconnect();
        } catch {}
        audioStreamSourceRef.current = null;
      }
      if (audioStreamContextRef.current) {
        try {
          audioStreamContextRef.current.close();
        } catch {}
        audioStreamContextRef.current = null;
      }
    };
  }, [isPitching, socket, isConnected, isMicMuted, verdictPhase, stream]);

  useEffect(() => {
    if (!socket) return;
    if (AUDIO_DEBUG) {
      console.log(
        "WS state:",
        socket.readyState,
        "Is open:",
        socket.readyState === WebSocket.OPEN,
      );
    }

    const handleMessage = async (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (AUDIO_DEBUG && typeof event.data === "string") {
          console.log(
            "📨 Incoming:",
            data.type,
            data.speaker ?? "",
          );
        }

        if (
          sessionLockedRef.current &&
          data.type !== "report" &&
          data.type !== "SCORE_UPDATE"
        ) {
          return;
        }

        // Defensive guard: solo (practice) mode has no live AI, so the server
        // never generates a greeting, panel/coach turn, or verdict. If any AI
        // audio/transcript/verdict message ever arrives anyway (e.g. a future
        // server-side regression), drop it so the practice session stays silent.
        // The founder's own transcript bubble (chat_message role "user") and
        // report/score messages are intentionally left untouched.
        if (
          pitchConfig?.mode === "solo" &&
          (data.type === "audio" ||
            data.type === "transcript" ||
            data.type === "greeting" ||
            data.type === "verdict_message" ||
            data.type === "verdict_complete")
        ) {
          return;
        }

        if (data.type === "stop_audio" || data.type === "interrupt") {
          if (verdictPhase) return;
          // Only honor a stop if the AI is actually mid-turn (speaking now or
          // with audio still queued). A stray stop while the panel is idle —
          // e.g. a noise/echo-triggered STT partial between turns — must NOT
          // latch bargedIn, or it would silently drop the NEXT turn's audio
          // (panel text appears but no voice is heard).
          if (
            !isSpeakingRef.current &&
            !aiTurnActiveRef.current &&
            activeSourcesRef.current.length === 0
          ) {
            return;
          }
          // Server-initiated stop: drop any further audio for this turn too.
          bargedInRef.current = true;
          aiTurnActiveRef.current = false;
          stopAiAudio();
          return;
        }
        if (data.type === "turn_aborted") {
          // Clean boundary after a barge-in — safe to play the next turn.
          bargedInRef.current = false;
          aiTurnActiveRef.current = false; // turn over — mic may reopen
          setIsTurnComplete(true);
          turnStartedRef.current = true;
          return;
        }
        if (data.type === "turn_complete") {
          bargedInRef.current = false; // new turn boundary — resume accepting audio
          const markTurnComplete = () => {
            aiTurnActiveRef.current = false; // turn fully spoken — mic may reopen
            setIsTurnComplete(true);
            turnStartedRef.current = true;
            // ── Answer-Tips: the floor is now the founder's. Prefer the
            // AI-generated card for THIS question (server `answer_tip`, aligned
            // to the actual discussion); if it hasn't arrived (slow/failed),
            // fall back to the local keyword card so a tip is always present.
            // Read-only — it never signals the panel.
            const lastAi = [...messagesRef.current]
              .reverse()
              .find(
                (m) =>
                  m.type === "ai" &&
                  m.speaker !== "System" &&
                  !m.text.startsWith("[Verdict]"),
              );
            const aiTip = pendingAiTipRef.current;
            pendingAiTipRef.current = null; // consumed for this turn
            const matched = aiTip || matchAnswerTip(lastAi?.text);
            if (window.localStorage?.getItem("pn_tips_debug") === "1") {
              console.log("[tips] turn_complete → awaiting", {
                tip: matched.term,
                source: aiTip ? "ai" : "keyword",
              });
            }
            setCurrentTip(matched);
            setAwaitingFounderTip(true);
            // A NEW question means a new hint, so the founder's show/hide choice
            // for the previous one no longer applies — hand control back to the
            // automatic rhythm. (An `answer_tip` arriving later refines the card
            // for THIS question and deliberately leaves the choice alone.)
            setTipVisibilityOverride(null);
          };
          if (
            !audioContextRef.current ||
            activeSourcesRef.current.length === 0
          ) {
            markTurnComplete();
            return;
          }
          const remainingMs = Math.max(
            0,
            (nextStartTimeRef.current - audioContextRef.current.currentTime) *
              1000 +
              150,
          );
          window.setTimeout(markTurnComplete, remainingMs);
          return;
        }

        // ── AI-powered answer tip for the current question ─────────────
        // Arrives (usually) while the panel is still speaking. Stash it so the
        // upcoming turn_complete prefers it over the keyword card. If the
        // founder's floor is already open (tip arrived late), upgrade the
        // visible card in place. Purely additive — never blocks anything.
        if (data.type === "answer_tip" && (data.term || data.tip)) {
          const aiTip: AnswerTip = {
            term: data.term || "Answer Tip",
            definition: data.definition || "",
            tip: data.tip || "",
            patterns: [],
          };
          if (awaitingFounderTipRef.current) {
            setCurrentTip(aiTip);
          } else {
            pendingAiTipRef.current = aiTip;
          }
          return;
        }

        // ── Live panel interest states (panel mode only) ─────────────────
        if (data.type === "panel_interest" && data.states) {
          setPanelInterest(data.states);
          return;
        }

        // ── Server clock sync — corrects drift from background-tab
        // throttling. Server clock is authoritative for AI time metadata;
        // this keeps the visible countdown within a few seconds of it. ──
        if (data.type === "time_sync") {
          const serverLeft = Number(data.timeLeftSeconds);
          if (Number.isFinite(serverLeft) && serverLeft >= 0) {
            setTimeLeft((prev) =>
              Math.abs(prev - serverLeft) > 3 ? serverLeft : prev,
            );
          }
          return;
        }

        // ── Handle verdict_message from server ─────────────────────────

        if (data.type === "verdict_message" && data.speaker && data.text) {
          const verdictValue: "invest" | "pass" | "maybe" =
            data.verdict === "invest"
              ? "invest"
              : data.verdict === "pass"
                ? "pass"
                : "maybe";
          setVerdictMessages((prev) => [
            ...prev,
            { speaker: data.speaker, text: data.text, verdict: verdictValue },
          ]);
          setMessages((prev) => [
            ...prev,
            {
              id: nextMessageId("verdict"),
              text: `[Verdict] ${data.text}`,
              type: "ai",
              speaker: data.speaker,
            },
          ]);
          return;
        }

        // ── All verdicts done — wait for audio to finish, then end session ─
        if (data.type === "verdict_complete") {
          verdictCompleteReceivedRef.current = true;
          if (activeSourcesRef.current.length === 0) {
            setTimeout(() => {
              setVerdictPhase(false);
              handleEndSession();
            }, 1500);
          }
          return;
        }

        if (data.type === "chat_message") {
          setMessages((prev) => [
            ...prev,
            {
              id: `chat-${Date.now()}`,
              text: data.text,
              type: data.role === "user" ? "user" : "ai",
              speaker:
                data.speaker ||
                (data.role === "user" ? userData.name : "System"),
              inputMethod: data.inputMethod || "voice",
            },
          ]);
          return;
        }

        if (data.type === "transcript" && data.text) {
          const speaker = data.speaker || "Marcus";
          setActiveSpeakerName(speaker);
          setMessages((prev) => {
            if (prev.length > 0 && !turnStartedRef.current) {
              const last = prev[prev.length - 1];
              if (last.type === "ai" && last.speaker === speaker) {
                const updated = [...prev];
                const needsSpace =
                  last.text.length > 0 &&
                  !last.text.endsWith(" ") &&
                  !data.text.startsWith(" ");
                updated[updated.length - 1] = {
                  ...last,
                  text: last.text + (needsSpace ? " " : "") + data.text,
                };
                return updated;
              }
            }
            turnStartedRef.current = false;
            return [
              ...prev,
              {
                id: `ai-transcript-${Date.now()}`,
                text: data.text,
                type: "ai",
                speaker,
              },
            ];
          });
          return;
        }

        if (data.type === "error") {
          console.error("PitchNest server error:", data.message);

          // Paywall rejection. The server closes the socket straight after
          // this, so a chat bubble in a room that is about to disconnect would
          // never be read. Leave the room and raise the upgrade prompt instead.
          if (data.code === "PLAN_QUOTA_EXCEEDED") {
            navigate("/dashboard", { replace: true });
            showUpgrade("sessions");
            return;
          }

          // Req 14: attempt limit (close code 4006, authoritative server-side —
          // see pitchAttemptService). The founder cannot start another live
          // session for this pitch, but the pitch itself, its report, its audio
          // replay and its transcript all remain — the archive row becomes
          // read/replay/report-only. Leave the room and say exactly that (an
          // alert, matching the room's other hard-failure prompts, because the
          // chat bubble would die with the socket). The server's own message
          // distinguishes the attempt limit from an expired practice window.
          if (data.code === "PITCH_ATTEMPT_LIMIT") {
            navigate("/dashboard", { replace: true });
            alert(
              data.message ||
                "This pitch has used all its attempts. You can still replay it and read the report.",
            );
            return;
          }

          setMessages((prev) => [
            ...prev,
            {
              id: `error-${Date.now()}`,
              text: data.message || "Something went wrong with the AI session.",
              type: "ai",
              speaker: "System",
            },
          ]);
          if (
            data.code === "TTS_NOT_CONFIGURED" ||
            data.code === "TTS_FAILED" ||
            data.code === "AI_FAILED" ||
            data.code === "AI_NOT_CONFIGURED"
          ) {
            aiTurnActiveRef.current = false; // failed turn — don't strand the mic
            setSpeakingState(false);
            setIsTurnComplete(true);
          }
          return;
        }

        if (data.type === "audio") {
          // Drop late-arriving chunks from a turn the user already interrupted.
          if (bargedInRef.current) return;
          // The panel now holds the floor for this turn. Keep it held across
          // the inter-sentence gaps (see aiTurnActiveRef) so the echo guard
          // stays closed until the turn's clean boundary.
          aiTurnActiveRef.current = true;
          if (AUDIO_DEBUG) {
            console.log("received audio", {
              speaker: data.speaker ?? "",
              hasAudio: !!data.data,
              hasText: !!data.text,
            });
          }
          if (!window.firstAudioReceived) {
            window.firstAudioReceived = performance.now();

            if (AUDIO_DEBUG) {
              console.log("🔊 First audio received:", window.firstAudioReceived);
              if (typeof window.firstAudioSent === "number") {
                console.log(
                  "⏱ Total latency:",
                  window.firstAudioReceived - window.firstAudioSent,
                  "ms",
                );
              } else {
                console.log("⏱ Total latency: firstAudioSent is undefined");
              }
            }
          }
          const hasAudio = !!data.data;
          const hasText = !!data.text;
          const speaker = data.speaker || activeSpeakerName || "Marcus";

          if (hasAudio) {
            if (!audioContextRef.current) {
              try {
                audioContextRef.current = new (
                  window.AudioContext || (window as any).webkitAudioContext
                )();
              } catch (e) {
                console.error("Failed to create AudioContext:", e);
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `audio-error-${Date.now()}`,
                    text: "Audio playback is unavailable. Refresh the page and allow sound to hear the investor panel.",
                    type: "ai",
                    speaker: "System",
                  },
                ]);
                return;
              }
            }
            if (audioContextRef.current.state === "suspended") {
              await audioContextRef.current.resume();
            }

            const binaryString = atob(data.data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

            const pcmData = new Int16Array(bytes.buffer);
            const floatData = new Float32Array(pcmData.length);
            for (let i = 0; i < pcmData.length; i++)
              floatData[i] = pcmData[i] / 32768;

            const audioBuffer = audioContextRef.current.createBuffer(
              1,
              floatData.length,
              TTS_OUTPUT_SAMPLE_RATE,
            );
            audioBuffer.getChannelData(0).set(floatData);

            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);

            const currentTime = audioContextRef.current.currentTime;
            let startTime = nextStartTimeRef.current;
            if (startTime < currentTime) {
              startTime = currentTime + 0.05;
            }

            activeSourcesRef.current.push(source);
            source.start(startTime);
            nextStartTimeRef.current = startTime + audioBuffer.duration;
            setSpeakingState(true);

            source.onended = () => {
              activeSourcesRef.current = activeSourcesRef.current.filter(
                (s) => s !== source,
              );
              if (
                activeSourcesRef.current.length === 0 ||
                (audioContextRef.current &&
                  audioContextRef.current.currentTime >=
                    nextStartTimeRef.current)
              ) {
                setSpeakingState(false);
                setActiveSpeakerName("");

                if (verdictCompleteReceivedRef.current) {
                  setVerdictPhase(false);
                  handleEndSession();
                }
              }
            };

            if (hasText) {
              const delayMs = Math.max(0, (startTime - currentTime) * 1000);
              const textTimeout = window.setTimeout(() => {
                setActiveSpeakerName(speaker);
                setMessages((prev) => {
                  if (prev.length > 0) {
                    const last = prev[prev.length - 1];
                    if (last.type === "ai" && last.speaker === speaker) {
                      const updated = [...prev];
                      const needsSpace =
                        last.text.length > 0 &&
                        !last.text.endsWith(" ") &&
                        !data.text.startsWith(" ");
                      updated[updated.length - 1] = {
                        ...last,
                        text: last.text + (needsSpace ? " " : "") + data.text,
                      };
                      return updated;
                    }
                  }
                  return [
                    ...prev,
                    {
                      id: Date.now().toString(),
                      text: data.text,
                      type: "ai",
                      speaker,
                    },
                  ];
                });
                pendingTimeoutsRef.current = pendingTimeoutsRef.current.filter(
                  (t) => t !== textTimeout,
                );
              }, delayMs);
              pendingTimeoutsRef.current.push(textTimeout);
            }
          } else if (hasText) {
            setActiveSpeakerName(speaker);
            setMessages((prev) => {
              if (prev.length > 0) {
                const last = prev[prev.length - 1];
                if (last.type === "ai" && last.speaker === speaker) {
                  const updated = [...prev];
                  const needsSpace =
                    last.text.length > 0 &&
                    !last.text.endsWith(" ") &&
                    !data.text.startsWith(" ");
                  updated[updated.length - 1] = {
                    ...last,
                    text: last.text + (needsSpace ? " " : "") + data.text,
                  };
                  return updated;
                }
              }
              return [
                ...prev,
                {
                  id: Date.now().toString(),
                  text: data.text,
                  type: "ai",
                  speaker,
                },
              ];
            });
          }
        }

        // ── Voice-triggered end of session ───────────────────────────────
        // The founder asked to end out loud and the lead panelist confirmed;
        // the panel's closing remark has just finished. Run the EXACT same
        // conclusion flow as the manual End Session button (triggerConclusion),
        // so the verdict/report path is reused, never duplicated. Guarded so a
        // stray/duplicate signal can't double-trigger once we're already
        // concluding, in the verdict phase, or after the session is locked.
        if (data.type === "voice_end_session") {
          if (
            !isConcluding &&
            !verdictPhase &&
            !sessionLockedRef.current &&
            pitchConfig?.mode !== "solo"
          ) {
            triggerConclusion();
          }
          return;
        }

        if (data.type === "SCORE_UPDATE" && data.scores) {
          setScores(data.scores);
        }

        if (data.type === "idle_end") {
          setMessages((prev) => [
            ...prev,
            {
              id: `idle-${Date.now()}`,
              text: data.message || "Session ended due to inactivity.",
              type: "ai",
              speaker: "System",
            },
          ]);
          setTimeout(() => handleEndSession(), 1500);
        }

        if (data.type === "report") {
          if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
          if (statusIntervalRef.current)
            clearInterval(statusIntervalRef.current);

          savedSessionIdRef.current = data.sessionId || null;
          void attachPendingRecording();

          const finalizeNavigation = () => {
            const mockSessionDbRow = {
              id: data.sessionId,
              business_name: pitchConfig?.businessName || "My Startup",
              evaluation_report: data.data,
              created_at: new Date().toISOString(),
              video_url: "",
            };
            navigate(
              `/report${data.sessionId ? `?session=${data.sessionId}` : ""}`,
              { state: { session: mockSessionDbRow } },
            );
          };

          // Navigate immediately so user sees evaluation results without waiting for video upload
          finalizeNavigation();
        }
      } catch (err) {}
    };

    socket.addEventListener("message", handleMessage);
    return () => socket.removeEventListener("message", handleMessage);
  }, [socket, navigate, pitchConfig, activeSpeakerName, attachPendingRecording]);
  const setVideoRefThumb = useCallback(
    (el: HTMLVideoElement | null) => {
      if (el && el.srcObject !== stream) {
        el.srcObject = stream;
      }
    },
    [stream],
  );

  const setVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      if (el) {
        if (el.srcObject !== stream) {
          el.srcObject = stream;
        }
        (videoRef as any).current = el;
      }
    },
    [stream],
  );

  const setScreenRef = useCallback(
    (el: HTMLVideoElement | null) => {
      if (el) {
        el.srcObject = screenStream;
        (screenRef as any).current = el;
      }
    },
    [screenStream],
  );

  const wakeAudio = () => {
    if (audioContextRef.current?.state === "suspended")
      audioContextRef.current.resume();
  };

  const toggleCamera = () => {
    wakeAudio();
    const newMuted = !isCameraMuted;
    setIsCameraMuted(newMuted);
    if (stream) {
      stream.getVideoTracks().forEach((track) => (track.enabled = !newMuted));
    }
  };

  const toggleMic = () => {
    wakeAudio();
    const newMuted = !isMicMuted;
    setIsMicMuted(newMuted);
    if (stream) {
      stream.getAudioTracks().forEach((track) => (track.enabled = !newMuted));
    }
  };

  const toggleScreenShare = async () => {
    wakeAudio();
    if (!canScreenShare) {
      alert(
        "Screen sharing is not supported on mobile browsers. Please use a desktop browser to share your screen.",
      );
      return;
    }
    isCapturing ? stopCapture() : await startCapture();
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    wakeAudio();
    if (!chatInput.trim() || !socket || !isConnected || verdictPhase) return;

    setIsTurnComplete(false);
    setAwaitingFounderTip(false); // founder is answering via chat — retire the tip
    pendingTimeoutsRef.current.forEach((t) => clearTimeout(t));
    pendingTimeoutsRef.current = [];

    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        text: chatInput,
        type: "user",
        speaker: userData.name,
        inputMethod: "chat",
      },
    ]);
    socket.send(
      JSON.stringify({
        type: "chat_message",
        text: chatInput,
        timeLeft,
        inputMethod: "chat",
      }),
    );
    setChatInput("");
  };

  // ── Verdict phase logic ──────────────────────────────────────────────────
  const startVerdictCountdownToClose = useCallback(() => {
    // Start a 15-second countdown then auto-close after verdicts done
    let secs = 15;
    setVerdictCountdown(secs);
    if (verdictCountdownRef.current) clearInterval(verdictCountdownRef.current);
    verdictCountdownRef.current = setInterval(() => {
      secs -= 1;
      setVerdictCountdown(secs);
      if (secs <= 0) {
        if (verdictCountdownRef.current)
          clearInterval(verdictCountdownRef.current);
        setVerdictPhase(false);
        handleEndSession();
      }
    }, 1000);
  }, []);

  const triggerVerdictPhase = useCallback(() => {
    if (verdictPhase) return;
    // A clean transition happened — cancel the time-up safety fallback if armed.
    if (timeUpGraceRef.current) {
      clearTimeout(timeUpGraceRef.current);
      timeUpGraceRef.current = null;
    }
    setVerdictPhase(true);
    setIsConcluding(false);
    setVerdictMessages([]);
    setVerdictCountdown(45);
    wakeAudio();

    // Tell server to trigger sequential verdict speeches from all panelists
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "verdict_request",
          personas: pitchConfig
            ? getPersonas(pitchConfig.investorArchetype, pitchConfig.mode)
            : [],
          timeLeft: 0,
        }),
      );
    }

    // Hard max: if server never sends verdict_complete, close after 2 min
    if (verdictMaxTimerRef.current) clearTimeout(verdictMaxTimerRef.current);
    verdictMaxTimerRef.current = setTimeout(() => {
      if (verdictCountdownRef.current)
        clearInterval(verdictCountdownRef.current);
      setVerdictPhase(false);
      handleEndSession();
    }, 45000);
  }, [verdictPhase, socket, pitchConfig]);

  // Trigger verdict when isConcluding + turn is complete (manual End Session)
  const triggerConclusion = async () => {
    if (isConcluding || verdictPhase) return;

    // Cut the panel off the instant End Session is pressed. If the AI is
    // mid-sentence, silence local playback, drop its remaining buffered audio,
    // and tell the server to abort the in-flight turn — so the verdicts start
    // immediately instead of after the current point finishes. (Only latch
    // bargedIn when actually speaking; the server's turn_aborted clears it again
    // before the verdict audio, and an idle conclusion must not drop that audio.)
    if (isSpeakingRef.current || activeSourcesRef.current.length > 0) {
      bargedInRef.current = true;
      stopAiAudio();
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "interrupt" }));
      }
    }

    setIsConcluding(true);
    setIsTurnComplete(false);
    wakeAudio();
    // Kick off the evaluation NOW so it runs in parallel with the verdict
    // phase — by the time the panel finishes its verdicts, the report is
    // usually already done and the post-pitch screen appears instantly.
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "prepare_evaluation",
        }),
      );
    }
    // Panel mode only shows the verdict phase; coach/solo go straight to evaluation
    if (pitchConfig?.mode === "panel") {
      triggerVerdictPhase();
    } else {
      handleEndSession();
    }
  };
  const stopAiAudio = useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop(0);
      } catch {}
    });
    activeSourcesRef.current = [];
    pendingTimeoutsRef.current.forEach(clearTimeout);
    pendingTimeoutsRef.current = [];
    nextStartTimeRef.current = 0;
    setSpeakingState(false);
    setActiveSpeakerName("");
  }, [setSpeakingState]);

  useEffect(() => {
    if (isConcluding && isTurnComplete && !isSpeaking && !verdictPhase) {
      const timer = setTimeout(() => {
        if (!isSpeaking && !verdictPhase) {
          if (pitchConfig?.mode === "panel") {
            triggerVerdictPhase();
          } else {
            handleEndSession();
          }
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isConcluding, isTurnComplete, isSpeaking, verdictPhase]);
  // ────────────────────────────────────────────────────────────────────────

  const handleEndSession = async () => {
    if (sessionLockedRef.current) return;
    sessionLockedRef.current = true;
    // A terminal transition — cancel the time-up safety fallback if armed.
    if (timeUpGraceRef.current) {
      clearTimeout(timeUpGraceRef.current);
      timeUpGraceRef.current = null;
    }
    // Ending for real (End button / timer / verdict) — drop the resume snapshot
    // so a later reload (e.g. on the report screen) can't resume a finished pitch.
    try {
      sessionStorage.removeItem(RESUME_KEY);
    } catch {}

    // Ensure evaluation is started (no-op on the backend if already running) —
    // covers end paths that skip triggerConclusion (e.g. time-up, idle).
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "prepare_evaluation",
        }),
      );
    }

    // Stop all audio playback instantly
    stopTts();
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch (e) {}
    });
    activeSourcesRef.current = [];
    pendingTimeoutsRef.current.forEach((t) => clearTimeout(t));
    pendingTimeoutsRef.current = [];
    nextStartTimeRef.current = 0;
    setSpeakingState(false);
    setActiveSpeakerName("");

    wakeAudio();
    setIsPitching(false);
    setVerdictPhase(false);
    setIsConcluding(false);
    setIsEvaluatingPitch(true);
    setLoadingStatus("Stopping recording...");

    if (verdictCountdownRef.current) clearInterval(verdictCountdownRef.current);
    if (verdictMaxTimerRef.current) clearTimeout(verdictMaxTimerRef.current);

    const isSoloReview = pitchConfig?.mode === "solo";
    const isCoachOrSolo =
      pitchConfig?.mode === "coach" || pitchConfig?.mode === "solo";
    const statusMessages = isCoachOrSolo
      ? [
          isSoloReview
            ? "Riley is reviewing your recording..."
            : "Riley is reviewing your session...",
          "Analyzing communication and clarity...",
          "Identifying areas for improvement...",
          isSoloReview
            ? "Finalizing your practice report..."
            : "Finalizing your coaching report...",
        ]
      : [
          "Panel is grading your pitch...",
          "Analyzing delivery and clarity...",
          "Calculating investor readiness...",
          "Finalizing your report...",
        ];
    let msgIndex = 0;
    statusIntervalRef.current = setInterval(() => {
      msgIndex = (msgIndex + 1) % statusMessages.length;
      setLoadingStatus(statusMessages[msgIndex]);
    }, 4000);

    fallbackTimerRef.current = setTimeout(() => {
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
      navigate("/report");
    }, 300000);

    const stopAndEvaluate = async () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stopStream();
      }
      if (screenStream) {
        screenStream.getTracks().forEach((track) => track.stop());
      }
      if (isCapturing) stopCapture();

      setLoadingStatus("Panel is grading your pitch while audio uploads...");
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "end_session",
          }),
        );
      }

      if (chunksRef.current && chunksRef.current.length > 0) {
        const firstChunk = chunksRef.current[0] as any;
        // AUDIO ONLY (req 1). The default is an audio container now, not
        // 'video/webm' — that old fallback made a perfectly good audio recording
        // arrive at storage labelled as a video, which is what the replay page
        // then failed to play.
        const mimeType = firstChunk.type || "audio/webm";
        const extension = mimeType.includes("mp4")
          ? "m4a"
          : mimeType.includes("ogg")
            ? "ogg"
            : "webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const formData = new FormData();
        // The field name, the route and the `videoUrl` response key are all
        // historical and deliberately unchanged — the mobile client and the
        // account-purge cleanup both still speak this contract. See
        // uploadController.uploadVideo for the same note.
        formData.append("video", blob, `pitch_${Date.now()}.${extension}`);

        uploadPromiseRef.current = new Promise<void>(async (resolve) => {
          try {
            const res = await authFetch("/api/upload-video", {
              method: "POST",
              body: formData,
            });
            const data = await res.json();
            if (data.videoUrl) {
              pendingRecordingRef.current = data.videoUrl;
              void attachPendingRecording();
            }
          } catch (err) {
            console.error("Audio upload failed:", err);
          } finally {
            resolve();
          }
        });
      }

      chunksRef.current = [];
    };

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.onstop = stopAndEvaluate;
      mediaRecorderRef.current.stop();
    } else {
      stopAndEvaluate();
    }
  };

  const visiblePersonas = pitchConfig
    ? getPersonas(pitchConfig.investorArchetype, pitchConfig.mode)
    : [];

  // ── Hint card visibility (req 12) ──────────────────────────────────────────
  // AUTOMATIC: between questions the card appears on its own, and the
  // `!isUserSpeaking` term ties the hide to the same VAD signal as the glow so it
  // vanishes the instant the founder answers (no separate timer/animation delay).
  // MANUAL: a press of the hint button overrides that in either direction and
  // keeps working for the rest of the question — see toggleTipVisibility.
  const tipAutoVisible =
    coachingTipsEnabled &&
    awaitingFounderTip &&
    !!currentTip &&
    !isUserSpeaking &&
    !isSpeaking;

  const showCoachingTip =
    isPitching &&
    !verdictPhase &&
    (tipVisibilityOverride === null
      ? tipAutoVisible
      : tipVisibilityOverride && coachingTipsEnabled);

  // The card the overlay renders. Falls back to the generic hint so the button is
  // never a no-op before the panel's first question.
  const visibleTip = currentTip || fallbackTip;

  if (!pitchConfig) {
    return (
      <div className="h-screen bg-slate-900 text-white flex flex-col items-center justify-center">
        <AlertTriangle size={64} className="text-rose-500 mb-6" />
        <h2 className="text-3xl font-bold mb-3">Setup Required</h2>
        <Link
          to="/setup"
          className="px-8 py-4 bg-sky-500 text-white font-bold rounded-2xl shadow-lg"
        >
          Go to Setup
        </Link>
      </div>
    );
  }

  // ── Deck viewer component — scrollable, touch-friendly ───────────────────

  return (
    <div
      ref={rootRef}
      className="h-screen max-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-white font-sans flex flex-col relative overflow-hidden transition-colors"
    >
      <FirstTimeTour
        tourKey="live-room"
        steps={[
          { title: "You're in the room", body: "Once you start, the panel listens as you pitch. Speak naturally — they'll jump in with questions, just like a real investor meeting." },
          { title: "Answer tips between questions", body: "After each question, a quick hint shows what to focus on in your answer. Toggle tips off any time for exam mode." },
          { title: "End when you're done", body: "Hit End Session to wrap up — the panel stops, gives their verdicts, and you get a full scored report." },
        ]}
      />
      <AnimatePresence>
        {roomState !== "live" && (
          <motion.div
            exit={{ opacity: 0, scale: 1.1 }}
            className="absolute inset-0 z-100 bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center"
          >
            {roomState === "waiting" ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center flex flex-col items-center px-6"
              >
                <div className="w-20 h-20 md:w-24 md:h-24 bg-sky-500/20 text-sky-500 rounded-full flex items-center justify-center mb-5 md:mb-6 border border-sky-500/30">
                  <Mic size={40} />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 md:mb-4">
                  Ready to Pitch?
                </h2>
                <p className="text-slate-400 mb-4 max-w-md text-sm md:text-base">
                  Your microphone will activate securely when you start the
                  session.
                </p>
                <div className="flex items-start gap-2.5 mb-6 md:mb-8 max-w-md text-left px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <Volume2 size={18} className="text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-amber-200/90 text-xs md:text-sm">
                    Find a quiet place before you begin — background voices and
                    noise can interfere with how the AI hears your pitch.
                  </p>
                </div>
                <button
                  onClick={handleStartClick}
                  className="px-8 md:px-10 py-3 md:py-4 bg-sky-500 text-white font-bold rounded-2xl hover:bg-sky-600 transition-all text-lg md:text-xl shadow-[0_0_40px_rgba(14,165,233,0.3)] flex items-center gap-3 cursor-pointer"
                >
                  <Sparkles size={22} /> Enter Live Room
                </button>
              </motion.div>
            ) : roomState === "resume" ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center flex flex-col items-center px-6"
              >
                <div className="w-20 h-20 md:w-24 md:h-24 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mb-5 md:mb-6 border border-amber-500/30">
                  <Mic size={40} />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 md:mb-4">
                  Resume your pitch
                </h2>
                <p className="text-slate-400 mb-2 max-w-md text-sm md:text-base">
                  The page reloaded, but your session is still live. Your
                  transcript and timer were saved — pick up right where you left
                  off.
                </p>
                <p className="text-amber-300/90 mb-6 md:mb-8 font-mono text-lg">
                  {formatTime(timeLeft)} remaining
                </p>
                <button
                  onClick={handleResumeClick}
                  className="px-8 md:px-10 py-3 md:py-4 bg-amber-500 text-white font-bold rounded-2xl hover:bg-amber-600 transition-all text-lg md:text-xl shadow-[0_0_40px_rgba(245,158,11,0.3)] flex items-center gap-3 cursor-pointer"
                >
                  <Sparkles size={22} /> Resume session
                </button>
              </motion.div>
            ) : (
              <>
                <h2 className="text-xl md:text-2xl font-bold text-slate-400 uppercase tracking-widest mb-4 px-4 text-center">
                  Initializing AI Panel
                </h2>
                <motion.div
                  key={countdown}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.5 }}
                  className="text-8xl md:text-9xl font-black text-sky-500 drop-shadow-[0_0_40px_rgba(14,165,233,0.5)]"
                >
                  {countdown === 0 ? "PITCH!" : countdown}
                </motion.div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="px-3 md:px-6 py-2 md:py-3 flex justify-between items-center border-b border-slate-200 dark:border-white/5 bg-white/80 dark:bg-zinc-950/50 backdrop-blur-md shrink-0 z-20 transition-colors">
        <div className="flex items-center gap-2 md:gap-4">
          <LogoMark size="sm" />
          <span className="text-sm md:text-lg font-bold tracking-tight text-slate-900 dark:text-white hidden xs:inline-block">
            PitchNest
          </span>
          <div className="h-5 w-px bg-slate-200 dark:bg-white/10 mx-1 hidden sm:block" />
          <ThemeToggle />
          <div className="h-5 w-px bg-slate-200 dark:bg-white/10 mx-1 hidden sm:block" />
          <div
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-full border transition-all",
              isConnected
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : "bg-rose-500/10 text-rose-500 border-rose-500/20",
            )}
          >
            <div
              className={cn(
                "w-1.5 h-1.5 rounded-full shrink-0",
                isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500",
              )}
            />
            <span className="text-[9px] font-bold uppercase tracking-widest hidden sm:inline-block">
              {isConnected ? "Brain Connected" : "Offline"}
            </span>
          </div>

          {/* Attempt position for this pitch (req 13). Server-derived. */}
          <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-full border bg-slate-100 dark:bg-zinc-900 border-slate-200 dark:border-white/10">
            <Layers size={11} className="text-slate-400 shrink-0" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 tabular-nums">
              Attempt {liveAttemptNumber} of {liveAttemptMax}
            </span>
          </div>
        </div>

        <div
          className={cn(
            "flex items-center gap-1 px-2.5 py-1.5 rounded-full font-mono text-xs md:text-sm font-bold border transition-colors",
            timeLeft < 180
              ? "bg-rose-500/20 text-rose-500 border-rose-500/50 animate-pulse"
              : "bg-slate-100 dark:bg-zinc-900 text-slate-800 dark:text-white border-slate-200 dark:border-zinc-850",
          )}
        >
          <Timer size={12} className="shrink-0" />
          <span className="text-xs">{formatTime(timeLeft)}</span>
        </div>

        <div className="flex items-center gap-2 md:gap-3 pl-2 md:pl-6 border-l border-slate-200 dark:border-white/10">
          <div className="text-right hidden md:block">
            <p className="text-sm font-bold text-slate-800 dark:text-white truncate max-w-30">
              {userData.name}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-white/40 font-medium">
              Founder
            </p>
          </div>
          <div className="relative">
            <UserAvatar
              name={userData.name}
              avatarUrl={userData.avatarUrl}
              className="w-8 h-8 md:w-10 md:h-10 text-xs md:text-sm border-2 border-slate-200 dark:border-white/10"
            />
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* DESKTOP LAYOUT                                                  */}
      {/* ============================================================== */}
      <div className="hidden lg:flex flex-1 flex-row p-3.5 gap-4 min-h-0 overflow-hidden bg-slate-100/50 dark:bg-zinc-950 transition-colors">
        {/* LEFT COLUMN: AI Panelists */}
        <div className="w-72 shrink-0 bg-white/70 dark:bg-zinc-900/40 backdrop-blur-xl rounded-3xl p-4 flex flex-col border border-slate-200 dark:border-white/5 shadow-xl dark:shadow-2xl min-h-0 transition-colors">
          <div className="mb-4 shrink-0">
            <h3 className="text-xs font-bold text-slate-700 dark:text-white flex items-center gap-2 uppercase tracking-widest">
              {pitchConfig.mode === "solo"
                ? "Solo Practice"
                : "AI Investor Panel"}
              {isSpeaking && (
                <Sparkles className="text-sky-500 animate-pulse" size={14} />
              )}
            </h3>
            <p className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase mt-1 tracking-wider">
              {pitchConfig.mode === "solo"
                ? "No interruptions"
                : pitchConfig.investorArchetype}
            </p>
          </div>
          <div className="flex flex-col gap-2 overflow-y-auto flex-1 pr-2 custom-scrollbar">
            {pitchConfig.mode !== "solo" &&
              visiblePersonas.map((persona, idx) => (
                <AIPanelist
                  key={idx}
                  name={persona.name}
                  role={persona.role}
                  isActive={
                    isSpeaking &&
                    activeSpeakerName
                      .toLowerCase()
                      .includes(persona.name.toLowerCase())
                  }
                  interest={
                    pitchConfig.mode === "panel"
                      ? panelInterest[persona.name]
                      : undefined
                  }
                />
              ))}
            {pitchConfig.mode === "solo" && (
              <div className="p-4 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-center text-slate-500 text-xs mt-2">
                AI Interruption Disabled.
                <br /> Record your pitch uninterrupted.
              </div>
            )}
          </div>
        </div>

        {/* CENTER COLUMN */}
        <div className="flex-1 flex flex-col gap-3.5 min-h-0">
          {/* Main Viewing Area */}
          <div className="flex-1 relative border border-slate-200 dark:border-white/10 shadow-xl dark:shadow-2xl group/deck rounded-3xl min-h-0 bg-white dark:bg-zinc-900/80 overflow-hidden backdrop-blur-lg transition-colors">
            {/* Verdict phase overlay on desktop */}
            {/* Verdict status indicator (inline, not overlay) */}
            {verdictPhase && (
              <div className="absolute top-4 right-4 z-30 flex items-center gap-2 px-4 py-2 bg-sky-500/20 border border-sky-500/40 rounded-full backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                <span className="text-sky-300 text-xs font-bold uppercase tracking-widest">
                  {activeSpeakerName
                    ? `${activeSpeakerName} — Verdict`
                    : "Panel Deliberating..."}
                </span>
              </div>
            )}

            {effectiveMainView === "slide" ? (
              <div className="w-full h-full relative flex items-center justify-center rounded-3xl overflow-hidden">
                <DeckViewer
                  className="rounded-3xl"
                  isCapturing={isCapturing}
                  screenRef={setScreenRef}
                  deckUrl={resolvedDeckUrl}
                  pageCount={deckPageCount}
                  slide={currentSlide}
                  onSlideChange={setCurrentSlide}
                  /* Only the main, full-size instance owns the arrow keys —
                     the thumbnail must not react to them as well. */
                  captureKeyboard
                />
              </div>
            ) : (
              <div className="w-full h-full relative flex items-center justify-center rounded-3xl overflow-hidden">
                <CameraViewer
                  videoRef={setVideoRef}
                  stream={stream}
                  isCameraMuted={isCameraMuted}
                  isPitching={isPitching}
                  avatarUrl={userData.avatarUrl}
                  userName={userData.name}
                  isUserSpeaking={isUserSpeaking}
                />
              </div>
            )}

            {/* AWAITING_FOUNDER — Tip Card pops large over the main area
                regardless of deck/camera view. Conditionally mounted (no exit
                animation) so it vanishes the instant the founder speaks. */}
            {showCoachingTip && visibleTip && <TipCard tip={visibleTip} />}

            {/* "Unmute to speak." — the mic is muted and has been for ~10s, so
                the panel is hearing nothing (req 11). Pinned to the top edge,
                clear of the slide's fitted area. */}
            {showUnmuteHint && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 bg-rose-500/90 text-white rounded-full shadow-lg backdrop-blur-md">
                <MicOff size={14} className="shrink-0" />
                <span className="text-[11px] font-bold uppercase tracking-widest">
                  Unmute to speak.
                </span>
              </div>
            )}
          </div>

          {/*
            SESSION CONTROLS — a sibling ROW below the slide, never an overlay.
            They used to be absolutely positioned inside the main area, where on a
            smaller laptop the bar sat squarely on top of the bottom third of the
            slide. Out here they cannot cover deck content at any window size, and
            the slide keeps the whole area it is given.
          */}
          <div className="shrink-0 flex items-center justify-between gap-3 flex-wrap bg-white/95 dark:bg-zinc-900/90 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-2 rounded-2xl shadow-xl dark:shadow-2xl transition-colors">
            {/* Left group: view controls */}
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() =>
                  setMainView((v) => (v === "slide" ? "camera" : "slide"))
                }
                disabled={isDeckHidden}
                title={
                  isDeckHidden
                    ? "Show the deck to swap views"
                    : "Swap the main view between your deck and your camera"
                }
                className="px-3 h-10 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowRightLeft size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest hidden xl:inline">
                  Swap View
                </span>
              </button>

              {/* Deck panel hide/show (req 8) */}
              <button
                onClick={() => setIsDeckHidden((v) => !v)}
                title={
                  isDeckHidden
                    ? "Show the deck panel"
                    : "Hide the deck panel and give the space to the conversation"
                }
                aria-pressed={isDeckHidden}
                className={cn(
                  "px-3 h-10 rounded-xl border transition-all flex items-center gap-2 cursor-pointer",
                  isDeckHidden
                    ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30 hover:bg-sky-500/25"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-white border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-zinc-700",
                )}
              >
                {isDeckHidden ? (
                  <PanelRightOpen size={14} />
                ) : (
                  <PanelRightClose size={14} />
                )}
                <span className="text-[10px] font-bold uppercase tracking-widest hidden xl:inline">
                  {isDeckHidden ? "Show Deck" : "Hide Deck"}
                </span>
              </button>

              {/* Slide position + arrows (req 5). Lives out here with the other
                  controls so the readout never sits over the slide itself. */}
              {!isDeckHidden &&
                effectiveMainView === "slide" &&
                deckIsPaginated &&
                !isCapturing && (
                  <SlideDeckControls
                    slide={currentSlide}
                    total={deckPageCount}
                    onSlideChange={setCurrentSlide}
                    className="pl-1"
                  />
                )}
            </div>

            {/* Right group: media + session controls */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={toggleCamera}
                className={cn(
                  "w-11 h-11 rounded-xl transition-all flex items-center justify-center cursor-pointer",
                  stream && !isCameraMuted
                    ? "bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-700"
                    : "bg-rose-500/20 text-rose-500 hover:bg-rose-500/30",
                )}
              >
                {stream && !isCameraMuted ? (
                  <Video size={20} />
                ) : (
                  <VideoOff size={20} />
                )}
              </button>
              <button
                onClick={toggleMic}
                title={
                  isMicMuted
                    ? "Mic muted — the panel hears nothing. Unmute to speak."
                    : "Mute your mic (stays on this device — the panel is not told)"
                }
                className={cn(
                  "w-11 h-11 rounded-xl transition-all flex items-center justify-center cursor-pointer",
                  !isMicMuted
                    ? "bg-sky-500 text-white hover:bg-sky-600 shadow-lg shadow-sky-500/20"
                    : "bg-rose-500/20 text-rose-500 hover:bg-rose-500/30",
                  isUserSpeaking && !isMicMuted
                    ? "ring-4 ring-sky-400/60 shadow-[0_0_20px_rgba(56,189,248,0.5)]"
                    : "",
                )}
              >
                {!isMicMuted ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
              {canScreenShare && (
                <button
                  onClick={toggleScreenShare}
                  className={cn(
                    "w-11 h-11 rounded-xl transition-all flex items-center justify-center cursor-pointer",
                    isCapturing
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600"
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-700",
                  )}
                >
                  {isCapturing ? (
                    <Monitor size={20} />
                  ) : (
                    <MonitorOff size={20} />
                  )}
                </button>
              )}
              <button
                onClick={toggleTipVisibility}
                title={
                  showCoachingTip
                    ? "Hide the answer hint"
                    : "Show an answer hint for the current question"
                }
                aria-pressed={showCoachingTip}
                className={cn(
                  "w-11 h-11 rounded-xl transition-all flex items-center justify-center cursor-pointer",
                  showCoachingTip
                    ? "bg-amber-400/30 text-amber-500 ring-2 ring-amber-400/40 hover:bg-amber-400/40"
                    : coachingTipsEnabled
                      ? "bg-amber-400/15 text-amber-500 hover:bg-amber-400/25"
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 hover:bg-slate-200 dark:hover:bg-zinc-700",
                )}
              >
                <Lightbulb size={20} />
              </button>

              {/* Full-screen presentation mode (req 9) */}
              <button
                onClick={toggleFullscreen}
                title={
                  isFullscreen
                    ? "Exit full screen"
                    : "Full screen — deck and panel only"
                }
                aria-pressed={isFullscreen}
                className={cn(
                  "w-11 h-11 rounded-xl transition-all flex items-center justify-center cursor-pointer",
                  isFullscreen
                    ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 hover:bg-sky-500/25"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-700",
                )}
              >
                {isFullscreen ? (
                  <Minimize2 size={20} />
                ) : (
                  <Maximize2 size={20} />
                )}
              </button>

              <div className="w-px h-8 bg-slate-200 dark:bg-white/10 mx-1" />
              <button
                onClick={triggerConclusion}
                disabled={
                  (!isConnected && !isPitching) || isConcluding || verdictPhase
                }
                className="px-4 xl:px-6 h-11 bg-rose-500 text-white text-sm font-bold rounded-xl hover:bg-rose-600 transition-all disabled:opacity-50 shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <VolumeX size={18} />
                <span className="whitespace-nowrap">
                  {verdictPhase
                    ? "Getting Verdicts..."
                    : isConcluding
                      ? "Concluding..."
                      : "End Session"}
                </span>
              </button>
            </div>
          </div>

          {/*
            Transcript / Chat Area.
            • Full-screen (req 9) hides it entirely — the brief lists the chat box
              and transcript panel among the things NOT to show.
            • With the deck hidden (req 8) it takes the freed space instead of
              leaving a gap: `flex-1` rather than a fixed 12rem.
          */}
          {!isFullscreen && (
            <div
              className={cn(
                "bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-3xl p-4 flex flex-col border border-slate-200 dark:border-white/5 shadow-xl dark:shadow-2xl transition-colors",
                isDeckHidden ? "flex-1 min-h-0" : "h-48 shrink-0",
              )}
            >
              <div className="flex items-center gap-2 text-slate-500 dark:text-white/50 text-[10px] font-bold uppercase tracking-widest mb-2 shrink-0">
                <MessageSquare size={14} /> Chatbox & Transcript
                {isSpeaking && (
                  <span className="text-sky-500 dark:text-sky-400 animate-pulse ml-auto font-medium">
                    AI is responding...
                  </span>
                )}
              </div>
              <div
                ref={desktopScrollRef}
                className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar mb-3"
              >
                {messages.length === 0 ? (
                  <p className="text-slate-400 dark:text-white/30 text-xs text-center mt-4 font-medium tracking-wide">
                    {pitchConfig?.mode === "coach"
                      ? "Riley is ready. Start your pitch."
                      : pitchConfig?.mode === "solo"
                        ? "Practice mode is ready. Start your pitch."
                        : "AI Panel is ready. Start your pitch."}
                  </p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "flex w-full",
                        m.type === "user" ? "justify-end" : "justify-start",
                      )}
                    >
                      <div
                        className={cn(
                          "flex flex-col max-w-[80%]",
                          m.type === "user" ? "items-end" : "items-start",
                        )}
                      >
                        <span className="text-[9px] font-bold uppercase text-slate-450 dark:text-white/40 mb-1 px-1 tracking-widest">
                          {m.speaker ||
                            (m.type === "user" ? userData.name : "Panelist")}
                        </span>
                        <div
                          className={cn(
                            "p-3.5 text-sm leading-relaxed",
                            m.type === "user"
                              ? "bg-sky-500 text-white rounded-2xl rounded-tr-sm shadow-md"
                              : "bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-slate-100 rounded-2xl rounded-tl-sm border border-slate-200 dark:border-zinc-700 shadow-sm",
                          )}
                        >
                          {m.text}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <form
                onSubmit={handleSendChat}
                className={cn(
                  "flex items-center gap-3 shrink-0 mt-auto bg-slate-100/50 dark:bg-zinc-950/50 border border-slate-200 dark:border-white/10 rounded-xl p-1.5 shadow-inner",
                  verdictPhase && "opacity-50 pointer-events-none",
                )}
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={
                    verdictPhase
                      ? "Panel is giving verdicts..."
                      : "Type a message to the panel..."
                  }
                  disabled={verdictPhase}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 outline-none disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={!isConnected || verdictPhase}
                  className="px-4 py-2 bg-sky-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-sky-600 transition-colors disabled:opacity-50 shadow-md cursor-pointer"
                >
                  Send
                </button>
              </form>
            </div>
          )}
        </div>

        {/*
          RIGHT COLUMN — secondary panels.
          Full-screen mode (req 9) drops the whole column: the live session
          monitor and the data chart are exactly the "secondary/live session
          monitor" the brief says not to show while presenting. The center column
          then expands into the width on its own (it is `flex-1`).
        */}
        {!isFullscreen && (
          <div className="w-96 shrink-0 flex flex-col gap-3.5 min-h-0 overflow-y-auto custom-scrollbar pr-1">
            {/* Deck/Camera Preview (thumbnail, swaps on click). Hidden along with
                the deck panel (req 8) — with no deck there is nothing to swap. */}
            {!isDeckHidden && (
              <div
                className="h-36 shrink-0 relative shadow-xl dark:shadow-2xl border-4 border-slate-250 dark:border-white/10 rounded-3xl overflow-hidden bg-white dark:bg-zinc-900 cursor-pointer group transition-transform hover:scale-[1.02]"
                onClick={() =>
                  setMainView((v) => (v === "slide" ? "camera" : "slide"))
                }
              >
                {mainView === "camera" ? (
                  <div className="w-full h-full pointer-events-none">
                    {/* Thumbnail: same slide as the main view, no arrows and no
                        keyboard — it mirrors, it does not navigate. */}
                    <DeckViewer
                      className="rounded-3xl"
                      isCapturing={isCapturing}
                      screenRef={setScreenRef}
                      deckUrl={resolvedDeckUrl}
                      pageCount={deckPageCount}
                      slide={currentSlide}
                      showControls={false}
                    />
                  </div>
                ) : (
                  <div className="w-full h-full pointer-events-none">
                    <CameraViewer
                      videoRef={setVideoRef}
                      stream={stream}
                      isCameraMuted={isCameraMuted}
                      isPitching={isPitching}
                      avatarUrl={userData.avatarUrl}
                      userName={userData.name}
                      isUserSpeaking={isUserSpeaking}
                    />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                  <ArrowRightLeft className="text-white drop-shadow-xl" size={32} />
                  <span className="absolute bottom-4 text-[10px] font-bold uppercase tracking-widest text-white drop-shadow-lg">
                    Switch to Main Screen
                  </span>
                </div>
              </div>
            )}

            {/* Live Session Monitor */}
            <div className="bg-white/70 dark:bg-zinc-900/40 backdrop-blur-xl rounded-3xl p-4 border border-slate-200 dark:border-white/5 shadow-xl flex flex-col shrink-0 transition-colors">
              <div className="flex items-center gap-2 text-slate-500 dark:text-white/50 text-[10px] font-bold uppercase tracking-widest shrink-0 mb-2.5">
                <Activity size={14} /> Live Session Monitor
              </div>
              <h4 className="text-[11px] font-bold text-slate-700 dark:text-white/80 uppercase tracking-widest mb-3">
                Boardroom Vitals
              </h4>
              <div className="space-y-2.5">
                {[
                  {
                    label: "Brain Link",
                    val: isConnected ? "Connected" : "Offline",
                    active: isConnected,
                  },
                  {
                    label: "Audio Pipeline",
                    val: stream && !isMicMuted ? "Active" : "Muted",
                    active: !!(stream && !isMicMuted),
                  },
                  {
                    label: "Vision Input",
                    val: stream ? "Active" : "Disabled",
                    active: !!stream,
                  },
                  {
                    label: "Interactive Sharing",
                    val: isCapturing ? "Casting" : "Inactive",
                    active: isCapturing,
                    amber: true,
                  },
                ].map(({ label, val, active, amber }) => (
                  <div
                    key={label}
                    className="flex justify-between items-center text-sm"
                  >
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      {label}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider",
                        amber
                          ? active
                            ? "text-amber-500 dark:text-amber-400"
                            : "text-slate-400 dark:text-slate-500"
                          : active
                            ? "text-emerald-500 dark:text-emerald-450"
                            : "text-rose-500 dark:text-rose-455",
                      )}
                    >
                      {val}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Data Chart — live analytics coming soon (placeholder, not fake data) */}
            <div className="bg-white/70 dark:bg-zinc-900/40 backdrop-blur-xl rounded-3xl p-4 border border-slate-200 dark:border-white/5 flex flex-col shadow-xl min-h-31.25 transition-colors">
              <h4 className="text-[11px] font-bold text-slate-700 dark:text-white/80 uppercase tracking-widest mb-3">
                Data Chart
              </h4>
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center py-3">
                <Activity size={22} className="text-slate-300 dark:text-white/20" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/40">
                  Coming soon
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MOBILE & TABLET LAYOUT                                         */}
      {/* ============================================================== */}
      <div className="flex lg:hidden flex-1 flex-col min-h-0 overflow-hidden bg-slate-100/50 dark:bg-zinc-950 transition-colors">
        {/* Tab 1: Room */}
        {activeMobileTab === "room" && (
          <div className="flex-1 flex flex-col min-h-0 p-2 gap-2 overflow-hidden">
            {/* Video + Controls card */}
            <div className="bg-white/70 dark:bg-zinc-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-2xl p-2 flex flex-col shadow-sm shrink-0">
              {/* Screen container */}
              <div className="w-full h-[42vh] relative border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-900 overflow-hidden flex items-center justify-center">
                {/* Verdict status badge on mobile */}
                {verdictPhase && (
                  <div className="absolute top-2 right-2 z-30 flex items-center gap-1.5 px-3 py-1 bg-sky-500/20 border border-sky-500/40 rounded-full backdrop-blur-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                    <span className="text-sky-300 text-[9px] font-bold uppercase tracking-widest">
                      {activeSpeakerName
                        ? `${activeSpeakerName} — Verdict`
                        : "Deliberating..."}
                    </span>
                  </div>
                )}

                {/* Mobile keeps `mainView` directly: there is no side-by-side
                    deck panel here, so there is no hide-deck control either, and
                    the swap button must always mean something. */}
                {mainView === "slide" ? (
                  <div className="w-full h-full relative group/deck">
                    <DeckViewer
                      className="rounded-xl"
                      isCapturing={isCapturing}
                      screenRef={setScreenRef}
                      deckUrl={resolvedDeckUrl}
                      pageCount={deckPageCount}
                      slide={currentSlide}
                      onSlideChange={setCurrentSlide}
                    />
                    {/* Camera PIP */}
                    <div
                      onClick={() => setMainView("camera")}
                      className="absolute bottom-2 right-2 w-20 h-14 sm:w-28 rounded-lg border border-white/20 shadow-2xl overflow-hidden cursor-pointer z-20 hover:scale-105 transition-all bg-black/80 flex items-center justify-center"
                    >
                      <video
                        ref={setVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className={cn(
                          "w-full h-full object-cover transition-opacity duration-300",
                          stream && !isCameraMuted
                            ? "opacity-100"
                            : "opacity-0 absolute pointer-events-none",
                        )}
                      />
                      {(!stream || isCameraMuted) && (
                        <div className="flex flex-col items-center justify-center text-white/40">
                          <VideoOff size={12} />
                          <span className="text-[6px] font-bold uppercase tracking-wider mt-0.5">
                            Off
                          </span>
                        </div>
                      )}
                      {isPitching && stream && !isCameraMuted && (
                        <div className="absolute top-1 right-1 bg-rose-500 w-1.5 h-1.5 rounded-full animate-pulse" />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full relative">
                    <CameraViewer
                      videoRef={setVideoRef}
                      stream={stream}
                      isCameraMuted={isCameraMuted}
                      isPitching={isPitching}
                      avatarUrl={userData.avatarUrl}
                      userName={userData.name}
                      isUserSpeaking={isUserSpeaking}
                    />
                    {/* Slides PIP */}
                    <div
                      onClick={() => setMainView("slide")}
                      className="absolute bottom-2 right-2 w-20 h-14 sm:w-28 rounded-lg border border-white/20 shadow-2xl overflow-hidden cursor-pointer z-20 hover:scale-105 transition-all bg-black/80 flex items-center justify-center"
                    >
                      {isCapturing ? (
                        <video
                          ref={setScreenRef}
                          autoPlay
                          muted
                          playsInline
                          className="w-full h-full object-contain pointer-events-none"
                        />
                      ) : pitchConfig.selectedDeck ? (
                        // Mirrors the main view's slide rather than showing the
                        // whole scrolling document at thumbnail size.
                        <div className="w-full h-full pointer-events-none opacity-80">
                          <DeckViewer
                            deckUrl={resolvedDeckUrl}
                            pageCount={deckPageCount}
                            slide={currentSlide}
                            showControls={false}
                          />
                        </div>
                      ) : (
                        <MonitorOff size={14} className="text-white/40" />
                      )}
                    </div>
                  </div>
                )}

                {/* AWAITING_FOUNDER — Tip Card over the mobile main area. */}
                {showCoachingTip && visibleTip && <TipCard tip={visibleTip} />}

                {/* Req 11: the mic mute is local, so nothing tells the panel the
                    founder is muted. This is what tells the FOUNDER. */}
                {showUnmuteHint && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/90 text-white rounded-full shadow-lg backdrop-blur-md">
                    <MicOff size={11} className="shrink-0" />
                    <span className="text-[9px] font-bold uppercase tracking-widest">
                      Unmute to speak.
                    </span>
                  </div>
                )}

                <button
                  onClick={() =>
                    setMainView((v) => (v === "slide" ? "camera" : "slide"))
                  }
                  className="absolute top-2 left-2 px-2 py-1 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 rounded-lg text-white transition-all z-20 flex items-center gap-1 shadow-md cursor-pointer"
                >
                  <ArrowRightLeft size={10} />
                  <span className="text-[8px] font-bold uppercase tracking-wider">
                    Swap
                  </span>
                </button>
              </div>

              {/*
                Slide position + arrows, OUTSIDE the slide surface (req 7). On a
                phone the surface is small enough that an overlaid control would
                cover a meaningful part of the slide, so the canonical readout
                lives in its own strip under it.
              */}
              {mainView === "slide" && deckIsPaginated && !isCapturing && (
                <SlideDeckControls
                  slide={currentSlide}
                  total={deckPageCount}
                  onSlideChange={setCurrentSlide}
                  className="mt-2"
                  compact
                />
              )}

              {/* Controls row */}
              <div className="flex items-center justify-center gap-2 mt-2 w-full">
                <button
                  onClick={toggleCamera}
                  className={cn(
                    "w-10 h-10 rounded-xl transition-all flex items-center justify-center cursor-pointer shrink-0",
                    stream && !isCameraMuted
                      ? "bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-white"
                      : "bg-rose-500/20 text-rose-500",
                  )}
                >
                  {stream && !isCameraMuted ? (
                    <Video size={17} />
                  ) : (
                    <VideoOff size={17} />
                  )}
                </button>
                <button
                  onClick={toggleMic}
                  title={
                    isMicMuted
                      ? "Microphone muted (local only — the panel is not told)"
                      : "Mute microphone (local only)"
                  }
                  aria-pressed={isMicMuted}
                  className={cn(
                    "w-10 h-10 rounded-xl transition-all flex items-center justify-center cursor-pointer shrink-0",
                    !isMicMuted
                      ? "bg-sky-500 text-white shadow-md shadow-sky-500/20"
                      : "bg-rose-500/20 text-rose-500",
                  )}
                >
                  {!isMicMuted ? <Mic size={17} /> : <MicOff size={17} />}
                </button>
                <button
                  onClick={toggleScreenShare}
                  className={cn(
                    "w-10 h-10 rounded-xl transition-all flex items-center justify-center cursor-pointer shrink-0",
                    isCapturing
                      ? "bg-emerald-500 text-white shadow-lg"
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-white",
                  )}
                >
                  {isCapturing ? (
                    <Monitor size={17} />
                  ) : (
                    <MonitorOff size={17} />
                  )}
                </button>
                {/* Req 12: same reusable show/hide as desktop. */}
                <button
                  onClick={toggleTipVisibility}
                  title={showCoachingTip ? "Hide hint" : "Show hint"}
                  aria-pressed={showCoachingTip}
                  className={cn(
                    "w-10 h-10 rounded-xl transition-all flex items-center justify-center cursor-pointer shrink-0",
                    showCoachingTip
                      ? "bg-amber-400 text-white shadow-md shadow-amber-400/20"
                      : coachingTipsEnabled
                        ? "bg-amber-400/20 text-amber-500"
                        : "bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500",
                  )}
                >
                  <Lightbulb size={17} />
                </button>
                <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1 shrink-0" />
                <button
                  onClick={triggerConclusion}
                  disabled={
                    (!isConnected && !isPitching) ||
                    isConcluding ||
                    verdictPhase
                  }
                  className="flex-1 min-w-0 h-10 bg-rose-500 text-white text-xs font-bold rounded-xl hover:bg-rose-600 shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 px-2"
                >
                  <VolumeX className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    {verdictPhase
                      ? "Getting Verdicts..."
                      : isConcluding
                        ? "Concluding..."
                        : "End Session"}
                  </span>
                </button>
              </div>

              <p className="text-center mt-1 text-[8px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-widest">
                {mainView === "slide"
                  ? "Tap PIP preview to swap view"
                  : "Tap PIP preview to view deck"}
              </p>
            </div>

            {/* Chat messages */}
            <div className="flex-1 min-h-0 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-slate-200 dark:border-zinc-800/50 rounded-2xl p-3 flex flex-col shadow-inner transition-colors overflow-hidden">
              <div className="flex items-center gap-2 text-slate-500 dark:text-white/50 text-[9px] font-bold uppercase tracking-widest mb-2 shrink-0">
                <MessageSquare size={12} /> Live Chat & Transcript
                {/* Attempt position (req 13) — server-derived, same numbers as
                    the desktop header badge. */}
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 tabular-nums">
                  <Layers size={9} className="text-slate-400 shrink-0" />
                  {liveAttemptNumber} of {liveAttemptMax}
                </span>
                {isSpeaking && (
                  <span className="text-sky-500 dark:text-sky-400 animate-pulse ml-auto text-[8px] font-medium">
                    AI responding...
                  </span>
                )}
              </div>
              <div
                ref={mobileEmbeddedScrollRef}
                className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-0"
              >
                {messages.length === 0 ? (
                  <p className="text-slate-400 dark:text-white/30 text-[10px] text-center mt-4 font-bold uppercase tracking-wider opacity-60">
                    {pitchConfig?.mode === "coach"
                      ? "Riley is ready. Start your pitch."
                      : pitchConfig?.mode === "solo"
                        ? "Practice mode is ready. Start your pitch."
                        : "AI Panel is ready. Start your pitch."}
                  </p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "flex w-full",
                        m.type === "user" ? "justify-end" : "justify-start",
                      )}
                    >
                      <div
                        className={cn(
                          "flex flex-col max-w-[85%]",
                          m.type === "user" ? "items-end" : "items-start",
                        )}
                      >
                        <span className="text-[8px] font-bold uppercase text-slate-400 dark:text-white/30 mb-0.5 px-1 tracking-wider">
                          {m.speaker ||
                            (m.type === "user" ? userData.name : "Panelist")}
                        </span>
                        <div
                          className={cn(
                            "p-2 text-xs leading-relaxed",
                            m.type === "user"
                              ? "bg-sky-500 text-white rounded-xl rounded-tr-sm shadow-sm"
                              : "bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-slate-100 rounded-xl rounded-tl-sm border border-slate-200 dark:border-zinc-700 shadow-sm",
                          )}
                        >
                          {m.text}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <form
                onSubmit={handleSendChat}
                className="shrink-0 mt-2 bg-slate-100/50 dark:bg-zinc-950/50 border border-slate-200 dark:border-white/10 rounded-xl p-1 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Message the panel..."
                  className="flex-1 bg-transparent border-none focus:ring-0 text-xs text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 px-2 outline-none min-w-0"
                />
                <button
                  type="submit"
                  disabled={!isConnected}
                  className="shrink-0 px-3 py-1.5 bg-sky-500 text-white font-bold text-[10px] uppercase tracking-wider rounded hover:bg-sky-600 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tab 2: Panelists */}
        {activeMobileTab === "panelists" && (
          <div className="flex-1 flex flex-col min-h-0 m-2 bg-white/70 dark:bg-zinc-900/40 backdrop-blur-xl border border-slate-200 dark:border-zinc-800/50 rounded-3xl p-4 shadow-xl transition-colors overflow-hidden h-[60vh]">
            <div className="mb-4 shrink-0">
              <h3 className="text-xs font-bold text-slate-700 dark:text-white flex items-center gap-2 uppercase tracking-widest">
                {pitchConfig.mode === "solo"
                  ? "Solo Practice"
                  : "AI Investor Panel"}
                {isSpeaking && (
                  <Sparkles className="text-sky-500 animate-pulse" size={14} />
                )}
              </h3>
              <p className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase mt-1 tracking-wider">
                {pitchConfig.mode === "solo"
                  ? "No interruptions"
                  : pitchConfig.investorArchetype}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 min-h-0">
              {pitchConfig.mode !== "solo" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 justify-items-center pb-4">
                  {visiblePersonas.map((persona, idx) => (
                    <AIPanelist
                      key={idx}
                      name={persona.name}
                      role={persona.role}
                      isActive={
                        isSpeaking &&
                        activeSpeakerName
                          .toLowerCase()
                          .includes(persona.name.toLowerCase())
                      }
                      interest={
                        pitchConfig.mode === "panel"
                          ? panelInterest[persona.name]
                          : undefined
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="p-10 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-center text-slate-500 text-xs mt-8">
                  AI Interruption Disabled.
                  <br /> Record your pitch uninterrupted.
                </div>
              )}
            </div>
            {/* Verdict messages in panelists tab when verdict phase active */}
            {verdictPhase && verdictMessages.length > 0 && (
              <div className="mt-3 shrink-0">
                <p className="text-[9px] font-bold uppercase tracking-widest text-sky-500 mb-2">
                  Verdicts
                </p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {verdictMessages.map((vm, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 bg-white/50 dark:bg-zinc-800/60 rounded-xl p-2"
                    >
                      <img
                        src={getPanelistAvatar(vm.speaker)}
                        alt={vm.speaker}
                        className="w-7 h-7 rounded-full object-cover shrink-0"
                      />
                      <div>
                        <span
                          className={cn(
                            "text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full mr-1",
                            vm.verdict === "invest"
                              ? "bg-emerald-500/20 text-emerald-500"
                              : vm.verdict === "pass"
                                ? "bg-rose-500/20 text-rose-500"
                                : "bg-amber-500/20 text-amber-500",
                          )}
                        >
                          {vm.verdict}
                        </span>
                        <span className="text-[10px] text-slate-600 dark:text-slate-300">
                          {vm.text}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Vitals */}
        {activeMobileTab === "vitals" && (
          <div className="flex-1 flex flex-col gap-3 overflow-y-auto px-2 pt-2 pb-2 custom-scrollbar min-h-0">
            <div className="bg-white/70 dark:bg-zinc-900/45 backdrop-blur-xl rounded-3xl p-4 border border-slate-200 dark:border-zinc-850 shadow-xl flex flex-col shrink-0 transition-colors">
              <div className="flex items-center gap-2 text-slate-500 dark:text-white/50 text-[10px] font-bold uppercase tracking-widest shrink-0 mb-3">
                <Activity size={14} /> Live Session Monitor
              </div>
              <h4 className="text-[11px] font-bold text-slate-700 dark:text-white/80 uppercase tracking-widest mb-3">
                Boardroom Vitals
              </h4>
              <div className="space-y-3">
                {[
                  {
                    label: "Brain Link",
                    val: isConnected ? "Connected" : "Offline",
                    active: isConnected,
                  },
                  {
                    label: "Audio Pipeline",
                    val: stream && !isMicMuted ? "Active" : "Muted",
                    active: !!(stream && !isMicMuted),
                  },
                  {
                    label: "Vision Input",
                    val: stream ? "Active" : "Disabled",
                    active: !!stream,
                  },
                  {
                    label: "Interactive Sharing",
                    val: isCapturing ? "Casting" : "Inactive",
                    active: isCapturing,
                    amber: true,
                  },
                ].map(({ label, val, active, amber }) => (
                  <div
                    key={label}
                    className="flex justify-between items-center text-sm"
                  >
                    <span className="text-slate-500 dark:text-slate-455 font-medium">
                      {label}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider",
                        amber
                          ? active
                            ? "text-amber-500 dark:text-amber-400"
                            : "text-slate-400 dark:text-slate-500"
                          : active
                            ? "text-sky-600 dark:text-sky-400"
                            : "text-rose-500 dark:text-rose-455",
                      )}
                    >
                      {val}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Data Chart — live analytics coming soon (placeholder, not fake data) */}
            <div className="bg-white/70 dark:bg-zinc-900/45 backdrop-blur-xl rounded-3xl p-4 border border-slate-200 dark:border-zinc-850 flex flex-col shadow-xl shrink-0 transition-colors">
              <h4 className="text-[11px] font-bold text-slate-700 dark:text-white/80 uppercase tracking-widest mb-3">
                Data Chart
              </h4>
              <div className="flex flex-col items-center justify-center gap-2 text-center py-6">
                <Activity size={22} className="text-slate-300 dark:text-white/20" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/40">
                  Coming soon
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MOBILE BOTTOM TAB BAR                                          */}
      {/* ============================================================== */}
      <div className="lg:hidden flex justify-around items-center bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 py-2.5 px-2 shrink-0 shadow-lg z-30 transition-colors">
        {[
          { tab: "room", icon: <Video size={19} />, label: "Room" },
          { tab: "panelists", icon: <Users size={19} />, label: "Panelists" },
          { tab: "vitals", icon: <Activity size={19} />, label: "Monitor" },
        ].map(({ tab, icon, label }) => (
          <button
            key={tab}
            onClick={() => setActiveMobileTab(tab as any)}
            className={cn(
              "flex flex-col items-center gap-0.5 cursor-pointer transition-all px-3 py-1",
              activeMobileTab === tab
                ? "text-sky-500 scale-105"
                : "text-slate-400 dark:text-zinc-500",
            )}
          >
            {icon}
            <span className="text-[9px] font-bold uppercase tracking-wider">
              {label}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {isEvaluatingPitch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-100 bg-linear-to-b from-slate-950 via-slate-900 to-zinc-950 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="relative mb-8">
              <Loader2 className="animate-spin text-sky-500" size={64} />
              <div className="absolute inset-0 animate-ping opacity-25 rounded-full border border-sky-400 scale-125" />
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-3 tracking-tight">
              {loadingStatus}
            </h2>
            <p className="text-sky-450/80 max-w-sm text-sm font-medium tracking-wide">
              Please wait while our AI panel evaluates your pitch dynamics and
              calculates readiness scoring.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
