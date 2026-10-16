import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Compass, ShieldCheck } from 'lucide-react';
import { SectionReveal } from './SectionReveal';
import { BusinessCard, BusinessCardSkeleton } from '../discover/BusinessCard';
import { fetchPublicBusinesses, type PublicBusinessSummary } from '../../api/publicBusinesses';

const SHOWCASE_LIMIT = 6;
// Render's free tier can take most of a minute to wake. Rather than show
// skeletons that long, fall back to the invitation; real cards still replace
// it if the request finishes later.
const SLOW_BACKEND_MS = 8000;

/**
 * Landing-page entry into Discover: up to six real, founder-published
 * businesses and a way to browse or publish. Never shows demo companies; with
 * nothing published yet it shows an invitation to be one of the first.
 */
export function DiscoverShowcase({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [businesses, setBusinesses] = useState<PublicBusinessSummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'invite'>('loading');

  useEffect(() => {
    const controller = new AbortController();
    const slowTimer = window.setTimeout(() => {
      setStatus((current) => (current === 'loading' ? 'invite' : current));
    }, SLOW_BACKEND_MS);

    fetchPublicBusinesses({ limit: SHOWCASE_LIMIT }, controller.signal)
      .then((page) => {
        setBusinesses(page.data);
        setStatus(page.data.length ? 'ready' : 'invite');
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') setStatus('invite');
      })
      .finally(() => window.clearTimeout(slowTimer));

    return () => {
      window.clearTimeout(slowTimer);
      controller.abort();
    };
  }, []);

  // Signed-out visitors sign up first; the workspace is behind login.
  const showcaseHref = isLoggedIn ? '/workspace/businesses' : '/signup';

  return (
    <section
      id="discover-businesses"
      className="py-[clamp(36px,4vw,60px)] border-t border-slate-100 dark:border-zinc-800/60 scroll-mt-28"
    >
      <div className="max-w-295 mx-auto px-5 sm:px-7">
        <SectionReveal className="text-center mb-8 sm:mb-10 max-w-3xl mx-auto">
          <p className="eyebrow justify-center mb-3">Discover</p>
          <h2 className="section-heading mb-4">Great businesses deserve to be discovered</h2>
          <p className="section-subheading mx-auto">
            Founders building software, services, physical products and traditional businesses share what
            they're working on. Browse their profiles, or publish your own when you're ready.
          </p>
        </SectionReveal>

        {status === 'loading' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" aria-busy="true" aria-label="Loading businesses">
            {Array.from({ length: 3 }).map((_, index) => <BusinessCardSkeleton key={index} />)}
          </div>
        )}

        {status === 'ready' && (
          <SectionReveal>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {businesses.map((business) => (
                <BusinessCard key={business.slug} business={business} headingLevel="h3" />
              ))}
            </div>
          </SectionReveal>
        )}

        {status === 'invite' && (
          <SectionReveal>
            <div className="card p-6 sm:p-8 text-center max-w-2xl mx-auto">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mx-auto mb-4 text-indigo-600 dark:text-indigo-300">
                <Compass size={20} />
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">Discover is opening to its first founders</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
                Create a private business profile, rehearse with it, and publish when you're ready.
                Nothing goes public until you review it and confirm.
              </p>
            </div>
          </SectionReveal>
        )}

        {status !== 'loading' && (
          <SectionReveal className="mt-8 flex flex-col items-center gap-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full sm:w-auto">
              {status === 'ready' && (
                <Link to="/discover" className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-3 text-sm">
                  Explore businesses <ArrowRight size={16} />
                </Link>
              )}
              <Link
                to={showcaseHref}
                className={`${status === 'ready' ? 'btn-secondary' : 'btn-primary'} inline-flex items-center justify-center gap-2 px-6 py-3 text-sm`}
              >
                Showcase your business {status !== 'ready' && <ArrowRight size={16} />}
              </Link>
            </div>
            <p className="text-xs text-slate-400 dark:text-zinc-500 text-center">
              <ShieldCheck size={13} className="inline-block -mt-0.5 mr-1.5 align-middle" aria-hidden="true" />
              Your decks, recordings and transcripts never appear publicly; publishing a business is a separate choice.
            </p>
          </SectionReveal>
        )}
      </div>
    </section>
  );
}
