import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import {
  FileDown, Calendar, Users, Target, Activity,
  CheckCircle2, AlertTriangle, Play, Zap, Star, TrendingUp, ShieldAlert, Loader2, RotateCcw, Lock
} from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { ChartFrame } from '../components/ChartFrame';
import { getSessionMode, MODE_LABELS, MODE_BADGE_CLASSES, verdictLabel, SENTIMENT_HEADING, SENTIMENT_ROLE_LABEL } from '../lib/sessionMode';
import { buildRepitchState } from '../lib/repitch';
import { downloadPdf, PdfDownloadError } from '../lib/downloadFile';
import { useUpgrade } from '../components/ui/UpgradeModal';
import { planCanPdf, planCanResearch } from '../lib/entitlements';

export default function PostPitchReport() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  const { authFetch, user } = useAuth();
  const { showUpgrade } = useUpgrade();
  // Entitlement comes from auth context, NOT the session payload: the live
  // room navigates here with a client-built row, so anything read off the
  // session object would be trivially forgeable. The server re-checks every
  // gate; these flags only shape what the UI offers.
  //   canPdf      — full PDF report (Prep and Pro)
  //   canResearch — live market research / room-read section (Pro only)
  const isTrial = (user as any)?.isTrial ?? true;
  const canPdf = planCanPdf(user?.plan, isTrial);
  const canResearch = planCanResearch(user?.plan, isTrial);
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(() => location.state?.session || null);
  const [isLoading, setIsLoading] = useState(() => !location.state?.session);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPDF = useCallback(async () => {
    if (!session?.id || isDownloading) return;
    // Free users never reach the request — but the server enforces this too,
    // so a bypassed button still gets a 402 rather than a report.
    if (!canPdf) { showUpgrade('pdf'); return; }
    setIsDownloading(true);
    try {
      await downloadPdf(
        () => authFetch(`/api/sessions/${session.id}/pdf`),
        `PitchNest_Report_${(session.business_name || "Pitch").replace(/\s+/g, "_")}.pdf`,
      );
    } catch (err) {
      console.error("PDF download error:", err);
      // 402 means the plan changed under us (or the button was bypassed) —
      // sell rather than showing a scary failure.
      if (err instanceof PdfDownloadError && err.status === 402) {
        showUpgrade('pdf');
      } else {
        alert("Failed to download PDF report. Please try again.");
      }
    } finally {
      setIsDownloading(false);
    }
  }, [session, authFetch, isDownloading, canPdf, showUpgrade]);


  useEffect(() => {
    // If we already have the session from navigation state, skip fetching to prevent flickering/overriding
    if (location.state?.session) {
      return;
    }

    const fetchSession = async () => {
      try {
        let url = '/api/sessions';
        if (sessionId) {
          url = `/api/sessions/${sessionId}`;
        }
        const res = await authFetch(url);
        if (res.ok) {
          const data = await res.json();
          // If we fetched the array of sessions because no ID was in query params, take the latest one
          if (Array.isArray(data)) {
            setSession(data[0] || null);
          } else {
            setSession(data);
          }
        }
      } catch (err) {
        console.error("Failed to fetch session:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSession();
  }, [sessionId]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Loader2 className="animate-spin text-sky-500" size={48} />
        <p className="text-slate-500 font-medium">Analyzing evaluation report...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-16 text-center border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl max-w-2xl mx-auto my-12">
        <Star size={48} className="mx-auto text-slate-300 dark:text-zinc-700 mb-4 animate-pulse" />
        <h3 className="text-xl font-bold mb-2">No Pitch Report Found</h3>
        <p className="text-slate-500 dark:text-zinc-500 font-medium mb-6">Complete your first pitch session to unlock real-time feedback, investor sentiment, and readiness scoring!</p>
        <Link to="/setup" className="px-6 py-2.5 bg-sky-500 text-white font-bold rounded-xl hover:bg-sky-600 transition-all inline-flex items-center gap-2 text-sm shadow-lg shadow-sky-500/25">
          <Play size={16} fill="currentColor" />
          Start Pitching
        </Link>
      </div>
    );
  }

  const report = session?.evaluation_report || {};
  const rawScores = report.scores || {};
  
  const evaluationStatus = report.evaluationStatus as string | undefined;
  const isInsufficientData =
    evaluationStatus === "insufficient_data" ||
    evaluationStatus === "failed" ||
    !rawScores ||
    Object.keys(rawScores).length === 0 ||
    Object.values(rawScores).every((v) => v === 0);
  
  const scores = {
    delivery: Number(rawScores.delivery) || 0,
    clarity: Number(rawScores.clarity) || 0,
    scalability: Number(rawScores.scalability) || 0,
    readiness: Number(rawScores.readiness) || 0,
  };
  
  const overallScore = isInsufficientData ? 0 : Math.round((scores.delivery + scores.clarity + scores.scalability + scores.readiness) / 4);

  // Re-pitch: previous attempt snapshot written by the server at end_session.
  const previousAttempt = report.previous_attempt || null;
  const previousOverall = previousAttempt ? Math.round(Number(previousAttempt.overallScore) || 0) : null;
  const scoreDelta = previousOverall !== null && !isInsufficientData ? overallScore - previousOverall : null;
  const isWeakReport = isInsufficientData || overallScore < 60;

  const strengths = Array.isArray(report.strengths) ? report.strengths : [];
  const risks = Array.isArray(report.risks) ? report.risks : [];
  const nextSteps = Array.isArray(report.next_steps) ? report.next_steps : [];
  const sentiments = Array.isArray(report.sentiments) ? report.sentiments : [];

  // ── Engagement figures ────────────────────────────────────────────────
  // Every number in the AI Engagement card is counted from the stored
  // transcript or read from the stored report. None of it is modelled, scaled,
  // or inferred. This card previously showed `risks.length + nextSteps.length + 2`
  // as "Questions Asked", `scores.readiness` relabelled as "Confidence Score",
  // and `delivery * 0.15` presented as a "Sentiment Trend" — three pieces of
  // arithmetic on unrelated fields, wearing the names of measurements.
  const transcript = Array.isArray(report.transcript) ? report.transcript : [];

  // The live-turn prompt allows AT MOST ONE question per panel turn
  // (OUTPUT_RULES in aiService), so a panel turn containing "?" is exactly one
  // question asked — this counts questions, not question marks.
  const questionsAsked = isInsufficientData
    ? 0
    : transcript.filter(
        (m: any) =>
          m && m.type !== "user" && /\?/.test(String(m.fullText || m.text || "")),
      ).length;

  // Mean of the model-scored topics, computed and rounded server-side. Real, and
  // until now it was rendered only inside the PDF.
  const topicsCovered =
    typeof report.topic_coverage_overall === "number"
      ? Math.round(report.topic_coverage_overall)
      : null;

  // How the founder's confidence moved across the session: last point minus
  // first, from the timeline the evaluation already produces and the PDF already
  // charts. Absent on older reports, which is why it is nullable rather than 0.
  const confidencePoints = Array.isArray(report.confidence_timeline)
    ? report.confidence_timeline.filter(
        (p: any) => p && typeof p.value === "number",
      )
    : [];
  const confidenceTrend =
    !isInsufficientData && confidencePoints.length >= 2
      ? Math.round(
          confidencePoints[confidencePoints.length - 1].value -
            confidencePoints[0].value,
        )
      : null;

  // Rows are assembled rather than hardcoded so a metric the session never
  // produced is omitted, instead of appearing as a zero it did not earn.
  const engagementRows: {
    label: string;
    value: string;
    tone?: "up" | "down" | "flat";
  }[] = [];
  if (!isInsufficientData) {
    engagementRows.push({ label: "Panel questions", value: String(questionsAsked) });
    if (topicsCovered !== null) {
      engagementRows.push({ label: "Topics covered", value: `${topicsCovered}%` });
    }
    if (confidenceTrend !== null) {
      engagementRows.push({
        label: "Confidence over the session",
        value:
          confidenceTrend > 0
            ? `+${confidenceTrend}`
            : confidenceTrend < 0
              ? `${confidenceTrend}`
              : "Held steady",
        tone:
          confidenceTrend > 0 ? "up" : confidenceTrend < 0 ? "down" : "flat",
      });
    }
  }

  const RADAR_DATA = [
    { subject: 'MARKET FIT', A: scores.scalability, fullMark: 100 },
    { subject: 'TECH MOAT', A: scores.clarity, fullMark: 100 },
    { subject: 'FINANCIALS', A: scores.readiness, fullMark: 100 },
    { subject: 'TEAM', A: scores.delivery, fullMark: 100 },
  ];

  const circumference = 2 * Math.PI * 40; 
  const strokeDashoffset = circumference * (1 - overallScore / 100);
  const formattedDate = session?.created_at ? new Date(session.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown Date';
  const businessName = session?.business_name || "My Startup";
  // Panel talks like investors; coach/solo talk like practice. Resolved once here.
  const sessionMode = getSessionMode(session);

  return (
    <div className="max-w-7xl mx-auto pb-20 font-sans text-slate-900 dark:text-zinc-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 text-sky-500 font-bold text-[10px] uppercase tracking-widest mb-2">
            <Activity size={14} /> Post-Pitch Report
          </div>
          <h1 className="text-4xl font-extrabold mb-3 tracking-tight">{businessName}</h1>
          <div className="flex items-center gap-3 text-sm text-slate-500 font-medium flex-wrap">
            <span className="flex items-center gap-1.5"><Calendar size={16} /> Pitch Date: {formattedDate}</span>
            <span className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
            <span className={cn("px-3 py-0.5 border rounded-full text-xs font-bold", MODE_BADGE_CLASSES[getSessionMode(session)])}>
              {MODE_LABELS[getSessionMode(session)]}
            </span>
            <span className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
            <span className={cn("px-3 py-0.5 rounded-full text-xs font-bold", isInsufficientData ? "bg-slate-100 text-slate-500" : overallScore >= 80 ? "bg-emerald-100 text-emerald-700" : overallScore >= 60 ? "bg-sky-100 text-sky-700" : "bg-rose-100 text-rose-700")}>
              Verdict: {isInsufficientData ? 'Incomplete' : verdictLabel(sessionMode, overallScore)}
            </span>
          </div>
        </div>
        <div className="flex flex-col md:flex-row md:flex-wrap md:justify-end gap-3 w-full md:w-auto">
          <button
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="w-full md:w-auto md:flex-none justify-center px-4 md:px-6 py-2.5 bg-sky-500 text-white font-bold rounded-xl hover:bg-sky-600 transition-all flex items-center gap-2 text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {canPdf
              ? <>{isDownloading ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />} {isDownloading ? "Generating..." : "Download Detailed Report"}</>
              : <><Lock size={16} /> Unlock Full Report</>}
          </button>
          <button
            onClick={() => navigate('/setup', { state: { repitch: buildRepitchState(session) } })}
            className="w-full md:w-auto md:flex-none justify-center px-4 md:px-6 py-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-700 transition-all flex items-center gap-2 text-sm shadow-sm"
          >
            <RotateCcw size={16} /> Pitch Again
          </button>
          <Link to="/setup" className="w-full md:w-auto md:flex-none justify-center px-4 md:px-6 py-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 font-bold rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2 text-sm shadow-sm">
            <Calendar size={16} /> Start New Session
          </Link>
        </div>
      </div>

      {isWeakReport && (
        <div className="mb-6 p-6 bg-sky-50 dark:bg-sky-900/10 border border-sky-200 dark:border-sky-900/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-slate-900 dark:text-zinc-100 mb-1">
              {isInsufficientData ? "This one was too short to score — come back and run it again." : "Fix the gaps and come back — the panel will remember this pitch."}
            </h3>
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              When you re-pitch, the panel welcomes you back and checks whether last time's weaknesses were fixed.
            </p>
          </div>
          <button
            onClick={() => navigate('/setup', { state: { repitch: buildRepitchState(session) } })}
            className="shrink-0 px-6 py-2.5 bg-sky-500 text-white font-bold rounded-xl hover:bg-sky-600 transition-all flex items-center gap-2 text-sm shadow-lg shadow-sky-500/25"
          >
            <RotateCcw size={16} /> Re-Pitch Now
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex-1 space-y-4">
              <div className="relative w-28 h-28 mb-4">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#F1F5F9" strokeWidth="6" className="dark:stroke-zinc-800" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke={isInsufficientData ? "#94A3B8" : "#0EA5E9"} strokeWidth="6" strokeDasharray="251.2" strokeDashoffset={strokeDashoffset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold">{overallScore}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase">/100</span>
                </div>
              </div>
              <h2 className="text-xl font-extrabold">Overall Pitch Score</h2>
              {scoreDelta !== null && (
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold",
                  scoreDelta >= 0
                    ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                    : "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400",
                )}>
                  <RotateCcw size={12} />
                  vs last attempt: {previousOverall} → {overallScore} ({scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta})
                </span>
              )}
              <p className="text-slate-600 dark:text-zinc-400 text-sm leading-relaxed max-w-sm">
                {report.summary || "Pitch was too short. AI could not generate a full report."}
              </p>
            </div>
            <div className="w-full md:w-64 h-64 shrink-0 flex items-center justify-center">
              {isInsufficientData ? (
                <div className="text-center text-slate-400 opacity-50">
                  <ShieldAlert size={48} className="mx-auto mb-2" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">Insufficient Data</p>
                </div>
              ) : (
                <ChartFrame>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={RADAR_DATA}>
                      <PolarGrid stroke="#E2E8F0" className="dark:stroke-zinc-800" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fontWeight: 700, fill: '#64748B' }} />
                      <Radar dataKey="A" stroke="#0EA5E9" fill="#0EA5E9" fillOpacity={0.15} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </ChartFrame>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-extrabold flex items-center gap-2 mb-4"><Users className="text-indigo-500" size={20} /> {SENTIMENT_HEADING[sessionMode]}</h3>
            {isInsufficientData ? (
               <div className="w-full p-8 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl text-center text-slate-500 text-sm font-medium">
                 {evaluationStatus === "failed"
                   ? "Evaluation could not be completed. Your session was saved — try pitching again."
                   : `Your pitch was too short to generate ${sessionMode === "panel" ? "investor sentiment" : "coaching feedback"}. Please speak for at least 2 minutes.`}
               </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-4">
                {sentiments.slice(0, 3).map((sent: any, idx: number) => (
                  <div key={idx} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center"><Target size={16} /></div>
                      <div>
                        <p className="text-sm font-bold">{sent.persona}</p>
                        <p className="text-[10px] text-slate-500">{SENTIMENT_ROLE_LABEL[sessionMode]}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed italic">"{sent.quote}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-6">
              <h3 className="text-emerald-700 dark:text-emerald-400 font-extrabold flex items-center gap-2 mb-4"><TrendingUp size={18} /> Key Strengths</h3>
              {isInsufficientData ? (
                 <p className="text-sm text-slate-500 italic">Not enough data.</p>
              ) : (
                <ul className="space-y-4">
                  {strengths.map((str: string, i: number) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-700 dark:text-zinc-300"><CheckCircle2 className="text-emerald-500 shrink-0" size={18} /> {str}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="bg-rose-50/50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 rounded-2xl p-6">
              <h3 className="text-rose-700 dark:text-rose-400 font-extrabold flex items-center gap-2 mb-4"><AlertTriangle size={18} /> Critical Risks</h3>
              {isInsufficientData ? (
                 <p className="text-sm text-slate-500 italic">Not enough data.</p>
              ) : (
                <ul className="space-y-4">
                  {risks.map((risk: string, i: number) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-700 dark:text-zinc-300"><AlertTriangle className="text-rose-500 shrink-0" size={18} /> {risk}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/*
            PAYWALL BOUNDARY. Everything above stays fully readable on the free
            plan — the score, the radar, sentiment, strengths and risks. What is
            locked is the prescriptive half: how you read the room, and what to
            do next. That is the part worth paying for, and blurring it shows
            its shape rather than hiding that it exists.
          */}
          <div className="relative">
            <div className={cn(!canResearch && "blur-[6px] select-none pointer-events-none")} aria-hidden={!canResearch}>
              {/* Read-the-room feedback — derived from the live interest timeline;
                  present only when it applies (older reports simply lack it). */}
              {typeof report.room_read_note === "string" && report.room_read_note && (
            <div
              className={cn(
                "border rounded-2xl p-5 flex items-start gap-3",
                report.room_read_note.startsWith("Good room-reading")
                  ? "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30"
                  : "bg-amber-50/60 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30",
              )}
            >
              <AlertTriangle
                size={18}
                className={cn(
                  "shrink-0 mt-0.5",
                  report.room_read_note.startsWith("Good room-reading")
                    ? "text-emerald-500"
                    : "text-amber-500",
                )}
              />
              <div>
                <p className="text-sm font-extrabold text-slate-800 dark:text-zinc-100 mb-1">
                  Reading the Room
                </p>
                <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                  {report.room_read_note}
                </p>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
            <h3 className="text-lg font-extrabold flex items-center gap-2 mb-6"><CheckCircle2 className="text-sky-500" size={20} /> Actionable Next Steps</h3>
            {isInsufficientData ? (
               <div className="w-full p-8 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl text-center text-slate-500 text-sm font-medium">
                 Complete a full pitch session to receive your personalized action plan.
               </div>
            ) : (
              <div className="space-y-4">
                {nextSteps.map((step: any, i: number) => (
                  <div key={i} className="flex items-start gap-4 p-4 border border-slate-100 dark:border-zinc-800 rounded-2xl hover:border-sky-200 transition-colors">
                    <div className={cn("w-5 h-5 rounded border mt-0.5 flex items-center justify-center shrink-0 border-slate-300 dark:border-zinc-600")}></div>
                    <div className="flex-1">
                      <p className={"text-sm font-bold text-slate-900 dark:text-zinc-100"}>{step.title}</p>
                      <p className="text-xs text-slate-500 mt-1">{step.desc}</p>
                    </div>
                    <span className={cn("text-[9px] font-bold px-2 py-1 rounded", step.priority?.toLowerCase().includes('high') ? "text-rose-600 bg-rose-100" : "text-amber-600 bg-amber-100")}>
                      {step.priority}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
            </div>

            {/* Upgrade overlay. Only rendered for free users, and only when the
                session actually produced content worth unlocking — dangling a
                paywall over an empty state would be a bait. */}
            {!canResearch && !isInsufficientData && (
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="max-w-sm w-full rounded-3xl border border-slate-200 bg-white/90 p-6 text-center shadow-xl backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-900/90">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 dark:bg-sky-500/10">
                    <Lock className="text-sky-500" size={22} strokeWidth={1.8} />
                  </div>
                  <h3 className="mb-2 text-lg font-extrabold tracking-tight text-slate-900 dark:text-zinc-100">
                    Your action plan is ready
                  </h3>
                  <p className="mb-5 text-sm leading-relaxed text-slate-500 dark:text-zinc-400">
                    {canPdf
                      ? "Upgrade to Pro to see how you read the room and your prioritised next steps."
                      : "Upgrade to Pro to see how you read the room, your prioritised next steps, and to download the full PDF report."}
                  </p>
                  <button
                    type="button"
                    onClick={() => showUpgrade('pdf')}
                    className="w-full rounded-xl bg-sky-500 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-600"
                  >
                    Upgrade to Pro
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
            <h3 className="text-sm font-extrabold flex items-center gap-2 mb-4"><Play className="text-slate-900 dark:text-white" size={16} /> Pitch Replay</h3>
            {/* Video replay is disabled for now — clean placeholder, no fake player. */}
            <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden relative mb-4 flex flex-col items-center justify-center gap-2 text-center px-4">
              <Play size={22} className="text-white/30" />
              <span className="text-white/80 text-xs font-bold">Video replay coming soon</span>
            </div>
            {/* MVP: replay coming soon — restore Link to /replay when re-enabled */}
            <div className="w-full py-3 bg-slate-50 dark:bg-zinc-800/50 text-slate-400 dark:text-zinc-500 font-bold rounded-xl text-xs flex items-center justify-center gap-2 border border-slate-100 dark:border-zinc-800 select-none cursor-default">
               Replay timeline — coming soon
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
            <h3 className="text-sm font-extrabold flex items-center gap-2 mb-6"><Zap className="text-slate-900 dark:text-white" size={16} /> AI Engagement</h3>
            {engagementRows.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Not enough was said this session to measure engagement. Run a fuller pitch and these figures will appear.
              </p>
            ) : (
              <div className="space-y-4">
                {engagementRows.map((row, i) => (
                  <div
                    key={row.label}
                    className={cn(
                      "flex justify-between items-center gap-4",
                      i < engagementRows.length - 1 && "border-b border-slate-100 dark:border-zinc-800 pb-4",
                    )}
                  >
                    <span className="text-sm text-slate-600 dark:text-zinc-400">{row.label}</span>
                    <span className={cn(
                      "text-sm font-extrabold shrink-0",
                      row.tone === "up" ? "text-emerald-500"
                        : row.tone === "down" ? "text-rose-500"
                        : row.tone === "flat" ? "text-slate-500 dark:text-zinc-400"
                        : "text-sky-500",
                    )}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pro upsell — shown only to someone who would actually gain from it.
              A Pro or trial user already holds these capabilities, so prompting
              them would be selling what they have.
              The old copy promised "PitchNest Prime" and "direct intros to
              tier-1 VCs", neither of which exists anywhere in the product, and
              told free users to "complete a full 15-minute pitch" when a free
              session is capped at 10. */}
          {!canResearch && (
            <div className={cn("bg-linear-to-br rounded-3xl p-6 text-white shadow-lg relative overflow-hidden", isInsufficientData ? "from-slate-500 to-slate-700" : "from-indigo-500 to-sky-500")}>
              <div className="relative z-10">
                <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center mb-4 absolute right-0 top-0">
                  <Star size={20} fill="currentColor" />
                </div>
                <h3 className="text-lg font-extrabold mb-2 pr-10">
                  {isInsufficientData ? "Keep practicing" : canPdf ? "Go deeper with Pro" : "Sharpen this before the real room"}
                </h3>
                <p className="text-xs text-white/90 leading-relaxed mb-6">
                  {isInsufficientData
                    ? "Nothing is scored from a session this short. Pitch for longer and the panel writes you a full report."
                    : canPdf
                      ? "You already have the PDF report. Pro adds live market research in the panel and sessions up to 40 minutes."
                      : "Pro removes the two-a-week limit, stretches sessions to 40 minutes and adds live market research to the panel."}
                </p>
                <button
                  onClick={() => showUpgrade(canPdf ? 'generic' : 'pdf')}
                  disabled={isInsufficientData}
                  className="w-full py-3 bg-white text-indigo-600 font-bold rounded-xl text-sm hover:bg-slate-50 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {canPdf ? "See what Pro adds" : "Upgrade to Pro"}
                </button>
              </div>
              <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            </div>
          )}
        </div>
      </div>

      {/* Prominent bottom-of-report download — full PDF of the report. */}
      <div className="mt-8 pt-6 border-t border-slate-200 dark:border-zinc-800 flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-md">
          {canPdf
            ? "Want the full breakdown? Download the complete report as a PDF to keep, print, or share."
            : "The PDF report — every score, every panel question, and your full transcript — is part of Pro."}
        </p>
        <button
          onClick={handleDownloadPDF}
          disabled={isDownloading}
          className="px-8 py-4 bg-sky-500 text-white font-extrabold rounded-2xl text-base hover:bg-sky-600 transition-all flex items-center gap-3 shadow-lg shadow-sky-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {canPdf ? (
            <>
              {isDownloading ? <Loader2 size={20} className="animate-spin" /> : <FileDown size={20} />}
              {isDownloading ? "Generating Report…" : "Download Detailed Report"}
            </>
          ) : (
            <><Lock size={20} /> Upgrade to Download</>
          )}
        </button>
      </div>
    </div>
  );
}