import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Users, ShieldCheck, FileText, Target, TrendingUp, ChevronDown, Zap,
  Phone, Mail, Menu, X, CheckCircle2, Compass, Mic, Keyboard, Lightbulb, Lock, MessageCircle,
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { ThemeToggle } from '../components/ThemeToggle';
import { SmoothScroll } from '../components/landing/SmoothScroll';
import { SectionReveal } from '../components/landing/SectionReveal';
import { HeroWords, heroBlock, heroEase } from '../components/landing/HeroWords';
import { DiscoverShowcase } from '../components/landing/DiscoverShowcase';
import { PlatformOverview } from '../components/landing/PlatformOverview';
import { HeroVisual, LivePanelPreview, ReportPreview } from '../components/landing/ProductPreviews';
import { LogoLink, LogoMark } from '../components/Logo';
import { getPlans } from '../lib/plans';
import { usePublicPrice } from '../hooks/usePublicPrice';

/** Rooms founders rehearse for, scrolling under the hero. */
const ROOMS = [
  'Pre-seed', 'Seed round', 'Series A', 'Accelerator interview', 'Demo day',
  'Angel syndicate', 'Grant panel', 'Pitch competition', 'Corporate VC', 'Impact investor',
];

const roomFeatures = [
  { icon: Users, title: 'Panel, Coach or Solo', desc: 'Face three investors at once, work 1-on-1 with a coach, or pitch alone and get scored afterwards.' },
  { icon: Target, title: 'Ten investor personas', desc: 'Seed VC, angel group, YC partner, family office, impact investor and more, each as tough as you set it.' },
  { icon: FileText, title: 'Reads your deck', desc: 'Questions grounded in your slides and numbers, not generic pitch clichés.' },
  { icon: Keyboard, title: 'Speak or type', desc: 'Pitch out loud, or type an answer when you would rather not speak.' },
  { icon: Lightbulb, title: 'Coaching as you go', desc: 'Short on-screen tips on what each question is really probing, without handing you a script.' },
  { icon: TrendingUp, title: 'Remembers your last attempt', desc: 'Re-pitch and the panel welcomes you back, checking whether last time\'s weak spots are fixed.' },
];

const steps = [
  { step: '01', title: 'Set up', desc: 'Pick your panel, set how tough it should be and attach your deck, or start from a business in your workspace.' },
  { step: '02', title: 'Pitch out loud', desc: 'Speak naturally. The panel listens, interrupts with follow-ups and debates your answers in real time.' },
  { step: '03', title: 'Review and re-pitch', desc: 'Get a scored report in minutes, fix the gaps and go again. The panel remembers your last attempt.' },
];

/**
 * What a report contains, and WHERE each part appears. The on-screen report
 * gives every plan the verdict, score, delivery analytics, strengths and risks;
 * the prescriptive material lives in the downloadable PDF (a paid feature).
 * Listing PDF items as on-screen would overclaim for every free user.
 */
const reportItems: { lead: string; rest: string; pdfOnly?: boolean }[] = [
  { lead: 'Verdict and summary', rest: 'invest, watch or decline, and why, in plain language.' },
  { lead: 'Readiness scorecard', rest: 'delivery, clarity, scalability and readiness, scored out of 100.' },
  { lead: 'Delivery analytics', rest: 'every question the panel asked and how your confidence moved.' },
  { lead: 'Strengths and critical risks', rest: 'what landed, and the red flags to fix first.' },
  { lead: 'Progress tracking', rest: 'this attempt measured against your last one.' },
  { lead: 'Prioritised action plan', rest: 'ranked fixes to make before your next session.', pdfOnly: true },
  { lead: 'Toughest questions', rest: 'the ones you fumbled, with a structure to answer them.', pdfOnly: true },
  { lead: 'Competitive landscape and SWOT', rest: 'competitors and gaps, with estimates labelled as such.', pdfOnly: true },
  { lead: 'Filler words and talk ratio', rest: 'measured from what you actually said.', pdfOnly: true },
];

const whyItems = [
  { icon: ShieldCheck, title: 'Safe to fail', desc: 'Stumble on the hard questions here, not in front of a partner.' },
  { icon: TrendingUp, title: 'A number to beat', desc: 'Every re-pitch is measured against your last attempt.' },
  { icon: Zap, title: 'Feedback in minutes', desc: 'A structured report the moment you finish.' },
  { icon: Lock, title: 'Private by default', desc: 'Decks, recordings and reports never go public unless you share them.' },
];

const faqs = [
  { q: "What is PitchNest?", a: "One place to prepare and showcase your startup. Rehearse in private with an AI investor panel that questions your deck and scores your readiness, then publish a business profile on Discover when you're ready to be found." },
  { q: "How realistic is the panel?", a: "It asks the kind of pointed, adaptive questions real partners do, and debates your answers out loud. It's practice, not a prediction of any investor's decision." },
  { q: "Can I upload my pitch deck?", a: "Yes. The panel reads it and asks questions grounded in your slides and numbers." },
  { q: "What do I get after a session?", a: "A readiness report on screen, on every plan: the verdict, the scorecard across delivery, clarity, scalability and readiness, every question the panel asked, and how your confidence moved. The downloadable report adds the prioritised action plan, the questions to prepare for, the competitive landscape and SWOT, and practice drills." },
  { q: "What is Discover?", a: "A public directory of founder-run businesses: software, services, physical products and traditional businesses. Create a business in your workspace, preview exactly what will be shown, and publish when you're ready. You can unpublish at any time." },
  { q: "If I publish my business, is my practice still private?", a: "Yes. Decks, recordings, transcripts and reports never appear on your public profile. Someone else can see a report only if you turn on its share link, and you can turn that off again whenever you like." },
  { q: "Is it free?", a: "There's a free plan: 2 pitch sessions a week, 10 minutes each, with your full report on screen. Paid plans add unlimited sessions, longer pitch durations and the downloadable PDF report, and Pro adds live market research in the panel. Discover, business profiles and the opportunities board are free." },
];

const navLinks = [
  { href: "#platform", label: "Platform" },
  { href: "#room", label: "Rehearsal" },
  { href: "/discover", label: "Discover" },
  { href: "/opportunities", label: "Opportunities" },
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

  const startHref = isLoggedIn ? '/setup' : '/signup';

  return (
    <SmoothScroll>
      <div className="min-h-screen bg-white dark:bg-[#09090B] font-sans text-slate-900 dark:text-zinc-100 transition-colors duration-300 overflow-x-hidden">

        {/* ── Navbar ── */}
        <header className={cn('fixed top-0 left-0 right-0 z-50 nav-glass', navScrolled && 'nav-glass-scrolled')}>
          <nav className="max-w-295 mx-auto px-5 sm:px-7 h-16 flex justify-between items-center">
            <LogoLink showText size="md" />

            <div className="hidden lg:flex items-center gap-7">
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
              <div className="hidden lg:flex items-center gap-3">
                {isLoggedIn ? (
                  <Link to="/dashboard" className="btn-primary text-sm px-5 py-2.5">Dashboard</Link>
                ) : (
                  <>
                    <Link to="/login" className="btn-ghost">Log in</Link>
                    <Link to="/signup" className="btn-primary text-sm px-5 py-2.5">Start free</Link>
                  </>
                )}
              </div>
              <button
                className="lg:hidden p-2 text-slate-600 dark:text-zinc-400"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle menu"
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </nav>
        </header>

        <div className="h-16" aria-hidden />

        {isMobileMenuOpen && (
          <div className="lg:hidden fixed top-16 left-0 right-0 nav-glass nav-glass-scrolled z-40 p-5 flex flex-col gap-1 shadow-lg">
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
                  <Link to="/signup" onClick={() => setIsMobileMenuOpen(false)} className="btn-primary w-full text-center">Start free</Link>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_80%_10%,rgba(99,102,241,0.14),transparent_60%),radial-gradient(40%_40%_at_5%_0%,rgba(255,210,104,0.18),transparent_60%)] dark:bg-[radial-gradient(60%_60%_at_80%_10%,rgba(99,102,241,0.18),transparent_60%),radial-gradient(40%_40%_at_5%_0%,rgba(255,210,104,0.06),transparent_60%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-[0.4] dark:opacity-[0.15] bg-[linear-gradient(to_right,rgba(100,116,139,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(100,116,139,0.12)_1px,transparent_1px)] bg-size-[64px_64px] mask-[radial-gradient(70%_60%_at_50%_0%,black,transparent_75%)]"
          />

          <div className="max-w-295 mx-auto px-5 sm:px-7 pt-10 pb-16 sm:pt-16 sm:pb-24 lg:pt-20">
            <div className="grid lg:grid-cols-12 gap-12 lg:gap-10 items-center">
              <motion.div
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } }}
                className="lg:col-span-6"
              >
                <motion.div variants={heroBlock} className="mb-6">
                  <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-slate-200 bg-white/80 px-3.5 py-1.5 text-[12px] font-semibold text-slate-600 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent-strong" />
                    Pitch practice <span className="text-slate-300 dark:text-zinc-600">·</span> Business profiles <span className="text-slate-300 dark:text-zinc-600">·</span> Opportunities
                  </span>
                </motion.div>

                <HeroWords />

                <motion.p variants={heroBlock} className="mt-6 mb-8 text-base sm:text-lg leading-relaxed text-slate-600 dark:text-zinc-400 max-w-xl">
                  Rehearse with an AI investor panel that questions your deck and scores your
                  readiness. When you're ready, give your business a public profile, share your
                  progress and find your next accelerator, grant or competition.
                </motion.p>

                <motion.div variants={heroBlock} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <Link to={startHref} className="btn-primary justify-center px-7 py-3.5 text-base">
                    Start free <ArrowRight size={18} />
                  </Link>
                  <Link to="/discover" className="btn-secondary justify-center px-7 py-3.5 text-base">
                    <Compass size={18} /> Explore Discover
                  </Link>
                </motion.div>

                <motion.ul variants={heroBlock} className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-zinc-400">
                  {['No card needed', '2 free sessions every week', 'Private until you publish'].map((item) => (
                    <li key={item} className="flex items-center gap-1.5">
                      <CheckCircle2 size={16} className="text-emerald-500" /> {item}
                    </li>
                  ))}
                </motion.ul>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease: heroEase }}
                className="lg:col-span-6 lg:pl-6"
              >
                <HeroVisual />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Rooms strip ── */}
        <section aria-label="Rooms you can rehearse for" className="border-y border-slate-100 dark:border-zinc-800/60 bg-slate-50/70 dark:bg-zinc-900/30 py-5">
          <div className="max-w-295 mx-auto px-5 sm:px-7 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
            <p className="shrink-0 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Rehearse for</p>
            <div className="mask-fade-x min-w-0 flex-1 overflow-hidden">
              <div className="flex w-max gap-2.5 animate-marquee">
                {[...ROOMS, ...ROOMS].map((room, i) => (
                  <span
                    key={`${room}-${i}`}
                    className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    {room}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Platform ── (flag-gated features show as "Soon" until switched on) */}
        <PlatformOverview isLoggedIn={isLoggedIn} />

        {/* ── The rehearsal room ── */}
        <section id="room" className="relative overflow-hidden bg-[#0B1530] py-[clamp(48px,6vw,88px)] text-white scroll-mt-20">
          <div aria-hidden className="pointer-events-none absolute -top-32 right-0 h-96 w-96 rounded-full bg-indigo-500/25 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-sky-500/15 blur-3xl" />
          <div className="relative max-w-295 mx-auto px-5 sm:px-7 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <SectionReveal>
              <p className="text-[11px] font-bold uppercase tracking-widest text-accent">The rehearsal room</p>
              <h2 className="font-display mt-3 text-3xl sm:text-4xl font-semibold leading-tight tracking-tight">
                A panel that pushes back, so the real room doesn't surprise you
              </h2>
              <p className="mt-4 text-base leading-relaxed text-white/70 max-w-xl">
                Most founders find the gaps live, when a lead is already on the line. Here you pitch out
                loud to AI investors who listen, interrupt with hard follow-ups and debate your answers,
                so nothing surprises you in the real room.
              </p>
              <ul className="mt-8 grid sm:grid-cols-2 gap-x-6 gap-y-5">
                {roomFeatures.map((f) => (
                  <li key={f.title} className="flex gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-accent">
                      <f.icon size={17} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">{f.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-white/60">{f.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <Link to={startHref} className="btn-accent mt-9 px-6 py-3">
                <Mic size={17} /> Start a practice session
              </Link>
            </SectionReveal>

            <SectionReveal delay={0.1}>
              <LivePanelPreview />
            </SectionReveal>
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how-it-works" className="py-[clamp(48px,6vw,80px)] scroll-mt-20">
          <div className="max-w-295 mx-auto px-5 sm:px-7">
            <SectionReveal className="max-w-2xl">
              <p className="eyebrow">How it works</p>
              <h2 className="section-heading mt-3">Three steps to investor-ready</h2>
            </SectionReveal>
            <div className="relative mt-10 grid md:grid-cols-3 gap-5">
              <div aria-hidden className="pointer-events-none absolute left-0 right-0 top-9 hidden h-px bg-linear-to-r from-transparent via-slate-200 to-transparent md:block dark:via-zinc-800" />
              {steps.map((item, i) => (
                <SectionReveal key={item.step} delay={i * 0.08}>
                  <div className="card-hover relative h-full p-6">
                    <span className="gradient-brand flex h-10 w-10 items-center justify-center rounded-xl font-display text-sm font-semibold text-white shadow-lg shadow-indigo-500/20">
                      {item.step}
                    </span>
                    <h3 className="font-display mt-5 text-lg font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-zinc-400">{item.desc}</p>
                  </div>
                </SectionReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Your report ── */}
        <section id="your-report" className="py-[clamp(48px,6vw,80px)] bg-slate-50/80 dark:bg-zinc-900/30 border-y border-slate-100 dark:border-zinc-800/60 scroll-mt-20">
          <div className="max-w-295 mx-auto px-5 sm:px-7 grid lg:grid-cols-2 gap-12 items-start">
            <SectionReveal className="order-2 lg:order-1 lg:sticky lg:top-28">
              <ReportPreview />
            </SectionReveal>
            <SectionReveal delay={0.08} className="order-1 lg:order-2">
              <p className="eyebrow">Your report</p>
              <h2 className="section-heading mt-3">Walk away with a plan, not just a score</h2>
              <p className="section-subheading mt-4">
                The moment you finish, PitchNest writes a readiness report: the kind of prep a pitch
                coach would charge for. Re-pitch and it shows whether your fixes landed.
              </p>
              <ul className="mt-7 space-y-3">
                {reportItems.map((item) => (
                  <li key={item.lead} className="flex gap-3 text-sm leading-relaxed">
                    <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-indigo-500 dark:text-indigo-400" />
                    <p className="text-slate-600 dark:text-zinc-300">
                      <span className="font-semibold text-slate-800 dark:text-zinc-100">{item.lead}</span> — {item.rest}
                      {item.pdfOnly && (
                        <span className="ml-2 align-middle inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-slate-200/70 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
                          PDF
                        </span>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-xs text-slate-400 dark:text-zinc-500">
                Items marked PDF are in the downloadable report on paid plans. Everything else is on screen on every plan.
              </p>
            </SectionReveal>
          </div>
        </section>

        {/* ── Discover (real published businesses only) ── */}
        <DiscoverShowcase isLoggedIn={isLoggedIn} />

        {/* ── Why it works ── */}
        <section className="py-[clamp(40px,5vw,64px)] border-t border-slate-100 dark:border-zinc-800/60">
          <div className="max-w-295 mx-auto px-5 sm:px-7 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {whyItems.map((item, i) => (
              <SectionReveal key={item.title} delay={i * 0.05}>
                <div className="flex gap-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-text dark:bg-accent/10 dark:text-accent">
                    <item.icon size={18} />
                  </span>
                  <div>
                    <h3 className="font-display text-base font-semibold">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-zinc-400">{item.desc}</p>
                  </div>
                </div>
              </SectionReveal>
            ))}
          </div>
        </section>

        {/* ── Pricing (condensed; the full matrix lives on /pricing) ── */}
        <section id="pricing" className="py-[clamp(48px,6vw,80px)] bg-slate-50/80 dark:bg-zinc-900/30 border-y border-slate-100 dark:border-zinc-800/60 scroll-mt-20">
          <div className="max-w-295 mx-auto px-5 sm:px-7">
            <SectionReveal className="text-center max-w-2xl mx-auto mb-10">
              <p className="eyebrow justify-center">Pricing</p>
              <h2 className="section-heading mt-3">Start free. Upgrade when you're raising.</h2>
              <p className="section-subheading mx-auto mt-3">
                Every account gets 2 full pitch sessions a week with the complete scorecard on screen.
                Discover, business profiles and opportunities are free.
              </p>
            </SectionReveal>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 items-stretch">
              {plans.map((plan, i) => (
                <SectionReveal key={plan.name} delay={i * 0.05} className="h-full">
                  <div
                    className={cn(
                      "h-full rounded-2xl border p-6 flex flex-col",
                      plan.featured
                        ? "bg-[#0B1530] text-white border-accent/50 shadow-2xl shadow-indigo-900/20"
                        : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800",
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className={cn("text-sm font-bold", plan.featured ? "text-white" : "text-slate-900 dark:text-zinc-100")}>{plan.name}</p>
                      {plan.featured && (
                        <span className="rounded-full bg-accent px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-accent-ink">
                          Popular
                        </span>
                      )}
                    </div>
                    <p className={cn("font-display text-2xl font-semibold mb-1", plan.featured ? "text-accent" : "text-slate-900 dark:text-zinc-100")}>
                      {plan.price || (plan.id === "enterprise" ? "Custom" : "—")}
                    </p>
                    <p className={cn("text-xs mb-5", plan.featured ? "text-white/60" : "text-slate-500 dark:text-zinc-400")}>{plan.tagline}</p>
                    <ul className={cn("space-y-2 text-[13px] mb-6", plan.featured ? "text-white/80" : "text-slate-600 dark:text-zinc-400")}>
                      {plan.features.slice(0, 4).map((line) => (
                        <li key={line} className="flex items-start gap-2">
                          <CheckCircle2 size={15} className={cn("shrink-0 mt-0.5", plan.featured ? "text-accent" : "text-emerald-500")} />
                          {line}
                        </li>
                      ))}
                    </ul>
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
                              ? "bg-accent text-accent-ink hover:bg-[#FFE19C]"
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
              <Link to="/pricing" className="btn-secondary inline-flex px-6 py-3 text-sm">
                Compare plans in full <ArrowRight size={16} />
              </Link>
            </SectionReveal>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="py-[clamp(48px,6vw,80px)] scroll-mt-20">
          <div className="max-w-295 mx-auto px-5 sm:px-7 grid lg:grid-cols-12 gap-10 items-start">
            <SectionReveal className="lg:col-span-4 lg:sticky lg:top-28">
              <p className="eyebrow">FAQ</p>
              <h2 className="section-heading mt-3">Questions, answered</h2>
              <p className="section-subheading mt-3">
                Can't find what you need? We reply quickly on WhatsApp and email.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href="https://wa.me/2349058718400" target="_blank" rel="noreferrer" className="btn-secondary px-4 py-2.5">
                  <MessageCircle size={16} /> WhatsApp
                </a>
                <Link to="/support" className="btn-ghost">Support <ArrowRight size={15} /></Link>
              </div>
            </SectionReveal>
            <div className="lg:col-span-8 space-y-3">
              {faqs.map((faq, i) => (
                <SectionReveal key={faq.q} delay={i * 0.03}>
                  <FAQItem question={faq.q} answer={faq.a} />
                </SectionReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="max-w-295 mx-auto px-5 sm:px-7 pb-[clamp(48px,6vw,80px)]">
          <SectionReveal>
            <div className="relative overflow-hidden rounded-3xl bg-[#0B1530] px-6 py-12 text-center text-white sm:px-12 sm:py-16">
              <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-indigo-500/30 blur-3xl" />
              <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
              <div className="relative mx-auto max-w-2xl">
                <h2 className="font-display text-3xl sm:text-4xl font-semibold leading-tight">Your next pitch starts here.</h2>
                <p className="mt-4 text-base leading-relaxed text-white/70">
                  Rehearse until it's sharp, publish when you're proud of it, and take the next opportunity
                  with confidence.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                  <Link to={startHref} className="btn-accent px-7 py-3.5 text-base">
                    Start free <ArrowRight size={18} />
                  </Link>
                  <Link to="/discover" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-7 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10">
                    <Compass size={18} /> Explore Discover
                  </Link>
                </div>
              </div>
            </div>
          </SectionReveal>
        </section>

        {/* ── Footer ── */}
        <footer className="bg-slate-50 dark:bg-zinc-900/50 py-12 sm:py-16 border-t border-slate-200 dark:border-zinc-800 transition-colors">
          <div className="max-w-295 mx-auto px-5 sm:px-7 grid grid-cols-2 md:grid-cols-5 gap-8 sm:gap-10">
            <div className="col-span-2 md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <LogoMark size="xs" />
                <span className="text-base font-bold">PitchNest</span>
              </div>
              <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed mb-5 max-w-xs">
                Rehearse your pitch, showcase your business, and find your next opportunity.
              </p>
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
                  <MessageCircle size={16} />
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-bold mb-4 text-sm">Platform</h4>
              <ul className="space-y-2.5 text-sm text-slate-500 dark:text-zinc-400">
                <li><a href="#room" className="hover:text-sky-600 dark:hover:text-sky-400">Pitch rehearsal</a></li>
                <li><Link to="/discover" className="hover:text-sky-600 dark:hover:text-sky-400">Discover</Link></li>
                <li><Link to="/opportunities" className="hover:text-sky-600 dark:hover:text-sky-400">Opportunities</Link></li>
                <li><Link to="/pricing" className="hover:text-sky-600 dark:hover:text-sky-400">Pricing</Link></li>
                <li><a href="#faq" className="hover:text-sky-600 dark:hover:text-sky-400">FAQ</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4 text-sm">Legal</h4>
              <ul className="space-y-2.5 text-sm text-slate-500 dark:text-zinc-400">
                <li><Link to="/privacy" className="hover:text-sky-600 dark:hover:text-sky-400">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-sky-600 dark:hover:text-sky-400">Terms of Service</Link></li>
                <li><Link to="/delete-account" className="hover:text-sky-600 dark:hover:text-sky-400">Delete Account</Link></li>
                <li><Link to="/support" className="hover:text-sky-600 dark:hover:text-sky-400">Support</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4 text-sm">Get in touch</h4>
              <ul className="space-y-2.5 text-sm text-slate-500 dark:text-zinc-400">
                <li><a href="tel:09058718400" className="hover:text-sky-600 dark:hover:text-sky-400 flex items-center gap-2"><Phone size={14} className="shrink-0" /> 09058718400</a></li>
                <li><a href="mailto:pitchnestapp@gmail.com" className="hover:text-sky-600 dark:hover:text-sky-400 flex items-center gap-2 break-all"><Mail size={14} className="shrink-0" /> pitchnestapp@gmail.com</a></li>
                <li><a href="https://wa.me/2349058718400" target="_blank" rel="noreferrer" className="hover:text-green-500 flex items-center gap-2"><MessageCircle size={14} className="shrink-0" /> WhatsApp</a></li>
              </ul>
            </div>
          </div>
          <div className="max-w-295 mx-auto px-5 sm:px-7 mt-10 sm:mt-14 pt-6 border-t border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-slate-400 dark:text-zinc-500">
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
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center justify-between p-5 text-left">
        <span className="font-display text-sm sm:text-base font-semibold pr-4">{question}</span>
        <ChevronDown size={18} className={cn("shrink-0 text-slate-400 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.35, ease: heroEase }}
          className="px-5 pb-5 text-sm leading-relaxed text-slate-500 dark:text-zinc-400"
        >
          {answer}
        </motion.div>
      )}
    </div>
  );
}
