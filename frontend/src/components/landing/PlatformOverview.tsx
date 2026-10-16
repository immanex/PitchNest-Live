import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Compass, Lock, Mic, TrendingUp, type LucideIcon } from 'lucide-react';
import { SectionReveal } from './SectionReveal';
import { useEcosystemFeatures } from '../../hooks/useEcosystemFeatures';
import { cn } from '../../lib/utils';

interface Benefit {
  text: string;
  /** False while the server feature flag is off: shown, but marked "Soon". */
  live?: boolean;
}

interface Pillar {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  promise: string;
  benefits: Benefit[];
  cta: { label: string; to: string };
  tone: string;
}

/**
 * Landing-page overview of everything one account gets: private rehearsal,
 * a public business profile, and ways to grow. Features behind a server flag
 * (Discover engagement, Community, Pitch Arena) read the live flags, so the page
 * never sells something a visitor would find switched off.
 */
export function PlatformOverview({ isLoggedIn }: { isLoggedIn: boolean }) {
  const features = useEcosystemFeatures();

  const pillars: Pillar[] = [
    {
      icon: Mic,
      eyebrow: 'Prepare',
      title: 'Rehearse with an AI investor panel',
      promise: 'Pitch out loud in private and find the gaps before a real investor does.',
      benefits: [
        { text: 'Panel, 1-on-1 Coach or Solo practice' },
        { text: 'Questions grounded in your own deck' },
        { text: 'A scored readiness report the moment you finish' },
        { text: 'Re-pitch and watch your score move' },
      ],
      cta: { label: 'Start practising free', to: isLoggedIn ? '/setup' : '/signup' },
      tone: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300',
    },
    {
      icon: Compass,
      eyebrow: 'Showcase',
      title: 'Give your business a public home',
      promise: "Publish a profile when you're ready, so customers, supporters and partners can find you.",
      benefits: [
        { text: 'A shareable business profile on Discover' },
        { text: 'You preview and approve every public field' },
        { text: 'Follows, support and questions on your profile', live: features.discoverEngagement },
        { text: 'Updates and milestones your followers see', live: features.discoverEngagement },
      ],
      cta: { label: 'Explore Discover', to: '/discover' },
      tone: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
    },
    {
      icon: TrendingUp,
      eyebrow: 'Grow',
      title: 'Find what moves you forward',
      promise: 'Opportunities and fellow founders, in the same place you prepare.',
      benefits: [
        { text: 'Accelerators, grants, competitions and fellowships, with official links' },
        { text: 'Practise answering questions people ask about you', live: features.discoverEngagement },
        { text: 'Community discussions with other founders', live: features.community },
        { text: 'Pitch Arena: post a written pitch for structured feedback', live: features.pitchArena },
      ],
      cta: { label: 'See opportunities', to: '/opportunities' },
      tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
    },
  ];

  return (
    <section id="platform" className="py-[clamp(36px,4vw,60px)] scroll-mt-28">
      <div className="max-w-295 mx-auto px-5 sm:px-7">
        <SectionReveal className="text-center mb-8 sm:mb-10 max-w-3xl mx-auto">
          <p className="eyebrow justify-center mb-3">One account</p>
          <h2 className="section-heading mb-4">Prepare in private. Showcase in public. Grow with founders.</h2>
          <p className="section-subheading mx-auto">
            PitchNest is where you get ready for the room and where people find what you're building.
            Start with practice; publish only when you choose to.
          </p>
        </SectionReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {pillars.map((pillar, i) => (
            <SectionReveal key={pillar.eyebrow} delay={i * 0.06}>
              <div className="card-hover p-6 h-full flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', pillar.tone)}>
                    <pillar.icon size={18} />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                    {pillar.eyebrow}
                  </p>
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{pillar.title}</h3>
                <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed mb-5">{pillar.promise}</p>

                <ul className="space-y-2.5 mb-6">
                  {pillar.benefits.map((benefit) => {
                    const soon = benefit.live === false;
                    return (
                      <li key={benefit.text} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2
                          size={16}
                          className={cn(
                            'shrink-0 mt-0.5',
                            soon ? 'text-slate-300 dark:text-zinc-600' : 'text-emerald-500',
                          )}
                        />
                        <span className={soon ? 'text-slate-400 dark:text-zinc-500' : 'text-slate-600 dark:text-zinc-300'}>
                          {benefit.text}
                          {soon && (
                            <span className="ml-2 align-middle inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">
                              Soon
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <Link
                  to={pillar.cta.to}
                  className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:gap-2.5 transition-all"
                >
                  {pillar.cta.label} <ArrowRight size={15} />
                </Link>
              </div>
            </SectionReveal>
          ))}
        </div>

        <SectionReveal className="mt-6">
          <p className="text-xs text-slate-400 dark:text-zinc-500 text-center">
            <Lock size={13} className="inline-block -mt-0.5 mr-1.5 align-middle" aria-hidden="true" />
            Nothing goes public until you preview it and confirm. Invited organization members separately share scores and feedback with that organization.
          </p>
        </SectionReveal>
      </div>
    </section>
  );
}
