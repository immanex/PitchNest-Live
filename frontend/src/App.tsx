import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
// The landing page is the most common first screen, so it ships in the main
// bundle. Every other page loads on demand (see lazyPage) — a visitor reading
// the landing page no longer downloads the pitch room, charts, forms and the
// organization dashboard up front.
import LandingPage from "./pages/LandingPage";
import { lazyPage } from "./lib/lazyPage";
import { SocketProvider } from "./contexts/SocketContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { OrganizationProtectedRoute } from "./components/OrganizationProtectedRoute";
import { ThemeProvider } from "./contexts/ThemeContext";
import { BillingProvider } from "./contexts/BillingContext";
import { UpgradeProvider } from "./components/ui/UpgradeModal";
import { ErrorBoundary } from "./components/ErrorBoundary";

const AppLayout = lazyPage(() => import("./components/AppLayout"));
const LoginPage = lazyPage(() => import("./pages/LoginPage"));
const SignupPage = lazyPage(() => import("./pages/SignupPage"));
const ForgotPassword = lazyPage(() => import("./pages/ForgotPassword"));
const ResetPassword = lazyPage(() => import("./pages/ResetPassword"));
const Onboarding = lazyPage(() => import("./pages/Onboarding"));
const VerifyEmail = lazyPage(() => import("./components/VerifyEmail"));
const Dashboard = lazyPage(() => import("./pages/Dashboard"));
// const Analytics = lazyPage(() => import("./pages/Analytics")); // MVP: coming soon
const SettingsPage = lazyPage(() => import("./pages/SettingsPage"));
const LivePitchRoom = lazyPage(() => import("./pages/LivePitchRoom"));
const PostPitchReport = lazyPage(() => import("./pages/PostPitchReport"));
const PrePitchSetup = lazyPage(() => import("./pages/PrePitchSetup"));
// const PitchDecksManagement = lazyPage(() => import("./pages/PitchDecksManagement")); // MVP: coming soon
// const DeckCheck = lazyPage(() => import("./pages/DeckCheck")); // MVP: coming soon
const PitchReplayScreen = lazyPage(() => import("./pages/PitchReplayScreen"));
const MyPitchesArchive = lazyPage(() => import("./pages/MyPitchesArchive"));
const PrivacyPolicy = lazyPage(() => import("./pages/legal/PrivacyPolicy"));
const TermsOfService = lazyPage(() => import("./pages/legal/TermsOfService"));
const DeleteAccount = lazyPage(() => import("./pages/legal/DeleteAccount"));
const Support = lazyPage(() => import("./pages/legal/Support"));
const PricingPage = lazyPage(() => import("./pages/PricingPage"));
// Public, unauthenticated: a founder's shared pitch report, addressed by a
// revocable share id. Deliberately outside ProtectedRoute — the recipient is an
// investor or an accelerator who may not have an account and should not need one.
const PublicPitch = lazyPage(() => import("./pages/PublicPitch"));
const BillingReturn = lazyPage(() => import("./pages/BillingReturn"));
const OrganizationDashboard = lazyPage(() => import("./pages/organization/dashbaord/Main"));
const OrganizationLogin = lazyPage(() => import("./pages/organization/auth/Login"));
const BusinessWorkspace = lazyPage(() => import("./pages/BusinessWorkspace"));
const Discover = lazyPage(() => import("./pages/Discover"));
const PublicBusinessProfile = lazyPage(() => import("./pages/PublicBusinessProfile"));
const FounderProfile = lazyPage(() => import("./pages/FounderProfile"));
const ModerationPage = lazyPage(() => import("./pages/staff/ModerationPage"));
const Community = lazyPage(() => import("./pages/Community"));
const CommunityThread = lazyPage(() => import("./pages/CommunityThread"));
const Opportunities = lazyPage(() => import("./pages/Opportunities"));
const OpportunitiesAdmin = lazyPage(() => import("./pages/staff/OpportunitiesAdmin"));
const StaffAnalytics = lazyPage(() => import("./pages/staff/AnalyticsPage"));
const PitchArena = lazyPage(() => import("./pages/PitchArena"));
const Home = lazyPage(() => import("./pages/Home"));

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <ThemeProvider>
          <BillingProvider>
          <UpgradeProvider>
          <VercelAnalytics />
          {/* Outer boundaries for on-demand pages. Pages inside the sidebar
              layout have their own Suspense around the Outlet (AppLayout), so
              moving between app pages keeps the sidebar on screen. */}
          <ErrorBoundary>
          <React.Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomeGate />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/organization-login" element={<OrganizationLogin />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/delete-account" element={<DeleteAccount />} />
            <Route path="/support" element={<Support />} />
            <Route path="/pricing" element={<PricingPage />} />
            {/* Shared pitch report — see pages/PublicPitch.tsx. Must be declared
                above the "*" catch-all below or it would redirect to "/". */}
            <Route path="/share/:shareId" element={<PublicPitch />} />
            <Route
              path="/organization"
              element={
                <OrganizationProtectedRoute>
                  <OrganizationDashboard />
                </OrganizationProtectedRoute>
              }
            />

            {/* One frame (AppLayout: sidebar, top bar, phone tabs) for every
                app page. Ecosystem pages are public; private pages sit in the
                nested ProtectedRoute. Sharing the layout keeps the sidebar
                mounted when moving between the two. */}
            <Route element={<AppLayout />}>
              <Route
                path="/home"
                element={
                  <ErrorBoundary>
                    <Home />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/discover"
                element={
                  <ErrorBoundary>
                    <Discover />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/businesses/:slug"
                element={
                  <ErrorBoundary>
                    <PublicBusinessProfile />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/founders/:handle"
                element={
                  <ErrorBoundary>
                    <FounderProfile />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/opportunities"
                element={
                  <ErrorBoundary>
                    <Opportunities />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/community"
                element={
                  <ErrorBoundary>
                    <Community />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/community/:threadId"
                element={
                  <ErrorBoundary>
                    <CommunityThread />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/pitches"
                element={
                  <ErrorBoundary>
                    <PitchArena />
                  </ErrorBoundary>
                }
              />

            <Route
              element={
                <ProtectedRoute inline>
                  <Outlet />
                </ProtectedRoute>
              }
            >
              <Route
                path="/dashboard"
                element={
                  <ErrorBoundary>
                    <Dashboard />
                  </ErrorBoundary>
                }
              />
              {/* MVP: coming soon — redirect to dashboard until re-enabled */}
              <Route path="/analytics" element={<Navigate to="/dashboard" replace />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route
                path="/workspace/businesses"
                element={
                  <ErrorBoundary>
                    <BusinessWorkspace />
                  </ErrorBoundary>
                }
              />
              {/* Staff-only; the API returns 404 to non-staff and the page says so. */}
              <Route
                path="/staff/moderation"
                element={
                  <ErrorBoundary>
                    <ModerationPage />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/staff/opportunities"
                element={
                  <ErrorBoundary>
                    <OpportunitiesAdmin />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/staff/analytics"
                element={
                  <ErrorBoundary>
                    <StaffAnalytics />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/report"
                element={
                  <ErrorBoundary>
                    <PostPitchReport />
                  </ErrorBoundary>
                }
              />
              <Route path="/setup" element={<PrePitchSetup />} />
              {/* MVP: coming soon — redirect to dashboard until re-enabled */}
              <Route path="/decks" element={<Navigate to="/dashboard" replace />} />
              <Route path="/deck-check" element={<Navigate to="/dashboard" replace />} />
              {/* Replay: audio + transcript replay for a finished pitch. The
                  archive and dashboard link here — it must be a real page. */}
              <Route
                path="/replay"
                element={
                  <ErrorBoundary>
                    <PitchReplayScreen />
                  </ErrorBoundary>
                }
              />
              <Route path="/archive" element={<MyPitchesArchive />} />
            </Route>
            </Route>

            {/* Special Full-screen Routes (No Sidebar) */}

            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              }
            />
            {/* Checkout return. Full-screen (no sidebar) and protected — the
                page confirms the account's plan, so it needs the session. */}
            <Route
              path="/billing/return"
              element={
                <ProtectedRoute>
                  <BillingReturn />
                </ProtectedRoute>
              }
            />
            <Route
              path="/verify"
              element={
                // <ProtectedRoute>
                <VerifyEmail />
                // </ProtectedRoute>
              }
            />

            {/* LivePitchRoom — SocketProvider wraps ONLY this route, not the whole app.
                The setup page preloads this page's code so entering the room is instant. */}
            <Route
              path="/room"
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <SocketProvider>
                      <LivePitchRoom />
                    </SocketProvider>
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />

            {/* Safety Catch: Redirect old /live links to /room */}
            <Route path="/live" element={<Navigate to="/room" replace />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </React.Suspense>
          </ErrorBoundary>
          </UpgradeProvider>
          </BillingProvider>
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
}

/** True when this browser holds a founder session (organizations excluded). */
function hasStoredFounderSession() {
  try {
    if (!localStorage.getItem("token")) return false;
    const stored = JSON.parse(localStorage.getItem("user") || "null");
    return Boolean(stored?.id) && stored.accountType !== "organization";
  } catch {
    return false;
  }
}

/**
 * "/" is the marketing landing page for visitors. Signed-in founders go
 * straight to the in-app Home feed. While the session is still being checked
 * the stored copy decides, so returning founders never see the landing page
 * flash; if the session turns out to be invalid, /home simply shows the
 * visitor view.
 */
function HomeGate() {
  const { user, isLoading } = useAuth();
  const founder = user ? user.accountType !== "organization" : isLoading && hasStoredFounderSession();
  if (founder) return <Navigate to="/home" replace />;
  return <LandingPage />;
}

/** Shown for the moment a page's code is downloading. */
function RouteFallback() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#09090B]"
      role="status"
      aria-label="Loading"
    >
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-sky-500 dark:border-zinc-800 dark:border-t-sky-400" />
    </div>
  );
}
