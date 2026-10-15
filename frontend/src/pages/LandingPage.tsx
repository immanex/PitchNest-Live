import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  PlayCircle, ArrowRight, Users, MessageSquare, ShieldCheck, HelpCircle,
  FileText, Target, TrendingUp, ChevronDown, Zap, Phone, Mail, Menu, X,
  Clock, CheckCircle2, Sparkles,
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { ThemeToggle } from '../components/ThemeToggle';
import { SmoothScroll } from '../components/landing/SmoothScroll';
import { SectionReveal } from '../components/landing/SectionReveal';
import { HeroWords, heroBlock, heroEase } from '../components/landing/HeroWords';
import { InvestorMarquee } from '../components/landing/InvestorMarquee';
import { StatsBand } from '../components/landing/StatsBand';
import { DiscoverShowcase } from '../components/landing/DiscoverShowcase';
import { PlatformOverview } from '../components/landing/PlatformOverview';
import { LogoLink, LogoMark } from '../components/Logo';
import { getPlans } from '../lib/plans';
import { usePublicPrice } from '../hooks/usePublicPrice';
const heroImage = '/assets/heroImage.jpeg';

const problems = [
  { icon: Clock, title: "One shot per investor", desc: "Fumble the live Q&A and that lead is gone — you rarely get a second meeting." },
  { icon: MessageSquare, title: "Feedback is vague", desc: "Rejections come back as “not a fit right now,” with nothing on what actually went wrong." },
  { icon: Users, title: "Your circle is too nice", desc: "Friends and co-founders won't grill you the way a real partner will." },
  { icon: HelpCircle, title: "The follow-ups blindside you", desc: "It's not the pitch that's hard — it's the questions on your TAM, unit economics, and moat you didn't see coming." },
];

const solutionPoints = [
  { icon: MessageSquare, title: "A panel that pushes back", desc: "Adaptive follow-up questions based on what you actually say — not a fixed script." },
  { icon: FileText, title: "It reads your deck", desc: "Upload it and the panel asks about your numbers: TAM, unit economics, go-to-market." },
  { icon: Target, title: "An honest score, not a pep talk", desc: "Readiness graded on delivery, clarity, scalability, and overall strength — with concrete fixes." },
];

const roomFeatures = [
  { icon: Users, title: "Live AI investor panel", desc: "Three distinct personas question and debate your pitch in real time. Prefer 1-on-1? Switch to Coach mode." },
  { icon: FileText, title: "Deck-aware Q&A", desc: "Upload your deck and get slide-grounded questions on your TAM, unit economics, and GTM." },
  { icon: Zap, title: "Adaptive follow-ups", desc: "The panel reacts to what you actually say — no two sessions are the same." },
  { icon: Target, title: "Practice any room", desc: "Angel, seed VC, YC-style, PE, or Shark-Tank-style panels — tune the aggressiveness." },
  { icon: PlayCircle, title: "Replay the whole session", desc: "Every question the panel asked and every answer you gave, saved as a transcript you can read back in your pitch archive." },
];

/**
 * What a PitchNest report contains, and WHERE each part appears.
 *
 * The split matters because the report is not one artefact. The on-screen report
 * (pages/PostPitchReport.tsx) gives every plan the verdict, the score, the radar,
 * sentiment, strengths and risks. The written PDF — a paid feature — is where the
 * prescriptive material lives: the action plan, the questions to prepare answers
 * for, the competitive landscape and SWOT, the practice drills, and the filler /
 * talk-ratio measurements. Listing all of it as though it were on screen would
 * overclaim for every free user, which is precisely what this list used to do.
 */
const reportItems: { text: string; pdfOnly?: boolean }[] = [
  { text: "Verdict + executive summary — invest, watch, or decline, and why, in plain language." },
  { text: "Readiness scorecard — an overall score broken down across delivery, clarity, scalability, and readiness." },
  { text: "Delivery analytics — every question the panel put to you and how your confidence moved across the pitch." },
  { text: "Strengths & critical risks — what landed, and the red flags that will sink you if you don't fix them." },
  { text: "Prioritized action plan — ranked fixes to run before your next session.", pdfOnly: true },
  { text: "Toughest questions + answer frameworks — the ones you fumbled, with a structure to nail them next time.", pdfOnly: true },
  { text: "Competitive landscape & SWOT — AI-identified competitors and gaps to exploit (estimates labeled as such).", pdfOnly: true },
  { text: "Practice drills — reps to run before you pitch again.", pdfOnly: true },
  { text: "Filler words & talk ratio — measured from what you actually said.", pdfOnly: true },
  { text: "Progress tracking — this attempt measured against your last one, so you can watch the readiness climb." },
];

const reportTags = ["Readiness score", "Delivery analytics", "Strengths & risks", "Verdict & summary", "Downloadable PDF"];

const whyItems = [
  { icon: ShieldCheck, title: "Safe to fail", desc: "Stumble on the hard questions here, not in front of a partner. No relationship burned." },
  { icon: TrendingUp, title: "Reps, not luck", desc: "Investors get one shot at you. Pro gives you unlimited shots at getting ready." },
  { icon: Target, title: "A target to beat", desc: "Re-pitch and your report measures this attempt against the last one — so every rep has a number to beat." },
  { icon: Zap, title: "Feedback in minutes", desc: "Structured critique the moment you finish. No waiting, no guesswork." },
  { icon: FileText, title: "Deck-aware, not generic", desc: "It interrogates your business, not pitch clichés." },
  { icon: Sparkles, title: "Start free", desc: "Two full pitch sessions a week, no card. Upgrade when you want more." },
];

const faqs = [
  { q: "What is PitchNest?", a: "One place to prepare and showcase your startup. Rehearse in private with an AI investor panel that questions your deck and scores your readiness, then publish a business profile on Discover when you're ready to be found." },
  { q: "What is Discover?", a: "A public directory of founder-run businesses: software, services, physical products and traditional businesses. Create a business in your workspace, preview exactly what will be shown, and publish when you're ready. You can unpublish at any time." },
  { q: "If I publish my business, is my practice still private?", a: "Yes. Decks, recordings, transcripts and reports never appear on your public profile. Someone else can see a report only if you turn on its share link, and you can turn that off again whenever you like." },
  { q: "How realistic is the panel?", a: "It asks the kinds of pointed, adaptive questions real partners do, and debates your thesis out loud. It's practice — not a prediction of any investor's decision." },
  { q: "Can I upload my pitch deck?", a: "Yes. The panel reads it and asks questions grounded in your slides and numbers." },
  { q: "Does it judge how I look on camera?", a: "Not today. PitchNest analyzes your spoken pitch and your deck. Visual delivery analysis is on our roadmap." },
  { q: "What do I get after a session?", a: "A readiness report on screen, on every plan: the verdict, the scorecard across delivery, clarity, scalability and readiness, every question the panel asked, and how your confidence moved across the pitch. The downloadable written report adds the prioritised action plan, the questions to prepare answers for, the competitive landscape and SWOT, and practice drills. Re-pitch and either report measures this attempt against your last one." },
  { q: "Is it free?", a: "There's a free plan: 2 pitch sessions a week, 10 minutes each, with your full report on screen. Paid plans add unlimited sessions, longer pitch durations and the downloadable PDF report, and Pro adds live market research in the panel. Discover, business profiles and the opportunities board are free." },
];

const navLinks = [
  { href: "#platform", label: "Platform" },
  { href: "/discover", label: "Discover" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const publicPrice = usePublicPrice();
  const plans = useMemo(() => getPlans(publicPrice), [publicPrice]);

  useEffect(() => { if (localStorage.getItem('user')) setIsLoggedIn(true); }, []);

  // Pre-warm the Render backend so login/signup don't hit a cold start
  useEffect(() => { fetch('/api/health').catch(() => {}); }, []);

  useEffect(() => {
    const onScroll = (e: Event) => {
      const y = e instanceof CustomEvent ? (e.detail as number) : window.scrollY;
      setNavScrolled(y > 24);
    };
    onScroll(new CustomEvent('init', { detail: window.scrollY }));
    window.addEventListener('lenis-scroll', onScroll);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('lenis-scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <SmoothScroll>
      <div className="min-h-screen bg-white dark:bg-[#09090B] font-sans text-slate-900 dark:text-zinc-100 transition-colors duration-300 overflow-x-hidden">

        <div className="fixed inset-0 gradient-mesh pointer-events-none -z-10" />

        {/* ── Navbar ── */}
        <header className={cn('fixed top-0 left-0 right-0 z-50 nav-glass', navScrolled && 'nav-glass-scrolled')}>
          <nav className="max-w-295 mx-auto px-5 sm:px-7 h-16 flex justify-between items-center">
            <LogoLink showText size="md" />

            <div className="hidden md:flex items-center gap-7">
              {navLinks.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium transition-colors text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100"
                >
                  {link.label}
                </a>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              <div className="hidden md:flex items-center gap-3">
                {isLoggedIn ? (
                  <Link to="/dashboard" className="btn-primary text-sm px-5 py-2.5">Dashboard</Link>
                ) : (
                  <>
                    <Link to="/login" className="btn-ghost">Log in</Link>
                    <Link to="/signup" className="btn-primary text-sm px-5 py-2.5">Start pitching</Link>
                  </>
                )}
              </div>
              <button
                className="md:hidden p-2 text-slate-600 dark:text-zinc-400"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </nav>
        </header>

        <div className="h-27" aria-hidden />

        {isMobileMenuOpen && (
          <div className="md:hidden fixed top-27 left-0 right-0 nav-glass z-40 p-5 flex flex-col gap-1 shadow-lg">
            {navLinks.map(link => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-3 text-base font-medium text-slate-600 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800/50"
              >
                {link.label}
              </a>
            ))}
            <div className="flex flex-col gap-3 pt-4">
              {isLoggedIn ? (
                <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="btn-primary w-full text-center">Dashboard</Link>
              ) : (
                <>
                  <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="btn-secondary w-full text-center">Log in</Link>
                  <Link to="/signup" onClick={() => setIsMobileMenuOpen(false)} className="btn-primary w-full text-center">Start pitching</Link>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Hero ──
            Two columns from lg: copy left, product shot right, so the image is
            above the fold rather than a scroll away. Height is bounded by the
            content (no min-h-screen) and the padding is deliberately tighter
            than the old centred layout. */}
        <section className="relative overflow-hidden border-b border-slate-100 dark:border-zinc-800/60">
          {/* Background treatment: a soft brand wash plus a faint grid. Both are
              pointer-events-none and very low contrast — texture, not decoration
              that competes with the copy. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_55%_at_75%_15%,rgba(99,102,241,0.10),transparent_60%),radial-gradient(45%_45%_at_10%_5%,rgba(14,165,233,0.08),transparent_60%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35] dark:opacity-[0.18] bg-[linear-gradient(to_right,rgba(100,116,139,0.14)_1px,transparent_1px),linear-gradient(to_bottom,rgba(100,116,139,0.14)_1px,transparent_1px)] bg-size-[56px_56px] mask-[radial-gradient(70%_60%_at_50%_0%,black,transparent_75%)]"
          />

          <div className="max-w-295 mx-auto px-5 sm:px-7 py-12 sm:py-16 lg:py-20">
            <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Copy — left aligned at every breakpoint */}
              <motion.div
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } }}
                className="lg:col-span-5 text-left"
              >
                <motion.div variants={heroBlock} className="flex mb-5">
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-[11px] font-semibold text-indigo-600 dark:text-indigo-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    For founders building, pitching and raising
                  </span>
                </motion.div>

                <HeroWords />

                <motion.p variants={heroBlock} className="mt-4 mb-7 text-base sm:text-lg leading-relaxed text-slate-600 dark:text-zinc-400 max-w-xl">
                  Pitch to an AI investor panel that listens, pushes back and grills your
                  deck, then get a scored report showing exactly what to fix. When you're
                  ready, give your business a public profile people can discover.
                </motion.p>

                <motion.div variants={heroBlock} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-3">
                  <Link to={isLoggedIn ? "/dashboard" : "/signup"} className="btn-primary justify-center px-6 py-3 text-sm sm:text-base">
                    Start pitching free <ArrowRight size={17} />
                  </Link>
                  <a href="#how-it-works" className="btn-secondary justify-center px-6 py-3 text-sm sm:text-base">
                    <PlayCircle size={17} /> See how it works
                  </a>
                </motion.div>

                <motion.p variants={heroBlock} className="text-xs text-slate-400 dark:text-zinc-500">
                  No credit card · 2 free pitches every week
                </motion.p>
              </motion.div>

              {/* Product shot — wider than the copy column so it carries the
                  section, and allowed to bleed slightly past the grid on large
                  screens so it reads as a window into the app. */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2, ease: heroEase }}
                className="lg:col-span-7 relative lg:-mr-6 xl:-mr-12"
              >
                {/* Glow. Two stacked blurred gradients sitting BEHIND the frame:
                    a wide brand-coloured wash plus a tighter, brighter core.
                    Purely decorative and pointer-events-none so it can never
                    intercept a click on the image. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -inset-6 sm:-inset-10 -z-10 rounded-4xl bg-[radial-gradient(50%_50%_at_50%_50%,rgba(99,102,241,0.35),transparent_70%)] blur-2xl"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute -inset-2 -z-10 rounded-3xl bg-[conic-gradient(from_180deg_at_50%_50%,rgba(14,165,233,0.25),rgba(99,102,241,0.35),rgba(217,70,239,0.2),rgba(14,165,233,0.25))] blur-xl opacity-70 dark:opacity-90"
                />

                <div className="card p-1 rounded-2xl shadow-2xl shadow-indigo-500/20 ring-1 ring-white/40 dark:ring-white/10">
                  <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-16/10">
                    <img
                      src={heroImage}
                      alt="PitchNest live pitch session with an AI investor panel"
                      className="w-full h-full object-cover"
                      /* Above the fold now — eager, and high priority so it does
                         not lose the race to the JS bundle. */
                      loading="eager"
                      fetchPriority="high"
                      decoding="async"
                    />
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[11px] font-medium text-emerald-300">Live</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <InvestorMarquee />
        <StatsBand />

        {/* ── Platform ──
            Everything one account gets, up front, before the rehearsal story
            goes deep. Flag-gated features show as "Soon" until switched on. */}
        <PlatformOverview isLoggedIn={isLoggedIn} />

        {/* ── The Problem ── */}
        <section id="problem" className="py-[clamp(36px,4vw,60px)] border-y border-slate-100 dark:border-zinc-800/60 scroll-mt-28">
          <div className="max-w-295 mx-auto px-5 sm:px-7">
            <SectionReveal className="text-center mb-8 sm:mb-10 max-w-3xl mx-auto">
              <p className="section-label mb-3">The problem</p>
              <h2 className="section-heading mb-4">Most founders find the gaps live — when it's already too late</h2>
              <p className="section-subheading mx-auto">You walk in under-rehearsed, get caught off guard, and burn a lead you can't get back.</p>
            </SectionReveal>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {problems.map((p, i) => (
                <SectionReveal key={p.title} delay={i * 0.06}>
                  <div className="card-hover p-6 h-full">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center mb-4 text-rose-500 dark:text-rose-400">
                      <p.icon size={18} />
                    </div>
                    <h3 className="font-display text-base font-semibold mb-2">{p.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">{p.desc}</p>
                  </div>
                </SectionReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── The Solution ── */}
        <section id="solution" className="py-[clamp(36px,4vw,60px)] scroll-mt-28">
          <div className="max-w-295 mx-auto px-5 sm:px-7">
            <SectionReveal className="text-center mb-8 sm:mb-10 max-w-3xl mx-auto">
              <p className="section-label mb-3">The solution</p>
              <h2 className="section-heading mb-4">Get grilled in private, so nothing surprises you in public</h2>
              <p className="section-subheading mx-auto">Pitch out loud to a panel of AI investors — a lead partner, a financial analyst, and a technical partner. They listen, interrupt with hard questions, and debate your thesis. When you're done, you get a structured readiness report with the specific fixes to make before your next real meeting.</p>
            </SectionReveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
              {solutionPoints.map((f, i) => (
                <SectionReveal key={f.title} delay={i * 0.06}>
                  <div className="card-hover p-6 group h-full">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-4 text-slate-600 dark:text-zinc-300 group-hover:gradient-brand group-hover:text-white transition-all duration-300">
                      <f.icon size={18} />
                    </div>
                    <h3 className="font-display text-base font-semibold mb-2">{f.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">{f.desc}</p>
                  </div>
                </SectionReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how-it-works" className="py-[clamp(36px,4vw,60px)] bg-slate-50/80 dark:bg-zinc-900/30 scroll-mt-28">
          <div className="max-w-295 mx-auto px-5 sm:px-7">
            <SectionReveal className="text-center mb-8 sm:mb-10">
              <p className="section-label mb-3">How it works</p>
              <h2 className="section-heading">Three steps to investor-ready</h2>
            </SectionReveal>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
              {[
                { step: "01", title: "Set up your session", desc: "Add your startup, pick your investor panel and difficulty, and upload your deck." },
                { step: "02", title: "Pitch out loud", desc: "Present live while the panel listens and fires back questions in real time." },
                { step: "03", title: "Review and fix", desc: "Get your scored readiness report and session replay, then run it again until it's tight." },
              ].map((item, i) => (
                <SectionReveal key={item.step} delay={i * 0.1}>
                  <span className="font-display text-5xl font-bold gradient-text opacity-30 block mb-4">{item.step}</span>
                  <h3 className="font-display text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">{item.desc}</p>
                </SectionReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── In the Room ── */}
        <section id="in-the-room" className="py-[clamp(36px,4vw,60px)] scroll-mt-28">
          <div className="max-w-295 mx-auto px-5 sm:px-7">
            <SectionReveal className="text-center mb-8 sm:mb-10 max-w-3xl mx-auto">
              <p className="section-label mb-3">In the room</p>
              <h2 className="section-heading mb-4">A panel that actually makes you sweat</h2>
              <p className="section-subheading mx-auto">Three distinct AI investors question and debate your pitch in real time.</p>
            </SectionReveal>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {roomFeatures.map((f, i) => (
                <SectionReveal key={f.title} delay={i * 0.06}>
                  <div className="card-hover p-6 group h-full">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-4 text-slate-600 dark:text-zinc-300 group-hover:gradient-brand group-hover:text-white transition-all duration-300">
                      <f.icon size={18} />
                    </div>
                    <h3 className="font-display text-base font-semibold mb-2">{f.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">{f.desc}</p>
                  </div>
                </SectionReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── In Your Report ── */}
        <section id="your-report" className="py-[clamp(36px,4vw,60px)] bg-slate-50/80 dark:bg-zinc-900/30 scroll-mt-28">
          <div className="max-w-295 mx-auto px-5 sm:px-7">
            <SectionReveal className="text-center mb-8 sm:mb-10 max-w-3xl mx-auto">
              <p className="section-label mb-3">In your report</p>
              <h2 className="section-heading mb-4">Walk away with a battle plan, not just a score</h2>
              <p className="section-subheading mx-auto">The second you finish, PitchNest generates a detailed readiness report — the kind of prep a pitch coach would charge for.</p>
            </SectionReveal>

            <div className="grid lg:grid-cols-5 gap-6 lg:gap-8 items-start">
              <SectionReveal className="lg:col-span-2">
                <div className="card p-7 sm:p-8 lg:sticky lg:top-28">
                  {/* This card used to be headed "If you pitched again today" and
                      claimed every report projects your score after the fixes.
                      Nothing projected anything — the number was invented. What
                      the product genuinely does is compare this attempt with the
                      previous one, so the card now shows that instead. */}
                  <p className="section-label mb-4 flex items-center gap-2"><TrendingUp size={14} /> Your second attempt</p>
                  <div className="flex items-end gap-3 mb-4">
                    <span className="font-display text-4xl sm:text-5xl font-bold text-slate-400 dark:text-zinc-600 line-through decoration-2">46</span>
                    <ArrowRight className="mb-2 text-slate-400 dark:text-zinc-500" size={26} />
                    <span className="font-display text-5xl sm:text-6xl font-bold gradient-text leading-none">78</span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
                    Re-pitch and the report sets this attempt beside your last one, so you can see whether the fixes landed. The panel walks in remembering what it flagged.
                  </p>
                  <div className="mt-6 pt-6 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap gap-2">
                    {reportTags.map((t) => (
                      <span key={t} className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-zinc-800 text-xs font-medium text-slate-600 dark:text-zinc-300">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </SectionReveal>

              <SectionReveal delay={0.08} className="lg:col-span-3">
                <div className="card p-7 sm:p-8">
                  <h3 className="font-display text-lg font-semibold mb-2">What's inside every report</h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400 mb-5 leading-relaxed">
                    The first four are on screen on every plan, including Free. The rest are in the
                    downloadable written report.
                  </p>
                  <ul className="space-y-4">
                    {reportItems.map((item) => {
                      const idx = item.text.indexOf(' — ');
                      const lead = idx === -1 ? item.text : item.text.slice(0, idx);
                      const rest = idx === -1 ? '' : item.text.slice(idx + 3);
                      return (
                        <li key={item.text} className="flex gap-3">
                          <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-indigo-500 dark:text-indigo-400" />
                          <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
                            <span className="font-semibold text-slate-800 dark:text-zinc-100">{lead}</span>
                            {rest && <> — {rest}</>}
                            {item.pdfOnly && (
                              <span className="ml-2 align-middle inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">
                                PDF
                              </span>
                            )}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </SectionReveal>
            </div>
          </div>
        </section>

        {/* ── Why PitchNest ── */}
        <section id="why-pitchnest" className="py-[clamp(36px,4vw,60px)] scroll-mt-28">
          <div className="max-w-295 mx-auto px-5 sm:px-7">
            <SectionReveal className="text-center mb-8 sm:mb-10 max-w-3xl mx-auto">
              <p className="section-label mb-3">Why PitchNest</p>
              <h2 className="section-heading mb-4">Preparation is the one variable you control</h2>
              <p className="section-subheading mx-auto">Investors get one shot at you. PitchNest makes sure you've already had a hundred.</p>
            </SectionReveal>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {whyItems.map((item, i) => (
                <SectionReveal key={item.title} delay={i * 0.05}>
                  <div className="card-hover p-6 h-full">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-4 text-slate-600 dark:text-zinc-300">
                      <item.icon size={18} />
                    </div>
                    <h3 className="font-display text-base font-semibold mb-2">{item.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">{item.desc}</p>
                  </div>
                </SectionReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Discover ──
            Entry into the founder ecosystem: real published businesses only.
            Sits after the rehearsal story so the core product still leads. */}
        <DiscoverShowcase isLoggedIn={isLoggedIn} />

        {/* ── Pricing (condensed) ──
            Deliberately a summary, not the full matrix: three cards, the headline
            constraint of each, and one CTA into /pricing for detail. Keeping the
            landing page to one screen of pricing avoids duplicating a table that
            then has to be kept in sync in two places. */}
        <section id="pricing" className="py-[clamp(36px,4vw,56px)] bg-slate-50/80 dark:bg-zinc-900/30 scroll-mt-24">
          <div className="max-w-5xl mx-auto px-5 sm:px-8">
            <SectionReveal className="text-center mb-8">
              <p className="section-label mb-2">Pricing</p>
              <h2 className="section-heading mb-3">Start free. Upgrade when you're raising.</h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-zinc-400 max-w-2xl mx-auto">
                Every account gets 2 full pitch sessions a week with the complete
                scorecard on screen.
              </p>
            </SectionReveal>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
              {plans.map((plan, i) => (
                <SectionReveal key={plan.name} delay={i * 0.05}>
                  <div
                    className={cn(
                      "h-full rounded-2xl border p-5 flex flex-col bg-white dark:bg-zinc-900",
                      plan.featured
                        ? "border-sky-500 ring-1 ring-sky-500/30"
                        : "border-slate-200 dark:border-zinc-800",
                    )}
                  >
                    <div className="flex items-baseline justify-between mb-1">
                      <p className="text-sm font-extrabold text-slate-900 dark:text-zinc-100">{plan.name}</p>
                      {plan.featured && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                          Popular
                        </span>
                      )}
                    </div>
                    <p className="text-xl font-bold text-slate-900 dark:text-zinc-100 mb-0.5">
                      {plan.price || (plan.id === "enterprise" ? "Custom" : "—")}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">{plan.tagline}</p>
                    <ul className="space-y-1.5 text-[13px] text-slate-600 dark:text-zinc-400 mb-5">
                      {plan.features.slice(0, 4).map((line) => (
                        <li key={line} className="flex items-start gap-2">
                          <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-500" />
                          {line}
                        </li>
                      ))}
                    </ul>
                    {/* Per-card CTA so every tier has a real next step rather
                        than one shared button under the grid. */}
                    <div className="mt-auto">
                      {!plan.available ? (
                        <span className="block w-full py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-center text-xs font-bold text-slate-400 dark:text-zinc-500 cursor-default">
                          {plan.cta.label}
                        </span>
                      ) : (
                        <Link
                          to={plan.cta.href}
                          className={cn(
                            "block w-full py-2.5 rounded-xl text-center text-xs font-bold transition-colors",
                            plan.featured
                              ? "gradient-brand text-white hover:opacity-95"
                              : "border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800",
                          )}
                        >
                          {plan.cta.label}
                        </Link>
                      )}
                    </div>
                  </div>
                </SectionReveal>
              ))}
            </div>

            <SectionReveal className="text-center">
              <Link to="/pricing" className="btn-primary inline-flex px-6 py-3 text-sm">
                Compare plans in full <ArrowRight size={16} />
              </Link>
            </SectionReveal>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="py-[clamp(36px,4vw,60px)] border-t border-slate-100 dark:border-zinc-800/60 scroll-mt-28">
          <div className="max-w-3xl mx-auto px-5 sm:px-8">
            <SectionReveal className="text-center mb-12">
              <p className="section-label mb-3">FAQ</p>
              <h2 className="section-heading">Common questions</h2>
            </SectionReveal>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <SectionReveal key={i} delay={i * 0.04}>
                  <FAQItem question={faq.q} answer={faq.a} />
                </SectionReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="max-w-295 mx-auto px-5 sm:px-7 py-10 sm:py-14">
          <SectionReveal>
            <div className="gradient-brand rounded-3xl p-8 sm:p-10 text-center text-white relative overflow-hidden">
              <div className="relative z-10 max-w-2xl mx-auto">
                <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-3 leading-tight">Ready for your next pitch?</h2>
                <p className="text-sm sm:text-base text-white/75 mb-6 leading-relaxed">Don't find the gaps in a real board meeting. Rehearse, get scored, and walk in with confidence.</p>
                <Link to={isLoggedIn ? "/dashboard" : "/signup"} className="inline-flex items-center gap-2 px-7 py-3 bg-white text-indigo-600 font-semibold rounded-xl hover:bg-white/95 transition-all shadow-xl">
                  Start pitching now — free <ArrowRight size={18} />
                </Link>
              </div>
              <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-white/10 rounded-full blur-3xl pointer-events-none" />
            </div>
          </SectionReveal>
        </section>

        {/* ── Footer ── */}
        <footer className="bg-slate-50 dark:bg-zinc-900/50 py-12 sm:py-20 border-t border-slate-200 dark:border-zinc-800 transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-2 md:grid-cols-5 gap-8 sm:gap-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <LogoMark size="xs" />
                <span className="text-base font-bold">PitchNest</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 leading-relaxed mb-4">Rehearse your pitch, showcase your business, and find your next opportunity.</p>
              <div className="flex items-center gap-3">
                <a href="https://facebook.com/pitchnestapp" target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-blue-600 hover:border-blue-300 dark:hover:border-blue-500 transition-colors" aria-label="Facebook">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                </a>
                <a href="https://instagram.com/pitchnestapp" target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-pink-500 hover:border-pink-300 dark:hover:border-pink-500 transition-colors" aria-label="Instagram">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
                </a>
                <a href="https://x.com/pitchnestapp" target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-sky-500 hover:border-sky-300 dark:hover:border-sky-500 transition-colors" aria-label="X (Twitter)">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                </a>
                <a href="https://wa.me/2349058718400" target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-green-500 hover:border-green-300 dark:hover:border-green-500 transition-colors" aria-label="WhatsApp">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" /></svg>
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-bold mb-3 sm:mb-6 text-sm">Platform</h4>
              <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
                <li><Link to="/discover" className="hover:text-sky-600 dark:hover:text-sky-400">Discover</Link></li>
                <li><Link to="/opportunities" className="hover:text-sky-600 dark:hover:text-sky-400">Opportunities</Link></li>
                <li><a href="#how-it-works" className="hover:text-sky-600 dark:hover:text-sky-400">How it works</a></li>
                <li><a href="#your-report" className="hover:text-sky-600 dark:hover:text-sky-400">Your report</a></li>
                <li><a href="#why-pitchnest" className="hover:text-sky-600 dark:hover:text-sky-400">Why PitchNest</a></li>
                <li><a href="#pricing" className="hover:text-sky-600 dark:hover:text-sky-400">Pricing</a></li>
                <li><a href="#faq" className="hover:text-sky-600 dark:hover:text-sky-400">FAQ</a></li>
                <li><Link to="/login" className="hover:text-sky-600 dark:hover:text-sky-400">Login</Link></li>
                <li><Link to="/signup" className="hover:text-sky-600 dark:hover:text-sky-400">Sign Up</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-3 sm:mb-6 text-sm">Legal</h4>
              <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
                <li><Link to="/privacy" className="hover:text-sky-600 dark:hover:text-sky-400">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-sky-600 dark:hover:text-sky-400">Terms of Service</Link></li>
                <li><Link to="/delete-account" className="hover:text-sky-600 dark:hover:text-sky-400">Delete Account</Link></li>
                <li><Link to="/support" className="hover:text-sky-600 dark:hover:text-sky-400">Support</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-3 sm:mb-6 text-sm">Get in Touch</h4>
              <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
                <li><a href="tel:09058718400" className="hover:text-sky-600 dark:hover:text-sky-400 flex items-center gap-2"><Phone size={14} className="shrink-0" /> 09058718400</a></li>
                <li><a href="mailto:pitchnestapp@gmail.com" className="hover:text-sky-600 dark:hover:text-sky-400 flex items-center gap-2"><Mail size={14} className="shrink-0" /> pitchnestapp@gmail.com</a></li>
                <li><a href="https://wa.me/2349058718400" target="_blank" rel="noreferrer" className="hover:text-green-500 flex items-center gap-2"><svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" /></svg> WhatsApp</a></li>
              </ul>
            </div>

            <div className="col-span-2 md:col-span-1">
              <h4 className="font-bold mb-3 sm:mb-6 text-sm">Get Started</h4>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mb-3">Practice your pitch with an AI investor panel today.</p>
              <Link to="/signup" className="btn-primary inline-flex text-xs sm:text-sm px-4 py-2">
                Start pitching <ArrowRight size={14} />
              </Link>
            </div>
          </div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 sm:mt-16 pt-6 sm:pt-8 border-t border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-2 text-[10px] sm:text-xs text-slate-400 dark:text-zinc-500">
            <p>&copy; {new Date().getFullYear()} PitchNest AI. All rights reserved.</p>
            <p>Applying for Y Combinator Winter 2026</p>
          </div>
        </footer>
      </div>
    </SmoothScroll>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-5 text-left">
        <span className="font-display text-sm sm:text-base font-semibold pr-4">{question}</span>
        <ChevronDown size={18} className={cn("shrink-0 text-slate-400 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.35, ease: heroEase }}
          className="px-5 pb-5 -mt-1 overflow-hidden"
        >
          <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">{answer}</p>
        </motion.div>
      )}
    </div>
  );
}
