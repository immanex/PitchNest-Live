import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import AppLayout from "./components/AppLayout";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import VerifyEmail from "./components/VerifyEmail";
import Dashboard from "./pages/Dashboard";
// import Analytics from "./pages/Analytics"; // MVP: coming soon
import SettingsPage from "./pages/SettingsPage";
import LivePitchRoom from "./pages/LivePitchRoom";
import PostPitchReport from "./pages/PostPitchReport";
import PrePitchSetup from "./pages/PrePitchSetup";
// import PitchDecksManagement from "./pages/PitchDecksManagement"; // MVP: coming soon
// import DeckCheck from "./pages/DeckCheck"; // MVP: coming soon
import PitchReplayScreen from "./pages/PitchReplayScreen";
import MyPitchesArchive from "./pages/MyPitchesArchive";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import TermsOfService from "./pages/legal/TermsOfService";
import DeleteAccount from "./pages/legal/DeleteAccount";
import Support from "./pages/legal/Support";
import PricingPage from "./pages/PricingPage";
// Public, unauthenticated: a founder's shared pitch report, addressed by a
// revocable share id. Deliberately outside ProtectedRoute — the recipient is an
// investor or an accelerator who may not have an account and should not need one.
import PublicPitch from "./pages/PublicPitch";
import { SocketProvider } from "./contexts/SocketContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ThemeProvider } from "./contexts/ThemeContext";
import { BillingProvider } from "./contexts/BillingContext";
import { UpgradeProvider } from "./components/ui/UpgradeModal";
import BillingReturn from "./pages/BillingReturn";
import { ErrorBoundary } from "./components/ErrorBoundary";
import OrganizationDashboard from "./pages/organization/dashbaord/Main";
import OrganizationLogin from "./pages/organization/auth/Login"

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <ThemeProvider>
          <BillingProvider>
          <UpgradeProvider>
          <VercelAnalytics />
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
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
             <Route path="/organization" element={<OrganizationDashboard />} />

            {/* Protected Routes (Wrapped in AppLayout with Sidebar) */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
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

            {/* LivePitchRoom — SocketProvider wraps ONLY this route, not the whole app */}
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
          </UpgradeProvider>
          </BillingProvider>
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
}
