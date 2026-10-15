import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  User,
  Shield,
  CreditCard,
  Bell,
  Mic,
  Lock,
  Edit3,
  LogOut,
  Trash2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import * as Switch from '@radix-ui/react-switch';
import * as Tabs from '@radix-ui/react-tabs';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useBilling } from '../contexts/BillingContext';
import { formatPrice } from '../lib/plans';
import { planLabel } from '../lib/entitlements';
import { CONTACT_EMAIL } from '../lib/legal';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import {
  DEFAULT_STT_LOCALE,
  TRANSCRIPTION_LOCALES,
  isSupportedSttLocale,
  sttLocaleLabel,
} from '../lib/transcriptionLocales';

// --- Subcomponents ---
const SettingSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div className="space-y-6">
    <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100 border-b border-slate-100 dark:border-zinc-800 pb-4">{title}</h3>
    {children}
  </div>
);

const SettingItem = ({ label, description, children }: { label: string, description?: string, children: React.ReactNode }) => (
  <div className="flex items-center justify-between py-2">
    <div className="max-w-md pr-4">
      <p className="text-sm font-bold text-slate-900 dark:text-zinc-100">{label}</p>
      {description && <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">{description}</p>}
    </div>
    {children}
  </div>
);

// --- Main Component ---
export default function SettingsPage() {
  const navigate = useNavigate();
  const { logout, authFetch, user } = useAuth();

  /**
   * Which tab is open, deep-linkable as ?tab=subscription so an "Upgrade" CTA
   * anywhere in the app can land the user on the right panel. Unknown values
   * fall back to profile rather than rendering an empty page.
   */
  const TAB_IDS = ["profile", "account", "subscription", "notifications", "voice"] as const;
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab") ?? "";
  const [activeTab, setActiveTabState] = useState<string>(
    (TAB_IDS as readonly string[]).includes(requestedTab) ? requestedTab : "profile",
  );

  // Follow the query string when it changes under us (e.g. the sidebar CTA
  // pressed while Settings is already open).
  useEffect(() => {
    if ((TAB_IDS as readonly string[]).includes(requestedTab) && requestedTab !== activeTab) {
      setActiveTabState(requestedTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedTab]);

  const setActiveTab = (next: string) => {
    setActiveTabState(next);
    // Keep the URL shareable/back-button-correct without stacking history.
    setSearchParams(next === "profile" ? {} : { tab: next }, { replace: true });
  };
  const { info: billing, upgrade } = useBilling();
  const currentPlan = billing.plan; // server-authoritative: free | prep | pro
  const isPaid = currentPlan === "pro" || currentPlan === "prep";
  // Purchase selector state (only meaningful for a non-paid user).
  const [selPlan, setSelPlan] = useState<"prep" | "pro">("pro");
  const [selTerm, setSelTerm] = useState<"monthly" | "annual">("monthly");
  const [startingCheckout, setStartingCheckout] = useState(false);
  // The real Pro price, from the server (config-driven). Never hardcode it —
  // that is exactly what produced the "$0/mo" bug. formatPrice returns "" when
  // the server sent nothing usable, so the empty string falls through too.
  const proPriceLabel =
    (billing.price
      ? formatPrice(billing.price.amount, billing.price.currency, billing.price.days)
      : '') || 'See pricing';
  // Price for the SKU the user is currently choosing, from the server catalog.
  const selectedSku =
    billing.catalog.find((c) => c.plan === selPlan && c.term === selTerm) || null;
  const selectedPriceLabel =
    (selectedSku
      ? formatPrice(selectedSku.amount, selectedSku.currency, selectedSku.days)
      : '') || 'See pricing';
  const handleUpgrade = async () => {
    setStartingCheckout(true);
    // On success the browser is redirected to the hosted page, so we only clear
    // the spinner on failure.
    const ok = await upgrade({ plan: selPlan, term: selTerm });
    if (!ok) setStartingCheckout(false);
  };
  const [notifications, setNotifications] = useState({
    pitchAlerts: true,
    weeklyReport: false,
    investorInquiries: true,
    // In-app ecosystem notifications. On unless the user turns them off; the
    // server treats a missing key as on too.
    businessActivity: true,
    followedUpdates: true,
    followedFounders: true,
    communityReplies: true,
  });

  // Recognition language for live sessions. `null` means "no preference" — we
  // then show the server default but never write it, so a later change to the
  // default reaches everyone who never actively chose.
  const [sttLocale, setSttLocale] = useState<string | null>(null);
  const effectiveSttLocale = sttLocale ?? DEFAULT_STT_LOCALE;

  const ROLE_OPTIONS = ["Founder", "Investor", "Advisor"] as const;
  type Role = (typeof ROLE_OPTIONS)[number];

  const [userData, setUserData] = useState<{ name: string, email?: string, bio?: string, avatarUrl?: string, role?: Role }>({
    name: "Founder",
    role: "Founder",
  });

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editRole, setEditRole] = useState<Role>("Founder");
  const [profileError, setProfileError] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteGoogleCredential, setDeleteGoogleCredential] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUserData(prev => ({
          ...prev,
          ...parsed,
          role: parsed.role || prev.role,
          bio: parsed.bio ?? prev.bio,
        }));

        const s = parsed.settings;
        if (s && typeof s === "object") {
          if (s.notifications && typeof s.notifications === "object") {
            setNotifications(prev => ({ ...prev, ...s.notifications }));
          }
          // Only adopt a locale the server would accept; anything else stays
          // "no preference" rather than rendering a value that cannot be saved.
          if (isSupportedSttLocale(s.sttLocale)) setSttLocale(s.sttLocale);
        }
      } catch (e) { }
    }
  }, []);

  const persistSettings = async (partial: Record<string, unknown>) => {
    try {
      const res = await authFetch('/api/auth/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: partial }),
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      storedUser.settings = { ...(storedUser.settings || {}), ...(data.settings || partial) };
      localStorage.setItem("user", JSON.stringify(storedUser));
      window.dispatchEvent(new Event("userUpdate"));
    } catch (e) {
      /* non-blocking */
    }
  };

  const handleEditToggle = () => {
    if (!isEditing) {
      setEditName(userData.name);
      setEditBio(userData.bio || "");
      setEditRole(userData.role || "Founder");
      setProfileError("");
    }
    setIsEditing(!isEditing);
  };

  const handleSaveProfile = async () => {
    setProfileError("");
    setIsSavingProfile(true);
    try {
      // Name, bio, and role are persisted to the backend. Email is read-only
      // here (it is the login identity), so it is never sent and stays local.
      const res = await authFetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, bio: editBio, role: editRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile.');
      }

      // Take the server's authoritative name/bio/role; keep email as-is.
      const updated = {
        ...userData,
        name: data.user?.name ?? editName,
        bio: data.user?.bio ?? editBio,
        role: (data.user?.role as Role) || editRole,
      };
      setUserData(updated);
      localStorage.setItem("user", JSON.stringify(updated));
      window.dispatchEvent(new Event("userUpdate"));
      setIsEditing(false);
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError("");

    if (!file.type.startsWith("image/")) {
      setAvatarError("Please choose an image file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Image must be under 5MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append("avatar", file);
      const res = await authFetch("/api/upload-avatar", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.avatarUrl) {
        throw new Error(data.error || "Failed to upload image.");
      }

      const updated = { ...userData, avatarUrl: data.avatarUrl };
      setUserData(updated);
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      storedUser.avatarUrl = data.avatarUrl;
      localStorage.setItem("user", JSON.stringify(storedUser));
      window.dispatchEvent(new Event("userUpdate"));
    } catch (err: unknown) {
      setAvatarError(err instanceof Error ? err.message : "Failed to upload image.");
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleDeleteAccount = async () => {
    setDeleteError('');
    if (!deleteConfirmed) {
      setDeleteError('Please confirm you understand this is permanent.');
      return;
    }
    if (user?.authProvider === 'google' ? !deleteGoogleCredential : !deletePassword) {
      setDeleteError(user?.authProvider === 'google' ? 'Confirm your Google account.' : 'Enter your password to confirm deletion.');
      return;
    }

    setIsDeleting(true);
    try {
      const res = await authFetch('/api/auth/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: deletePassword,
          googleCredential: deleteGoogleCredential,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete account.');
      logout();
      navigate('/', { replace: true });
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-zinc-100 mb-2 tracking-tight">Settings</h1>
        <p className="text-slate-500 dark:text-zinc-500">Manage your account, plan, and AI customization.</p>
      </div>

      {/* Controlled, not defaultValue: an Upgrade CTA pressed while already on
          this page changes only the query string — React Router does not
          remount, so an uncontrolled tab would ignore the deep link. */}
      <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex flex-col md:flex-row gap-8">
        <Tabs.List className="flex flex-row md:flex-col gap-1 w-full md:w-64 shrink-0 overflow-x-auto pb-4 md:pb-0 custom-scrollbar">
          {[
            { id: "profile", label: "Profile", icon: User },
            { id: "account", label: "Account", icon: Shield },
            { id: "subscription", label: "Subscription", icon: CreditCard },
            { id: "notifications", label: "Notifications", icon: Bell },
            { id: "voice", label: "Voice & Language", icon: Mic },
          ].map((tab) => (
            <Tabs.Trigger
              key={tab.id}
              value={tab.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-500 dark:text-zinc-400 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:text-sky-600 dark:data-[state=active]:text-sky-400 data-[state=active]:shadow-sm transition-all text-left whitespace-nowrap outline-none"
            >
              <tab.icon size={18} />
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <div className="flex-1 bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-6 md:p-10 shadow-sm min-h-150 transition-colors">

          {/* PROFILE TAB */}
          <Tabs.Content value="profile" className="space-y-10 outline-none flex flex-col h-full">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100">Profile Details</h2>
              {!isEditing && (
                <button
                  onClick={handleEditToggle}
                  className="text-sm font-bold text-sky-500 hover:text-sky-600 flex items-center gap-1 transition-colors active:scale-95 cursor-pointer"
                >
                  <Edit3 size={14} />
                  Edit Profile
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-8 p-8 bg-slate-50 dark:bg-zinc-800/50 rounded-4xl transition-colors">
              <div className="shrink-0 flex flex-col items-center">
                <div className="relative">
                  <img
                    src={userData.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.name}`}
                    className="w-24 h-24 rounded-full border-4 border-white dark:border-zinc-800 shadow-lg bg-sky-100 object-cover"
                    alt="Profile Avatar"
                  />
                  <button
                    onClick={handleAvatarClick}
                    disabled={isUploadingAvatar}
                    className="absolute bottom-0 right-0 p-2 bg-white dark:bg-zinc-900 rounded-full shadow-md text-slate-400 dark:text-zinc-500 hover:text-sky-500 transition-colors border border-slate-100 dark:border-zinc-800 active:scale-95 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isUploadingAvatar ? <Loader2 size={14} className="animate-spin" /> : <Edit3 size={14} />}
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
                {avatarError && (
                  <p className="mt-2 text-[10px] text-rose-500 text-center max-w-30">{avatarError}</p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6 flex-1 w-full">
                {isEditing ? (
                  <>
                    <div className="col-span-1">
                      <label className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Full Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                        placeholder="Enter full name"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Email Address</label>
                      <input
                        type="email"
                        value={userData.email || ""}
                        readOnly
                        disabled
                        className="w-full px-4 py-2.5 bg-slate-100 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-500 dark:text-zinc-400 cursor-not-allowed focus:outline-none"
                      />
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">Email can't be changed.</p>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Role</label>
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value as Role)}
                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 appearance-none cursor-pointer"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Founder Bio</label>
                      <textarea
                        rows={4}
                        value={editBio}
                        onChange={(e) => setEditBio(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 resize-none leading-relaxed"
                        placeholder="Tell investors about yourself..."
                      />
                    </div>
                    {profileError && (
                      <div className="sm:col-span-2">
                        <p className="text-xs font-bold text-rose-500">{profileError}</p>
                      </div>
                    )}
                    <div className="sm:col-span-2 flex justify-end gap-3 mt-2">
                      <button
                        onClick={() => { setIsEditing(false); setProfileError(""); }}
                        disabled={isSavingProfile}
                        className="px-4 py-2 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        disabled={isSavingProfile}
                        className="px-5 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
                      >
                        {isSavingProfile && <Loader2 size={14} className="animate-spin" />}
                        {isSavingProfile ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Full Name</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-zinc-100">{userData.name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Email Address</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-zinc-100">{userData.email || "No email provided"}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Role</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-zinc-100">{userData.role || "Founder"}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Founder Bio</p>
                      <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                        {userData.bio || "No bio yet. Add one so investors know your story."}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="mt-auto pt-10 flex justify-end border-t border-slate-100 dark:border-zinc-800">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-6 py-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 font-bold text-sm rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors active:scale-95"
              >
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          </Tabs.Content>

          {/* ACCOUNT TAB */}
          <Tabs.Content value="account" className="space-y-10 outline-none">
            <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100">Account Security</h2>
            <SettingSection title="Security Settings">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-100 dark:border-zinc-800 rounded-2xl gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-50 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-slate-400 dark:text-zinc-500 shrink-0">
                      <Lock size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-zinc-100">Password</p>
                      <p className="text-xs text-slate-500 dark:text-zinc-500">Reset it by email</p>
                    </div>
                  </div>
                  <Link
                    to="/forgot-password"
                    className="px-4 py-2 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors w-full sm:w-auto active:scale-95 inline-block text-center"
                  >
                    Change Password
                  </Link>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-100 dark:border-zinc-800 rounded-2xl gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-slate-50 dark:bg-zinc-800 text-slate-400">
                      <Shield size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-zinc-100">Two-factor Authentication</p>
                      <p className="text-xs text-slate-500 dark:text-zinc-500">
                        Add an extra layer of security to your account.
                      </p>
                    </div>
                  </div>
                  <span className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 w-full sm:w-auto text-center">
                    Coming soon
                  </span>
                </div>
              </div>
            </SettingSection>

            <SettingSection title="Privacy & Legal">
              <div className="space-y-2">
                {[
                  { to: '/privacy', label: 'Privacy Policy' },
                  { to: '/terms', label: 'Terms of Service' },
                  { to: '/support', label: 'Support' },
                  { to: '/delete-account', label: 'Delete Account (web)' },
                ].map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex items-center justify-between p-4 border border-slate-100 dark:border-zinc-800 rounded-2xl hover:border-sky-200 dark:hover:border-sky-700 transition-colors"
                  >
                    <span className="text-sm font-bold text-slate-900 dark:text-zinc-100">{item.label}</span>
                    <ExternalLink size={16} className="text-slate-400" />
                  </Link>
                ))}
              </div>
            </SettingSection>

            <SettingSection title="Delete Account">
              <div className="p-5 border border-rose-100 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-900/10 rounded-2xl space-y-4">
                <div className="flex gap-3">
                  <AlertTriangle className="text-rose-500 shrink-0" size={20} />
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-zinc-100">Permanently delete your account</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1 leading-relaxed">
                      Removes your profile, pitch sessions, decks, and recordings. Active App Store / Play subscriptions must be cancelled separately in your device settings.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(true);
                    setDeletePassword('');
                    setDeleteGoogleCredential('');
                    setDeleteConfirmed(false);
                    setDeleteError('');
                  }}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={16} /> Delete Account
                </button>
              </div>
            </SettingSection>
          </Tabs.Content>

          {/* SUBSCRIPTION TAB */}
          <Tabs.Content value="subscription" className="space-y-10 outline-none">
            <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100">Subscription</h2>

            <div className="app-hero-banner p-4 sm:p-5">
              <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">Current Plan</span>
                  <h3 className="text-xl font-bold mt-0.5 mb-0.5">{planLabel(currentPlan)}</h3>
                  <p className="text-white/80 text-xs">
                    {currentPlan === 'pro'
                      ? 'Unlimited sessions, longer durations, full PDF reports'
                      : currentPlan === 'prep'
                        ? 'Unlimited live practice, 20-minute sessions, full PDF reports'
                        : '2 sessions per week, 10-minute sessions'}
                  </p>
                  {isPaid && billing.expiresAt && (
                    <p className="text-white/70 text-[11px] mt-1">
                      Renews / ends {new Date(billing.expiresAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="sm:text-right">
                  {isPaid
                    ? <p className="text-lg font-bold">Active</p>
                    : <p className="text-2xl font-bold">{proPriceLabel}<span className="text-sm font-medium text-white/70"> for Pro</span></p>}
                </div>
              </div>
              <div className="absolute -right-20 -top-20 w-56 h-56 bg-white/10 rounded-full blur-3xl pointer-events-none" />
            </div>

            {currentPlan === 'pro' ? (
              <div className="p-4 border border-slate-200 dark:border-zinc-800 rounded-2xl bg-slate-50/50 dark:bg-zinc-800/30">
                <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                  You're on Pro: unlimited pitch sessions, longer pitch durations,
                  live market research in your panel, and the full downloadable report.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {currentPlan === 'prep' && (
                  <p className="text-sm text-slate-600 dark:text-zinc-400">
                    You're on the Founder plan. Renew below, or move up to Pro Founder
                    for unlimited sessions, live market research and longer pitch durations.
                  </p>
                )}

                {/* Plan choice */}
                <div className="grid grid-cols-2 gap-3">
                  {(['prep', 'pro'] as const).map((p) => {
                    const selected = selPlan === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setSelPlan(p)}
                        aria-pressed={selected}
                        className={`rounded-2xl border p-4 text-left transition-colors ${selected
                          ? 'border-sky-500 ring-1 ring-sky-500/30 bg-sky-50/50 dark:bg-sky-500/10'
                          : 'border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/40'
                          }`}
                      >
                        <span className="block text-sm font-extrabold text-slate-900 dark:text-zinc-100">
                          {p === 'pro' ? 'Pro Founder' : 'Founder'}
                        </span>
                        <span className="block text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                          {p === 'pro' ? 'For an active raise' : 'Sharpen up first'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Term choice */}
                <div className="inline-flex rounded-xl border border-slate-200 dark:border-zinc-800 p-1 bg-slate-50 dark:bg-zinc-800/40">
                  {(['monthly', 'annual'] as const).map((t) => {
                    const selected = selTerm === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelTerm(t)}
                        aria-pressed={selected}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${selected
                          ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-sm'
                          : 'text-slate-500 dark:text-zinc-400'
                          }`}
                      >
                        {t === 'annual' ? 'Annual · 2 months free' : 'Monthly'}
                      </button>
                    );
                  })}
                </div>

                {/* What the chosen plan includes.
                    Deck Check audits were listed here on both tiers. The backend
                    for them exists, but /deck-check is routed to a redirect and
                    the nav item is flagged comingSoon, so no customer can reach
                    it — and there is no monthly cap implemented anywhere, only a
                    rate limiter. Removed until the page is actually reachable. */}
                <div className="p-4 border border-slate-200 dark:border-zinc-800 rounded-2xl bg-slate-50/50 dark:bg-zinc-800/30">
                  <p className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-3">
                    {selPlan === 'pro' ? 'Pro Founder' : 'Founder'} includes
                  </p>
                  <ul className="space-y-2">
                    {(selPlan === 'pro'
                      ? [
                        'Unlimited pitch sessions',
                        'Sessions up to 40 minutes',
                        'Full downloadable PDF report',
                        'Live market research in your panel',
                      ]
                      : [
                        'Unlimited pitch sessions',
                        'Sessions up to 20 minutes',
                        'Full downloadable PDF report',
                      ]
                    ).map((b) => (
                      <li key={b} className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-zinc-400">
                        <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>

                {billing.billingEnabled ? (
                  <button
                    type="button"
                    onClick={handleUpgrade}
                    disabled={startingCheckout}
                    className="w-full sm:w-auto px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-60"
                  >
                    {startingCheckout
                      ? 'Starting…'
                      : `${currentPlan === 'prep' && selPlan === 'prep' ? 'Renew' : 'Upgrade to'} ${selPlan === 'pro' ? 'Pro Founder' : 'Founder'} — ${selectedPriceLabel}`}
                  </button>
                ) : (
                  /* Billing keys aren't configured — a mail link is honest, a dead
                     button is not. Mirrors the UpgradeModal fallback, including
                     the address: the old "surpport@pitchnest.app" was a typo on a
                     domain with no inbound mailbox. */
                  <a
                    href={`mailto:${CONTACT_EMAIL}?subject=Upgrade%20my%20PitchNest%20plan`}
                    className="inline-flex w-full sm:w-auto items-center justify-center px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-bold transition-colors"
                  >
                    Contact us to upgrade
                  </a>
                )}
              </div>
            )}
          </Tabs.Content>

          {/* NOTIFICATIONS TAB */}
          <Tabs.Content value="notifications" className="space-y-10 outline-none">
            <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100">Notifications</h2>

            <div className="space-y-8">
              <SettingItem
                label="Pitch Analysis Alerts"
                description="Email when your pitch analysis is ready."
              >
                <Switch.Root
                  checked={notifications.pitchAlerts}
                  onCheckedChange={(checked) => {
                    const next = { ...notifications, pitchAlerts: checked };
                    setNotifications(next);
                    persistSettings({ notifications: next });
                  }}
                  className="w-11 h-6 bg-slate-200 dark:bg-zinc-800 rounded-full relative data-[state=checked]:bg-sky-500 transition-colors cursor-pointer outline-none"
                >
                  <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow-sm transition-transform translate-x-1 data-[state=checked]:translate-x-6" />
                </Switch.Root>
              </SettingItem>

              <SettingItem
                label="Weekly Progress Report"
                description="Summary of your improvement and deck views."
              >
                <Switch.Root
                  checked={notifications.weeklyReport}
                  onCheckedChange={(checked) => {
                    const next = { ...notifications, weeklyReport: checked };
                    setNotifications(next);
                    persistSettings({ notifications: next });
                  }}
                  className="w-11 h-6 bg-slate-200 dark:bg-zinc-800 rounded-full relative data-[state=checked]:bg-sky-500 transition-colors cursor-pointer outline-none"
                >
                  <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow-sm transition-transform translate-x-1 data-[state=checked]:translate-x-6" />
                </Switch.Root>
              </SettingItem>

              <SettingItem
                label="Questions on My Businesses"
                description="In-app notification when someone comments on a business you manage."
              >
                <Switch.Root
                  checked={notifications.businessActivity}
                  onCheckedChange={(checked) => {
                    const next = { ...notifications, businessActivity: checked };
                    setNotifications(next);
                    persistSettings({ notifications: next });
                  }}
                  className="w-11 h-6 bg-slate-200 dark:bg-zinc-800 rounded-full relative data-[state=checked]:bg-sky-500 transition-colors cursor-pointer outline-none"
                >
                  <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow-sm transition-transform translate-x-1 data-[state=checked]:translate-x-6" />
                </Switch.Root>
              </SettingItem>

              <SettingItem
                label="Updates From Businesses I Follow"
                description="In-app notification when a business you follow posts an update or milestone."
              >
                <Switch.Root
                  checked={notifications.followedUpdates}
                  onCheckedChange={(checked) => {
                    const next = { ...notifications, followedUpdates: checked };
                    setNotifications(next);
                    persistSettings({ notifications: next });
                  }}
                  className="w-11 h-6 bg-slate-200 dark:bg-zinc-800 rounded-full relative data-[state=checked]:bg-sky-500 transition-colors cursor-pointer outline-none"
                >
                  <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow-sm transition-transform translate-x-1 data-[state=checked]:translate-x-6" />
                </Switch.Root>
              </SettingItem>

              <SettingItem
                label="Founders I Follow"
                description="In-app notification when a founder you follow posts an update or appears on a new business."
              >
                <Switch.Root
                  checked={notifications.followedFounders}
                  onCheckedChange={(checked) => {
                    const next = { ...notifications, followedFounders: checked };
                    setNotifications(next);
                    persistSettings({ notifications: next });
                  }}
                  className="w-11 h-6 bg-slate-200 dark:bg-zinc-800 rounded-full relative data-[state=checked]:bg-sky-500 transition-colors cursor-pointer outline-none"
                >
                  <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow-sm transition-transform translate-x-1 data-[state=checked]:translate-x-6" />
                </Switch.Root>
              </SettingItem>

              <SettingItem
                label="Replies to My Discussions"
                description="In-app notification when someone replies to a discussion you started."
              >
                <Switch.Root
                  checked={notifications.communityReplies}
                  onCheckedChange={(checked) => {
                    const next = { ...notifications, communityReplies: checked };
                    setNotifications(next);
                    persistSettings({ notifications: next });
                  }}
                  className="w-11 h-6 bg-slate-200 dark:bg-zinc-800 rounded-full relative data-[state=checked]:bg-sky-500 transition-colors cursor-pointer outline-none"
                >
                  <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow-sm transition-transform translate-x-1 data-[state=checked]:translate-x-6" />
                </Switch.Root>
              </SettingItem>

              <SettingItem
                label="Investor Inquiries"
                description="In-app notifications when an investor requests access."
              >
                <Switch.Root
                  checked={notifications.investorInquiries}
                  onCheckedChange={(checked) => {
                    const next = { ...notifications, investorInquiries: checked };
                    setNotifications(next);
                    persistSettings({ notifications: next });
                  }}
                  className="w-11 h-6 bg-slate-200 dark:bg-zinc-800 rounded-full relative data-[state=checked]:bg-sky-500 transition-colors cursor-pointer outline-none"
                >
                  <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow-sm transition-transform translate-x-1 data-[state=checked]:translate-x-6" />
                </Switch.Root>
              </SettingItem>
            </div>
          </Tabs.Content>

          {/* VOICE & LANGUAGE TAB */}
          <Tabs.Content value="voice" className="space-y-10 outline-none">
            <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100">Voice &amp; Language</h2>

            <SettingSection title="Transcription">
              <SettingItem
                label="Recognition language"
                description="Applies to live voice sessions. Typed pitches are unaffected."
              >
                <select
                  aria-label="Recognition language"
                  value={sttLocale ?? 'auto'}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === 'auto') {
                      setSttLocale(null);
                      persistSettings({ sttLocale: 'auto' });
                      return;
                    }
                    if (!isSupportedSttLocale(next)) return;
                    setSttLocale(next);
                    persistSettings({ sttLocale: next });
                  }}
                  className="px-3 py-2 text-sm bg-slate-50 dark:bg-zinc-800 border rounded-xl dark:border-zinc-700 text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20 min-w-56"
                >
                  <option value="auto">Automatic (recommended)</option>
                  {TRANSCRIPTION_LOCALES.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </SettingItem>

              {sttLocale && (
                <p className="text-xs text-slate-400 dark:text-zinc-500">
                  Using <span className="font-semibold text-slate-600 dark:text-zinc-300">{sttLocaleLabel(effectiveSttLocale)}</span>.
                </p>
              )}
            </SettingSection>
          </Tabs.Content>

        </div>
      </Tabs.Root>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100 mb-2">Delete Account</h3>
            <p className="text-sm text-slate-500 dark:text-zinc-500 mb-4">
              This cannot be undone. All your pitch data will be permanently removed.
            </p>
            {deleteError && (
              <p className="text-sm text-rose-600 font-medium mb-3">{deleteError}</p>
            )}
            {user?.authProvider === 'google' ? (
              <div className="mb-4">
                {deleteGoogleCredential ? (
                  <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    Google account confirmed.
                  </p>
                ) : (
                  <GoogleSignInButton
                    text="signin_with"
                    onCredential={(credential) => {
                      setDeleteGoogleCredential(credential);
                      setDeleteError('');
                    }}
                    onError={setDeleteError}
                  />
                )}
              </div>
            ) : (
              <>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">Password</label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full px-4 py-3 mb-4 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm"
                  placeholder="Confirm your password"
                  autoComplete="current-password"
                />
              </>
            )}
            <label className="flex items-start gap-2 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={deleteConfirmed}
                onChange={(e) => setDeleteConfirmed(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-xs text-slate-600 dark:text-zinc-400">
                I understand this permanently deletes my account and data.
              </span>
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletePassword('');
                  setDeleteGoogleCredential('');
                }}
                className="flex-1 py-3 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-slate-700 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              >
                {isDeleting ? <Loader2 className="animate-spin" size={16} /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
