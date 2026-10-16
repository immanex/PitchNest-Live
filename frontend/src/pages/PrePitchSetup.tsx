import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { FirstTimeTour } from '../components/FirstTimeTour';
import {
  Users, Target, User, Upload, FileText, Camera, Mic, CheckCircle2,
  PlayCircle, Clock, Loader2, Monitor, Briefcase, AlignLeft, X, Lock,
  Building2, MessageSquareQuote, ShieldCheck
} from 'lucide-react';
import { listBusinesses, type Business } from '../api/businesses';
import { trackEvent } from '../lib/analytics';
import {
  createPracticeDraft,
  getPracticeDraft,
  PRACTICE_QUESTION_MAX,
} from '../api/practice';
import * as Switch from '@radix-ui/react-switch';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { cn } from '../lib/utils';
import { planDurations } from '../lib/entitlements';
import { useAuth } from '../contexts/AuthContext';
import { useUpgrade } from '../components/ui/UpgradeModal';
import { Skeleton } from '../components/Skeleton';
import { useScreenCapture } from '../hooks/useScreenCapture';

/**
 * Session lengths offered, in minutes. Free is pinned to the first; Pro gets
 * all four. Mirrors PRO_DURATIONS in backend/src/services/entitlementService.ts
 * — the server clamps regardless, so this list is presentation only.
 */
const DURATION_OPTIONS = [10, 20, 30, 40] as const;
const FREE_DURATION = 10;

const INDUSTRY_OPTIONS = [
  'SaaS & Enterprise',
  'Fintech',
  'Healthtech',
  'Consumer Social & Media',
  'E-commerce & Retail',
  'Artificial Intelligence & ML',
  'CleanTech & Sustainability',
  'Biotech & Life Sciences',
  'DeepTech & Aerospace',
  'EdTech',
  'Crypto & Web3',
  'Hardware / IoT',
  'Logistics & PropTech',
];

const STAGE_OPTIONS = ['Idea / Bootstrap', 'Pre-Seed', 'Seed', 'Series A+'];

/** Keeps a prefilled free-text value (e.g. from a business profile) selectable. */
function withCurrent(options: string[], current: string | undefined): string[] {
  return current && !options.includes(current) ? [current, ...options] : options;
}

/** The setup form's fields, prefilled from a business the founder belongs to. */
function businessSetupValues(business: Pick<Business, 'name' | 'tagline' | 'description' | 'industry' | 'stage'>) {
  const concept = [business.tagline, business.description].map((part) => part?.trim()).filter(Boolean).join('. ');
  return {
    businessName: business.name,
    description: concept,
    industry: business.industry?.trim() || '',
    fundingStage: business.stage?.trim() || '',
  };
}

const setupSchema = z.object({
  mode: z.enum(['panel', 'coach', 'solo']),
  businessName: z.string().min(2, 'Required'),
  description: z.string().min(10, 'Min 10 chars'),
  industry: z.string().min(1, 'Required'),
  investorArchetype: z.string().min(1, 'Required'),
  fundingStage: z.string().min(1, 'Required'),
  aggressiveness: z.number().min(0).max(100),
  riskAppetite: z.number().min(0).max(100),
  cameraEnabled: z.boolean(),
  micEnabled: z.boolean(),
  screenShareEnabled: z.boolean(),
  duration: z.number().min(5).max(60),
});

type SetupFormValues = z.infer<typeof setupSchema>;

const ModeCard = ({ title, icon: Icon, active, onClick }: { title: string, icon: any, active: boolean, onClick: () => void }) => (
  <button 
    type="button" onClick={onClick}
    className={cn(
      "flex-1 p-3 sm:p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1.5 text-center group h-20 sm:h-24 relative",
      active ? "border-sky-500 bg-sky-50 dark:bg-sky-500/10 shadow-sm" : "border-slate-100 dark:border-zinc-800 hover:border-slate-200 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900"
    )}
  >
    <Icon size={18} className={active ? "text-sky-500" : "text-slate-400 dark:text-zinc-500"} />
    <span className={cn("text-[10px] sm:text-[11px] font-bold uppercase tracking-wider", active ? "text-sky-900 dark:text-sky-400" : "text-slate-600 dark:text-zinc-400")}>{title}</span>
    {active && <CheckCircle2 size={12} className="absolute top-2 right-2 text-sky-500" />}
  </button>
);

export default function PrePitchSetup() {
  const location = useLocation();
  const navigate = useNavigate();
  const { authFetch, user } = useAuth();
  const { showUpgrade } = useUpgrade();
  const isTrial = (user as any)?.isTrial ?? true;
  const allowedDurations: number[] = planDurations(user?.plan, isTrial);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableDecks, setAvailableDecks] = useState<any[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<any>(null);
  const deckFileInputRef = useRef<HTMLInputElement>(null);
  /** Server-authoritative attempt state for a re-pitch (req 17). null while
   *  loading or when this is a first pitch, where the gate does not apply. */
  const [attemptState, setAttemptState] = useState<{
    canStartNewAttempt: boolean;
    attemptsUsed: number;
    maxAttempts: number;
  } | null>(null);

  // Business practice bridge. Optional: AI-first founders can practise
  // without ever creating a business. When one is chosen, submit mints a
  // short-lived practice draft so the server can verify membership and link
  // the private session to the business.
  const [searchParams] = useSearchParams();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState('');
  const [practiceQuestion, setPracticeQuestion] = useState('');
  const [bridgeError, setBridgeError] = useState('');
  const businessPrefillApplied = useRef(false);

  const handleUploadDeck = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const tempId = 'temp-' + Date.now();
    const tempDeck = {
      id: tempId,
      name: file.name.replace(/\.[^/.]+$/, ""),
      size: parseFloat((file.size / (1024 * 1024)).toFixed(2)),
      status: "DRAFT"
    };

    setAvailableDecks(prev => [tempDeck, ...prev]);
    setSelectedDeck(tempDeck);

    const formData = new FormData();
    formData.append('deck', file);

    try {
      const res = await authFetch('/api/upload-deck', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        // The server explains exactly what it rejected (file type, size);
        // surfacing that beats a generic "Upload failed".
        const reason = await res.json().catch(() => null);
        throw new Error(reason?.error || "Upload failed");
      }
      const savedDeck = await res.json();

      setAvailableDecks(prev => 
        prev.map(d => d.id === tempId ? {
          ...savedDeck,
          image: "/deck-placeholder.svg"
        } : d)
      );
      setSelectedDeck(savedDeck);
    } catch (err) {
      console.error("Failed to upload deck:", err);
      alert(err instanceof Error && err.message !== "Upload failed"
        ? err.message
        : "Failed to upload pitch deck. Please try again.");
      setAvailableDecks(prev => prev.filter(d => d.id !== tempId));
      setSelectedDeck(null);
    }
  };

  const { isCapturing, startCapture, stopCapture } = useScreenCapture((frame, index) => {});

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<SetupFormValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      mode: 'panel',
      businessName: 'My Startup',
      description: 'We are building the next generation of AI tools for enterprise.', 
      industry: 'SaaS & Enterprise',
      investorArchetype: 'Seed Stage - Venture Capital', 
      fundingStage: localStorage.getItem('pitchnest_funding_stage') || 'Pre-Seed',
      aggressiveness: 60, 
      riskAppetite: 75,
      cameraEnabled: false, // Camera is disabled for now (avoiding heavy video storage)
      micEnabled: true,
      screenShareEnabled: false,
      // 10 is the free length and a valid Pro length, so it is the safe
      // default for both tiers. A Pro user picks longer explicitly.
      duration: FREE_DURATION,
    }
  });

  const currentMode = watch('mode');
  const cameraEnabled = watch('cameraEnabled');
  const micEnabled = watch('micEnabled');
  const screenShareEnabled = watch('screenShareEnabled');
  const canScreenShare = typeof navigator?.mediaDevices?.getDisplayMedia === 'function';
  const aggressiveness = watch('aggressiveness');
  const riskAppetite = watch('riskAppetite');
  const duration = watch('duration') || FREE_DURATION;
  const industryValue = watch('industry');
  const fundingStageValue = watch('fundingStage');
  const selectedBusiness = businesses.find((business) => business.id === selectedBusinessId) || null;

  const applyBusinessValues = (values: ReturnType<typeof businessSetupValues>) => {
    if (values.businessName) setValue('businessName', values.businessName, { shouldValidate: true });
    if (values.description) setValue('description', values.description, { shouldValidate: true });
    if (values.industry) setValue('industry', values.industry, { shouldValidate: true });
    if (values.fundingStage) setValue('fundingStage', values.fundingStage, { shouldValidate: true });
    // A business's free-text industry/stage may not be a stock option yet; the
    // matching <option> only exists after the re-render, so set the selects
    // again once it does, keeping the DOM and the form value in step.
    window.setTimeout(() => {
      if (values.industry) setValue('industry', values.industry);
      if (values.fundingStage) setValue('fundingStage', values.fundingStage);
    }, 0);
  };

  const chooseBusiness = (businessId: string) => {
    setSelectedBusinessId(businessId);
    setBridgeError('');
    const business = businesses.find((item) => item.id === businessId);
    if (business) applyBusinessValues(businessSetupValues(business));
  };

  const preSelectedDeckName = location.state?.preSelectedDeck;
  // "Pitch Again": previous session's config + compact previous-attempt context
  // (built by buildRepitchState). When present, it wins over profile prefill.
  const repitch = location.state?.repitch;

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const res = await authFetch('/api/decks');
        if (res.ok) {
          const data = await res.json();
          setAvailableDecks(data);
          if (repitch?.config?.deckId || repitch?.config?.deckName) {
            // Re-select the same deck as the previous attempt if it still exists.
            setSelectedDeck(
              data.find((d: any) => d.id === repitch.config.deckId) ||
              data.find((d: any) => d.name === repitch.config.deckName) ||
              data[0] || null,
            );
          }
          else if (preSelectedDeckName) setSelectedDeck(data.find((d: any) => d.name === preSelectedDeckName) || data[0]);
          else if (data.length > 0) setSelectedDeck(data[0]);
        }
      } catch (err) {
        console.error("Failed to fetch decks:", err);
      }

      try {
        // Skip profile prefill when re-pitching — it would overwrite the
        // previous session's values applied below.
        const profileRes = repitch ? null : await authFetch('/api/profile');
        if (profileRes?.ok) {
          const profile = await profileRes.json();
          if (profile) {
            if (profile.startup_name) {
              setValue('businessName', profile.startup_name);
              localStorage.setItem('pitchnest_startup_name', profile.startup_name);
            }
            if (profile.industry) {
              setValue('industry', profile.industry);
            }
            if (profile.funding_stage) {
              setValue('fundingStage', profile.funding_stage);
              localStorage.setItem('pitchnest_funding_stage', profile.funding_stage);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch profile in PrePitchSetup:", err);
      } finally {
        // Re-pitch prefill — applied last so nothing overwrites it. Old rows
        // without a pitch_config snapshot prefill only name + mode.
        const c = repitch?.config;
        if (c) {
          if (c.mode === 'panel' || c.mode === 'coach' || c.mode === 'solo') setValue('mode', c.mode);
          if (c.businessName) setValue('businessName', c.businessName);
          if (c.description) setValue('description', c.description);
          if (c.industry) setValue('industry', c.industry);
          if (c.investorArchetype) setValue('investorArchetype', c.investorArchetype);
          if (c.fundingStage) setValue('fundingStage', c.fundingStage);
          if (typeof c.aggressiveness === 'number') setValue('aggressiveness', c.aggressiveness);
          if (typeof c.riskAppetite === 'number') setValue('riskAppetite', c.riskAppetite);
          // Only restore a duration this user may actually run. A saved config
          // from a Pro session (or from before the tiers existed) would
          // otherwise prefill a locked value and get silently clamped anyway.
          if (typeof c.duration === 'number' && allowedDurations.includes(c.duration)) {
            setValue('duration', c.duration);
          }
        }
        setIsLoading(false);
      }
    };
    fetchInitialData();
  }, [preSelectedDeckName]);

  // The live room loads on demand (App.tsx). Fetch its code while the founder
  // fills in this form, so "Enter Live Room" opens instantly. Same module as
  // the route's import, so the browser downloads it once.
  useEffect(() => {
    void import('./LivePitchRoom').catch(() => {
      // Non-fatal: the route will load it (and retry) when opened.
    });
    trackEvent({
      name: 'practice_setup_opened',
      properties: { fromBusiness: Boolean(searchParams.get('business') || searchParams.get('draft')) },
    });
  }, []);

  // The plan arrives asynchronously (/me resolves on mount and on window
  // focus), and a downgrade can land while this form is open. If the selected
  // duration is no longer permitted, snap it back so the user is never shown a
  // length the server will silently clamp.
  useEffect(() => {
    if (!allowedDurations.includes(duration)) {
      setValue('duration', allowedDurations[0]);
    }
  }, [duration, user?.plan, setValue]);

  // Load the founder's businesses, then apply any business handoff once the
  // profile / re-pitch prefill above has run: a business wins over the legacy
  // onboarding profile, but never over an explicit "Pitch Again".
  useEffect(() => {
    if (isLoading || businessPrefillApplied.current) return;
    businessPrefillApplied.current = true;
    let cancelled = false;
    (async () => {
      let list: Business[] = [];
      try {
        list = await listBusinesses(authFetch);
        if (!cancelled) setBusinesses(list);
      } catch {
        // Workspace unavailable (for example before migration 0019): the
        // founder can still practise without a business.
      }
      if (cancelled) return;

      const draftId = searchParams.get('draft');
      if (draftId) {
        try {
          const draft = await getPracticeDraft(authFetch, draftId);
          if (cancelled) return;
          setSelectedBusinessId(draft.businessId);
          if (draft.question) setPracticeQuestion(draft.question);
          setValue('mode', draft.mode);
          if (!repitch) applyBusinessValues(draft.context);
        } catch (error) {
          if (!cancelled) {
            setBridgeError(error instanceof Error ? error.message : 'This practice link has expired.');
          }
        }
        return;
      }

      const requestedBusinessId =
        searchParams.get('business') || location.state?.businessId || repitch?.config?.businessId || '';
      const business = list.find((item) => item.id === requestedBusinessId);
      if (business) {
        setSelectedBusinessId(business.id);
        if (!repitch) applyBusinessValues(businessSetupValues(business));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoading]);

  const toggleScreenShare = async (checked: boolean) => {
    if (checked) {
      const stream = await startCapture();
      setValue('screenShareEnabled', !!stream);
    } else {
      stopCapture();
      setValue('screenShareEnabled', false);
    }
  };

  // Re-pitch attempt gate (reqs 13/14/17). Ask the server whether another live
  // session may start for this pitch. This is a convenience for the UI only —
  // the authoritative gate runs at session start in restSocket, so refreshing,
  // a second tab, re-login or edited client state can never buy a 6th attempt.
  useEffect(() => {
    const parentId = repitch?.parentSessionId;
    if (!parentId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`/api/sessions/${parentId}/attempts`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setAttemptState({
            canStartNewAttempt: !!data.canStartNewAttempt,
            attemptsUsed: Number(data.attemptsUsed) || 0,
            maxAttempts: Number(data.maxAttempts) || 5,
          });
        }
      } catch (err) {
        console.error("Failed to load attempt state:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repitch?.parentSessionId]);

  const onSubmit = async (data: SetupFormValues) => {
    // Client gate mirrors the server's; if the server still refuses (a race
    // with another tab), the socket close code 4006 explains itself in-room.
    if (attemptState && !attemptState.canStartNewAttempt) {
      alert(
        `This pitch has used all ${attemptState.maxAttempts} attempts. Its report, transcript and audio replay stay available — start a new pitch to keep practising.`,
      );
      return;
    }
    setIsSubmitting(true);
    setBridgeError('');

    // Link the private session to a business through a fresh, single-use
    // draft. The server re-checks membership when the session starts.
    let practiceDraftId: string | undefined;
    if (selectedBusinessId) {
      try {
        const draft = await createPracticeDraft(authFetch, {
          businessId: selectedBusinessId,
          mode: data.mode,
          question: practiceQuestion.trim() || undefined,
        });
        practiceDraftId = draft.id;
      } catch (error) {
        setBridgeError(
          error instanceof Error
            ? `${error.message} You can also practise without linking a business.`
            : 'We could not link this business. You can practise without linking it.',
        );
        setIsSubmitting(false);
        return;
      }
    } else {
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    navigate('/room', {
      state: {
        pitchConfig: {
          ...data,
          selectedDeck,
          // Re-pitch context: lets the server verify the parent session and
          // give the panel memory of the previous attempt.
          parentSessionId: repitch?.parentSessionId,
          previousSession: repitch?.previousSession,
          // Business bridge. Only meaningful with a draft: the server ignores
          // the question unless a valid draft links this session to a business.
          ...(practiceDraftId
            ? { practiceDraftId, practiceQuestion: practiceQuestion.trim() }
            : {}),
        },
      },
    });
  };

  return (
    <div className="max-w-6xl mx-auto min-h-[calc(100vh-80px)] lg:h-[calc(100vh-80px)] flex flex-col lg:overflow-hidden pb-6 md:pb-10 px-4 lg:px-0">
      <FirstTimeTour
        tourKey="setup"
        steps={[
          { title: "Pick your mode", body: "Panel, Coach, or Solo. Below it you'll set industry, funding stage, and how tough the investors should be.", target: '[data-tour="setup-mode"]' },
          { title: "Attach a deck (optional)", body: "Select a pitch deck so the panel can reference your slides and ask sharper, more specific questions.", target: '[data-tour="setup-deck"]' },
          { title: "Start when you're ready", body: "Hit Enter Live Room to begin. You can tweak any of these settings before every session.", target: '[data-tour="setup-start"]' },
        ]}
      />
      <div className="flex items-center justify-between shrink-0 mb-6 mt-2 lg:mt-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-zinc-100">Pre-Pitch Configuration</h1>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 rounded-lg text-xs font-bold text-slate-500">
          <Clock size={14} /> {duration} Min Session
        </div>
      </div>

      {repitch && (
        <div className="shrink-0 mb-6 px-4 py-3 bg-sky-50 dark:bg-sky-900/10 border border-sky-200 dark:border-sky-900/40 rounded-xl text-sm font-medium text-slate-700 dark:text-zinc-300 flex items-center gap-2 flex-wrap">
          <span className="font-extrabold text-sky-600 dark:text-sky-400">Re-pitching {repitch.config?.businessName || 'your startup'}</span>
          <span className="text-slate-400">·</span>
          <span>previous score {repitch.previousSession?.overallScore ?? '—'}/100 — the panel will remember your last attempt.</span>
        </div>
      )}

      {/* Req 14: a pitch that has used all its attempts is read/replay/report-only.
          The server decides (canStartNewAttempt); this banner is its message. */}
      {attemptState && !attemptState.canStartNewAttempt && (
        <div className="shrink-0 mb-6 px-4 py-3 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-900/40 rounded-xl text-sm font-medium text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <Lock size={14} className="shrink-0" />
          <span>
            This pitch has used all {attemptState.maxAttempts} attempts. Its
            report, transcript and audio replay stay available — start a new
            pitch to keep practising.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-6 min-h-0 pb-16 lg:pb-0">
        
        {/* LEFT COLUMN: Setup */}
        <div className="lg:col-span-8 flex flex-col gap-6 lg:overflow-y-auto pr-0 lg:pr-2 custom-scrollbar">
          
          {(businesses.length > 0 || selectedBusinessId || bridgeError) && (
            <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm shrink-0 space-y-3">
              {(businesses.length > 0 || selectedBusinessId) && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <label htmlFor="practice-business" className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5 shrink-0">
                    <Building2 size={14} className="text-sky-500" /> Practise for
                  </label>
                  <select
                    id="practice-business"
                    value={selectedBusinessId}
                    onChange={(event) => chooseBusiness(event.target.value)}
                    className="w-full sm:flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-zinc-800 border rounded-xl dark:border-zinc-700 text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  >
                    <option value="">No business (quick practice)</option>
                    {businesses.map((business) => (
                      <option key={business.id} value={business.id}>{business.name}</option>
                    ))}
                    {selectedBusinessId && !selectedBusiness && (
                      <option value={selectedBusinessId}>Linked business</option>
                    )}
                  </select>
                </div>
              )}

              {selectedBusinessId && (
                <>
                  <div className="space-y-1.5">
                    <label htmlFor="practice-question" className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <MessageSquareQuote size={14} className="text-sky-500" /> Question to practise (optional)
                    </label>
                    <textarea
                      id="practice-question"
                      value={practiceQuestion}
                      onChange={(event) => setPracticeQuestion(event.target.value)}
                      maxLength={PRACTICE_QUESTION_MAX}
                      rows={2}
                      placeholder="e.g. How will you reach your next 100 customers?"
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-zinc-800 border rounded-xl resize-none dark:border-zinc-700 dark:text-zinc-100"
                    />
                    {currentMode === 'solo' && practiceQuestion.trim() && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        Solo sessions have no live AI, so this question is only asked in Coach or Panel mode.
                      </p>
                    )}
                  </div>
                  <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-500 dark:text-zinc-400">
                    <ShieldCheck size={13} className="mt-0.5 shrink-0 text-emerald-500" />
                    Private personal session. Your report, transcript and recording stay private and never appear on your public profile.
                  </p>
                </>
              )}

              {bridgeError && (
                <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">{bridgeError}</p>
              )}
            </div>
          )}

          <div data-tour="setup-mode" className="flex gap-2 sm:gap-4 shrink-0">
            <ModeCard title="AI Panel" icon={Users} active={currentMode === 'panel'} onClick={() => setValue('mode', 'panel')} />
            <ModeCard title="Coach" icon={Target} active={currentMode === 'coach'} onClick={() => setValue('mode', 'coach')} />
            <ModeCard title="Solo" icon={User} active={currentMode === 'solo'} onClick={() => setValue('mode', 'solo')} />
          </div>

          <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm shrink-0">
            {/* Two columns, each select stacked full-width inside its column:
                the old three columns of side-by-side selects squeezed each one
                to a few characters ("SaaS &", "Pre-S", "10 mi"). At lg the
                sidebar and preview panel narrow this card, so it drops to one
                column until xl. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-1 sm:col-span-2 lg:col-span-1 xl:col-span-2">
                <div className="flex justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5"><Briefcase size={14} className="text-sky-500"/> Startup Name</label>
                  {errors.businessName && <span className="text-[10px] text-rose-500 font-bold">{errors.businessName.message}</span>}
                </div>
                <input {...register('businessName')} type="text" placeholder="e.g. PitchNest AI" className={cn("w-full px-3 py-2 text-sm bg-slate-50 dark:bg-zinc-800 border rounded-xl focus:ring-2 focus:ring-sky-500/20 dark:border-zinc-700 dark:text-zinc-100", errors.businessName && "border-rose-300 focus:ring-rose-500/20")} />
              </div>
              <div className="space-y-1.5 col-span-1">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5"><AlignLeft size={14} className="text-sky-500"/> Industry & Persona</label>
                <div className="flex flex-col gap-2">
                  <select {...register('industry')} className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-zinc-800 border rounded-xl dark:border-zinc-700 text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20">
                    {withCurrent(INDUSTRY_OPTIONS, industryValue).map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <select {...register('investorArchetype')} className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-zinc-800 border rounded-xl dark:border-zinc-700 text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20">
                    <option value="Seed Stage - Venture Capital">Seed VC</option>
                    <option value="Angel Investor Group">Angel Group</option>
                    <option value="Growth Stage - Venture Capital">Growth Fund</option>
                    <option value="Shark Tank Judge">Shark Tank Judge</option>
                    <option value="Private Equity">Private Equity</option>
                    <option value="Strategic Corporate VC">Corporate VC</option>
                    <option value="Family Office">Family Office</option>
                    <option value="Y Combinator Partner">Y Combinator Partner</option>
                    <option value="ESG & Impact Investor">ESG & Impact Investor</option>
                    <option value="Demo Presentation">Demo Presentation</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5 col-span-1">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5"><Clock size={14} className="text-sky-500"/> Funding & Duration</label>
                <div className="flex flex-col gap-2">
                  <select {...register('fundingStage')} className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-zinc-800 border rounded-xl dark:border-zinc-700 text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20">
                    {withCurrent(STAGE_OPTIONS, fundingStageValue).map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  {/*
                    A <select> to match every other field in this section. The
                    paywall still holds: onChange intercepts a locked duration,
                    reverts to the highest the plan allows, and raises the
                    upgrade prompt — a native select CAN gate on change even
                    though an <option> can't intercept a raw click. Locked
                    options stay VISIBLE (labelled "· Pro") to advertise Pro.
                  */}
                  <select
                    aria-label="Session duration"
                    value={duration}
                    onChange={(e) => {
                      const mins = Number(e.target.value);
                      if (!allowedDurations.includes(mins)) {
                        showUpgrade('duration');
                        // Revert to the best length this plan can actually run.
                        setValue('duration', allowedDurations[allowedDurations.length - 1], { shouldValidate: true });
                        return;
                      }
                      setValue('duration', mins, { shouldValidate: true });
                    }}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-zinc-800 border rounded-xl dark:border-zinc-700 text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  >
                    {DURATION_OPTIONS.map((mins) => {
                      const locked = !allowedDurations.includes(mins);
                      return (
                        <option key={mins} value={mins}>
                          {mins} min{locked ? ' · Pro' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5 col-span-1 sm:col-span-2 lg:col-span-1 xl:col-span-2">
                <div className="flex justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Elevator Pitch</label>
                  {errors.description && <span className="text-[10px] text-rose-500 font-bold">{errors.description.message}</span>}
                </div>
                <textarea {...register('description')} placeholder="What do you do? (Min 10 characters)" rows={2} className={cn("w-full px-3 py-2 text-sm bg-slate-50 dark:bg-zinc-800 border rounded-xl resize-none dark:border-zinc-700 dark:text-zinc-100", errors.description && "border-rose-300 focus:ring-rose-500/20")} />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm shrink-0 grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-zinc-300"><span>Aggressiveness</span><span className="text-sky-500">{aggressiveness}%</span></div>
              <input type="range" {...register('aggressiveness', { valueAsNumber: true })} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-zinc-300"><span>Risk Appetite</span><span className="text-indigo-500">{riskAppetite}%</span></div>
              <input type="range" {...register('riskAppetite', { valueAsNumber: true })} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 shrink-0 mt-2">
            {[
              // Camera is intentionally disabled for now — we're avoiding heavy
              // video storage. Only Microphone and Screen are functional.
              { icon: Camera, label: 'Camera', state: false, disabled: true, set: (_c:boolean) => {} },
              { icon: Mic, label: 'Microphone', state: micEnabled, disabled: false, set: (c:boolean) => setValue('micEnabled', c) },
              ...(canScreenShare ? [{ icon: Monitor, label: 'Screen', state: screenShareEnabled, disabled: false, set: toggleScreenShare }] : [])
            ].map((hw, i) => (
              <div key={i} className={cn("flex-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between", hw.disabled && "opacity-70")}>
                <div className="flex items-center gap-3">
                  <hw.icon size={18} className={hw.state ? "text-emerald-500" : "text-slate-400"} />
                  <span className="text-xs font-bold">{hw.label}</span>
                </div>
                {hw.disabled ? (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded-full">Coming soon</span>
                ) : (
                  <Switch.Root checked={hw.state} onCheckedChange={(checked) => hw.set(checked)} className="w-8 h-4.5 bg-slate-200 dark:bg-zinc-800 rounded-full relative data-[state=checked]:bg-emerald-500 transition-colors cursor-pointer">
                    <Switch.Thumb className="block w-3.5 h-3.5 mt-0.5 ml-0.5 bg-white rounded-full transition-transform data-[state=checked]:translate-x-3.5" />
                  </Switch.Root>
                )}
              </div>
            ))}
          </div>

        </div>

        {/* RIGHT COLUMN: Deck & Submit */}
        <div className="lg:col-span-4 flex flex-col gap-4 min-h-75 lg:min-h-0 min-w-0">
          <div data-tour="setup-deck" className="flex-1 bg-slate-900 rounded-4xl p-5 md:p-6 flex flex-col text-white min-h-0 min-w-0 overflow-hidden">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/50 mb-4 shrink-0">Select Deck</h3>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-35 lg:min-h-0 min-w-0">
              {isLoading ? ( <><Skeleton className="h-14 bg-white/10" /><Skeleton className="h-14 bg-white/10" /></> ) : availableDecks.length === 0 ? (
                <p className="text-xs text-white/40 text-center py-4">No decks found.</p>
              ) : (
                availableDecks.map((deck) => (
                  <div key={deck.id} onClick={() => deck.status !== 'DRAFT' && setSelectedDeck(deck)} className={cn("flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors border min-w-0", selectedDeck?.id === deck.id ? "bg-sky-500/20 border-sky-500" : "border-white/10 hover:bg-white/5", deck.status === 'DRAFT' && "opacity-60 cursor-not-allowed")}>
                    <FileText size={16} className={selectedDeck?.id === deck.id ? "text-sky-400" : "text-white/40"} />
                    <div className="flex-1 overflow-hidden min-w-0">
                      <p className="text-xs font-bold truncate">{deck.name}</p>
                      <p className="text-[9px] text-white/40">
                        {deck.status === 'DRAFT' ? 'Uploading...' : `${deck.size || 0} MB`}
                      </p>
                    </div>
                    {deck.status === 'DRAFT' ? (
                      <Loader2 size={14} className="animate-spin text-sky-500" />
                    ) : selectedDeck?.id === deck.id ? (
                      <CheckCircle2 size={14} className="text-sky-500" />
                    ) : null}
                  </div>
                ))
              )}
            </div>

            <div className="shrink-0 mt-4 space-y-3">
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={() => deckFileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-white/20 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                >
                  <Upload size={14} /> Upload New
                </button>
                {selectedDeck && (
                  <button
                    type="button"
                    onClick={() => setSelectedDeck(null)}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-rose-500/30 text-xs font-bold text-rose-400/80 hover:bg-rose-500/10 hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    <X size={14} /> Clear
                  </button>
                )}
              </div>
              <input
                type="file"
                ref={deckFileInputRef}
                onChange={handleUploadDeck}
                // Only what the backend actually accepts — the deck pipeline
                // (slide-per-page viewer, PDF text extraction, page counts) is
                // built on PDF and plain text. PowerPoint needs conversion
                // first; letting it be picked just ends in a 415.
                accept=".pdf,.txt,.md"
                className="hidden"
              />
              
              <button
                type="submit"
                data-tour="setup-start"
                disabled={
                  isSubmitting ||
                  (attemptState !== null && !attemptState.canStartNewAttempt)
                }
                className="w-full py-4 bg-sky-500 text-white font-bold rounded-2xl hover:bg-sky-400 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : attemptState !== null && !attemptState.canStartNewAttempt ? (
                  <>No attempts left</>
                ) : (
                  <>
                    Enter Live Room{" "}
                    <PlayCircle
                      size={20}
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        
      </form>
    </div>
  );
}
