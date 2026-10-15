import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  ExternalLink,
  Eye,
  EyeOff,
  Globe2,
  Inbox,
  Lightbulb,
  Loader2,
  LockKeyhole,
  MapPin,
  Mic,
  Pencil,
  Plus,
  Presentation,
  Rocket,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../lib/utils";
import { PracticeHistory } from "../components/business/PracticeHistory";
import { BusinessActivityPanel } from "../components/business/BusinessActivityPanel";
import { PublicPitchPanel } from "../components/business/PublicPitchPanel";
import { useEcosystemFeatures } from "../hooks/useEcosystemFeatures";
import {
  archiveBusiness,
  createBusiness,
  getBusinessMembers,
  getLegacyBusinessDraft,
  getPublicationPreview,
  listBusinesses,
  publishBusiness,
  unpublishBusiness,
  updateBusiness,
  type Business,
  type BusinessInput,
  type BusinessMember,
  type BusinessType,
  type PublicationPreview,
} from "../api/businesses";

const businessTypeOptions: Array<{ value: BusinessType; label: string }> = [
  { value: "software", label: "Software" },
  { value: "services", label: "Services" },
  { value: "physical", label: "Physical product" },
  { value: "traditional", label: "Traditional business" },
  { value: "other", label: "Other" },
];

const publicationFields = [
  { key: "tagline", label: "Tagline" },
  { key: "description", label: "Description" },
  { key: "industry", label: "Industry" },
  { key: "stage", label: "Stage" },
  { key: "region", label: "Region" },
] as const;

const emptyForm: BusinessInput = {
  name: "",
  businessType: "software",
  tagline: "",
  description: "",
  industry: "",
  stage: "",
  region: "",
  problem: "",
  solution: "",
  targetCustomer: "",
  websiteUrl: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600";

function businessToForm(business: Business): BusinessInput {
  return {
    name: business.name,
    businessType: business.businessType,
    tagline: business.tagline,
    description: business.description,
    industry: business.industry,
    stage: business.stage,
    region: business.region,
    problem: business.problem,
    solution: business.solution,
    targetCustomer: business.targetCustomer,
    websiteUrl: business.websiteUrl,
  };
}

function titleCase(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return "Not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not yet";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function Modal({
  children,
  title,
  description,
  onClose,
  width = "max-w-3xl",
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
  onClose: () => void;
  width?: string;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="business-modal-title"
        className={cn(
          "flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-3xl",
          width,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-zinc-800 sm:px-7 sm:py-5">
          <div>
            <h2 id="business-modal-title" className="text-xl font-bold text-slate-950 dark:text-white">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

function BusinessFormModal({
  business,
  initialValues,
  importedFromLegacy = false,
  saving,
  error,
  onClose,
  onSubmit,
  onArchive,
}: {
  business: Business | null;
  initialValues?: BusinessInput | null;
  importedFromLegacy?: boolean;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (input: BusinessInput) => Promise<void>;
  onArchive?: () => Promise<void>;
}) {
  const [form, setForm] = useState<BusinessInput>(() =>
    business ? businessToForm(business) : initialValues ?? emptyForm,
  );

  const setField = <K extends keyof BusinessInput>(key: K, value: BusinessInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit(form);
  };

  return (
    <Modal
      title={business ? "Edit business profile" : "Create a business"}
      description="Keep private details here, then choose exactly when the public profile goes live."
      onClose={onClose}
    >
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="overflow-y-auto px-5 py-5 sm:px-7">
          {importedFromLegacy && (
            <div className="mb-5 flex gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300">
              <Sparkles size={17} className="mt-0.5 shrink-0" />
              <span>
                We copied only your business name, industry, and funding stage. Review and edit everything before creating this private draft.
              </span>
            </div>
          )}
          {error && (
            <div className="mb-5 flex gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-7">
            <section>
              <div className="mb-4 flex items-center gap-2">
                <Building2 size={17} className="text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Identity</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Business name *">
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={form.name}
                    onChange={(event) => setField("name", event.target.value)}
                    className={inputClass}
                    placeholder="Acme Labs"
                  />
                </Field>
                <Field label="Business type *">
                  <select
                    value={form.businessType}
                    onChange={(event) => setField("businessType", event.target.value as BusinessType)}
                    className={inputClass}
                  >
                    {businessTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Tagline" className="sm:col-span-2" hint="Required before publication · 180 characters max">
                  <input
                    maxLength={180}
                    value={form.tagline}
                    onChange={(event) => setField("tagline", event.target.value)}
                    className={inputClass}
                    placeholder="The shortest, clearest version of your promise"
                  />
                </Field>
                <Field label="Description" className="sm:col-span-2" hint="Required before publication">
                  <textarea
                    rows={4}
                    maxLength={3000}
                    value={form.description}
                    onChange={(event) => setField("description", event.target.value)}
                    className={cn(inputClass, "resize-y")}
                    placeholder="What does the business do, and why does it matter?"
                  />
                </Field>
              </div>
            </section>

            <section className="border-t border-slate-100 pt-6 dark:border-zinc-800">
              <div className="mb-4 flex items-center gap-2">
                <MapPin size={17} className="text-sky-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Market context</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Industry" hint="Required to publish">
                  <input
                    maxLength={100}
                    value={form.industry}
                    onChange={(event) => setField("industry", event.target.value)}
                    className={inputClass}
                    placeholder="Fintech"
                  />
                </Field>
                <Field label="Stage" hint="Required to publish">
                  <input
                    maxLength={80}
                    value={form.stage}
                    onChange={(event) => setField("stage", event.target.value)}
                    className={inputClass}
                    placeholder="Pre-seed"
                  />
                </Field>
                <Field label="Region" hint="Required to publish">
                  <input
                    maxLength={120}
                    value={form.region}
                    onChange={(event) => setField("region", event.target.value)}
                    className={inputClass}
                    placeholder="Lagos, Nigeria"
                  />
                </Field>
              </div>
            </section>

            <section className="border-t border-slate-100 pt-6 dark:border-zinc-800">
              <div className="mb-4 flex items-center gap-2">
                <Lightbulb size={17} className="text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Pitch story</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Problem">
                  <textarea
                    rows={4}
                    maxLength={1500}
                    value={form.problem}
                    onChange={(event) => setField("problem", event.target.value)}
                    className={cn(inputClass, "resize-y")}
                    placeholder="What painful problem are you solving?"
                  />
                </Field>
                <Field label="Solution">
                  <textarea
                    rows={4}
                    maxLength={1500}
                    value={form.solution}
                    onChange={(event) => setField("solution", event.target.value)}
                    className={cn(inputClass, "resize-y")}
                    placeholder="How do you solve it differently?"
                  />
                </Field>
                <Field label="Target customer">
                  <textarea
                    rows={3}
                    maxLength={800}
                    value={form.targetCustomer}
                    onChange={(event) => setField("targetCustomer", event.target.value)}
                    className={cn(inputClass, "resize-y")}
                    placeholder="Who needs this most?"
                  />
                </Field>
                <Field label="Website" hint="Include https:// or http://">
                  <input
                    type="url"
                    maxLength={500}
                    value={form.websiteUrl}
                    onChange={(event) => setField("websiteUrl", event.target.value)}
                    className={inputClass}
                    placeholder="https://example.com"
                  />
                </Field>
              </div>
            </section>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/60 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          {business && onArchive ? (
            <button
              type="button"
              onClick={() => void onArchive()}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
            >
              <Trash2 size={16} /> Archive business
            </button>
          ) : <span />}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={saving} className="btn-secondary flex-1 px-4 py-2.5 text-sm sm:flex-none">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex flex-1 items-center justify-center gap-2 px-5 py-2.5 text-sm disabled:opacity-60 sm:flex-none">
              {saving && <Loader2 size={16} className="animate-spin" />}
              {business ? "Save changes" : "Create business"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function PreviewModal({
  preview,
  loading,
  error,
  publishing,
  alreadyPublished,
  onClose,
  onPublish,
}: {
  preview: PublicationPreview | null;
  loading: boolean;
  error: string;
  publishing: boolean;
  alreadyPublished: boolean;
  onClose: () => void;
  onPublish: () => Promise<void>;
}) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <Modal
      title="Publication preview"
      description="This is the exact business information that can become public."
      onClose={onClose}
      width="max-w-4xl"
    >
      <div className="overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
        {loading && (
          <div className="flex min-h-72 items-center justify-center text-slate-400">
            <Loader2 size={26} className="animate-spin" />
          </div>
        )}

        {error && !loading && (
          <div className="flex gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
            <AlertCircle size={18} className="shrink-0" /> {error}
          </div>
        )}

        {preview && !loading && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
            <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="gradient-brand px-6 py-7 text-white sm:px-8">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider">
                    {titleCase(preview.preview.businessType)}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-white/75"><Eye size={14} /> Public preview</span>
                </div>
                <h3 className="text-2xl font-extrabold sm:text-3xl">{preview.preview.name}</h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/80">
                  {preview.preview.tagline || "No tagline added yet."}
                </p>
              </div>
              <div className="space-y-6 p-6 sm:p-8">
                <div className="flex flex-wrap gap-2">
                  {[preview.preview.industry, preview.preview.stage, preview.preview.region]
                    .filter(Boolean)
                    .map((value) => (
                      <span key={value} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {value}
                      </span>
                    ))}
                </div>
                <PreviewSection title="About" value={preview.preview.description} />
                <div className="grid gap-5 sm:grid-cols-2">
                  <PreviewSection title="The problem" value={preview.preview.problem} />
                  <PreviewSection title="Our solution" value={preview.preview.solution} />
                </div>
                <PreviewSection title="Who it is for" value={preview.preview.targetCustomer} />
                {preview.preview.websiteUrl && (
                  <div className="flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                    <Globe2 size={16} /> {preview.preview.websiteUrl}
                  </div>
                )}
              </div>
            </article>

            <aside className="space-y-4">
              <div className={cn(
                "rounded-2xl border p-4",
                preview.canPublish
                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                  : "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20",
              )}>
                <div className="flex items-center gap-2">
                  {preview.canPublish ? <CheckCircle2 size={18} className="text-emerald-600" /> : <AlertCircle size={18} className="text-amber-600" />}
                  <p className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                    {preview.canPublish ? "Ready to publish" : "Not ready yet"}
                  </p>
                </div>
                {preview.blockers.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-slate-600 dark:text-zinc-400">Complete these fields first:</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {preview.blockers.map((blocker) => (
                        <span key={blocker} className="rounded-md bg-white/80 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:bg-zinc-900/70 dark:text-amber-300">
                          {titleCase(blocker)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 dark:border-zinc-800">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck size={18} className="mt-0.5 shrink-0 text-indigo-500" />
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-zinc-100">You control visibility</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
                      Nothing is public until you confirm. You can unpublish later from this workspace.
                    </p>
                  </div>
                </div>
              </div>

              {!alreadyPublished && preview.canPublish && (
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 dark:border-zinc-800">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
                    I reviewed this preview and consent to publishing these business details.
                  </span>
                </label>
              )}
            </aside>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/60 sm:px-7">
        <button type="button" onClick={onClose} className="btn-secondary px-4 py-2.5 text-sm">
          Close
        </button>
        {preview && !alreadyPublished && (
          <button
            type="button"
            disabled={!preview.canPublish || !confirmed || publishing}
            onClick={() => void onPublish()}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {publishing ? <Loader2 size={16} className="animate-spin" /> : <Globe2 size={16} />}
            Publish business
          </button>
        )}
      </div>
    </Modal>
  );
}

function PreviewSection({ title, value }: { title: string; value: string }) {
  return (
    <section>
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{title}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
        {value || "Not added yet."}
      </p>
    </section>
  );
}

export default function BusinessWorkspace() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const ecosystemFeatures = useEcosystemFeatures();
  const [searchParams, setSearchParams] = useSearchParams();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [legacyDraft, setLegacyDraft] = useState<BusinessInput | null>(null);
  const [createSeed, setCreateSeed] = useState<BusinessInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formBusiness, setFormBusiness] = useState<Business | null | undefined>(undefined);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState<PublicationPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [visibilityChanging, setVisibilityChanging] = useState(false);

  const selectedId = searchParams.get("business");
  const selected = businesses.find((business) => business.id === selectedId) ?? businesses[0] ?? null;
  // The top bar's "Showcase business" opens the create form via ?new=1. The
  // first load may rewrite the query string, so remember it from mount too.
  const openCreateOnLoad = useRef(searchParams.get("new") === "1");
  const wantsNewBusiness = searchParams.get("new") === "1";

  const selectBusiness = useCallback((businessId: string) => {
    setSearchParams({ business: businessId }, { replace: true });
    setNotice("");
  }, [setSearchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [result, legacy] = await Promise.all([
        listBusinesses(authFetch),
        getLegacyBusinessDraft(authFetch).catch(() => ({ available: false, draft: null })),
      ]);
      setBusinesses(result);
      setLegacyDraft(legacy.available ? legacy.draft : null);
      const requested = searchParams.get("business");
      if (result.length && !result.some((business) => business.id === requested)) {
        setSearchParams({ business: result[0].id }, { replace: true });
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load businesses.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, searchParams, setSearchParams]);

  useEffect(() => {
    void load();
    // The initial fetch decides whether the URL needs a default business. Later
    // query-string changes only switch the already-loaded workspace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authFetch]);

  useEffect(() => {
    if (!selected) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    setMembersLoading(true);
    setMembersError("");
    getBusinessMembers(authFetch, selected.id)
      .then((result) => {
        if (!cancelled) setMembers(result);
      })
      .catch((error) => {
        if (!cancelled) {
          setMembers([]);
          setMembersError(error instanceof Error ? error.message : "Members are unavailable.");
        }
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false);
      });
    return () => { cancelled = true; };
  }, [authFetch, selected?.id]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const updateLocalBusiness = (updated: Business) => {
    setBusinesses((current) => current.map((business) => business.id === updated.id ? updated : business));
  };

  const handleSave = async (input: BusinessInput) => {
    setSaving(true);
    setFormError("");
    try {
      if (formBusiness) {
        const updated = await updateBusiness(authFetch, formBusiness.id, input);
        updateLocalBusiness(updated);
        setNotice(`${updated.name} was updated.`);
      } else {
        const created = await createBusiness(authFetch, input);
        setBusinesses((current) => [created, ...current]);
        selectBusiness(created.id);
        setNotice(
          createSeed
            ? `${created.name} was created as a private draft from your onboarding details.`
            : `${created.name} is ready to build.`,
        );
        if (createSeed) setLegacyDraft(null);
      }
      setFormBusiness(undefined);
      setCreateSeed(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save this business.");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!formBusiness) return;
    const confirmed = window.confirm(
      `Archive ${formBusiness.name}? It will be removed from this workspace and unpublished if currently public.`,
    );
    if (!confirmed) return;
    setSaving(true);
    setFormError("");
    try {
      await archiveBusiness(authFetch, formBusiness.id);
      const remaining = businesses.filter((business) => business.id !== formBusiness.id);
      setBusinesses(remaining);
      setFormBusiness(undefined);
      if (remaining[0]) selectBusiness(remaining[0].id);
      else setSearchParams({}, { replace: true });
      setNotice(`${formBusiness.name} was archived.`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not archive this business.");
    } finally {
      setSaving(false);
    }
  };

  const openPreview = async () => {
    if (!selected) return;
    setPreviewOpen(true);
    setPreview(null);
    setPreviewError("");
    setPreviewLoading(true);
    try {
      setPreview(await getPublicationPreview(authFetch, selected.id));
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Could not build the preview.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!selected || !preview) return;
    setPublishing(true);
    setPreviewError("");
    try {
      const updated = await publishBusiness(authFetch, selected.id, preview);
      updateLocalBusiness(updated);
      setPreviewOpen(false);
      setNotice(`${updated.name} is now published.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not publish this business.";
      setPreviewError(message);
      if (message.toLowerCase().includes("changed after preview")) {
        try {
          setPreview(await getPublicationPreview(authFetch, selected.id));
        } catch {
          // Keep the original conflict message; the user can close and retry.
        }
      }
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!selected) return;
    if (!window.confirm(`Take ${selected.name} offline? You can publish it again later.`)) return;
    setVisibilityChanging(true);
    try {
      const updated = await unpublishBusiness(authFetch, selected.id);
      updateLocalBusiness(updated);
      setNotice(`${updated.name} is private again.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not unpublish this business.");
    } finally {
      setVisibilityChanging(false);
    }
  };

  const completedFields = useMemo(() => selected
    ? publicationFields.filter(({ key }) => selected[key].trim().length > 0).length
    : 0, [selected]);
  const completionPercent = Math.round((completedFields / publicationFields.length) * 100);
  const canEdit = selected ? ["owner", "admin", "editor"].includes(selected.membershipRole) : false;
  const canPublish = selected ? ["owner", "admin"].includes(selected.membershipRole) : false;
  const isPublished = selected?.status === "published";
  const canOfferLegacyDraft = Boolean(
    legacyDraft && !businesses.some(
      (business) => business.name.trim().toLowerCase() === legacyDraft.name.trim().toLowerCase(),
    ),
  );

  const openBlankBusiness = () => {
    setFormError("");
    setCreateSeed(null);
    setFormBusiness(null);
  };

  const openLegacyBusiness = () => {
    if (!legacyDraft) return;
    setFormError("");
    setCreateSeed(legacyDraft);
    setFormBusiness(null);
  };

  const openBusinessEditor = (business: Business) => {
    setFormError("");
    setCreateSeed(null);
    setFormBusiness(business);
  };

  useEffect(() => {
    if (loading || loadError) return;
    if (!openCreateOnLoad.current && !wantsNewBusiness) return;
    openCreateOnLoad.current = false;
    openBlankBusiness();
    if (searchParams.has("new")) {
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      setSearchParams(next, { replace: true });
    }
    // Runs after the first load settles, and whenever ?new=1 arrives later.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loadError, wantsNewBusiness]);

  const scrollToPanel = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="text-center text-slate-400 dark:text-zinc-500">
          <Loader2 size={28} className="mx-auto animate-spin" />
          <p className="mt-3 text-sm font-medium">Opening your business workspace…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-rose-200 bg-white p-8 text-center dark:border-rose-900/50 dark:bg-zinc-900">
        <AlertCircle size={30} className="mx-auto text-rose-500" />
        <h1 className="mt-4 text-xl font-bold text-slate-950 dark:text-white">Workspace unavailable</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">{loadError}</p>
        <button type="button" onClick={() => void load()} className="btn-primary mt-5 px-5 py-2.5 text-sm">Try again</button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-10">
      <header className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/70 to-sky-50 p-6 dark:border-indigo-950/60 dark:from-zinc-900 dark:via-indigo-950/20 dark:to-sky-950/20 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-indigo-300/20 blur-3xl dark:bg-indigo-600/10" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-white/70 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-600 backdrop-blur dark:border-indigo-800/60 dark:bg-zinc-900/70 dark:text-indigo-300">
              <LockKeyhole size={13} /> Private by default
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              Business workspace
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
              Shape each business profile, keep collaborators aligned, and publish only after reviewing exactly what others will see.
            </p>
          </div>
          <button
            type="button"
            onClick={openBlankBusiness}
            className="btn-primary inline-flex shrink-0 items-center justify-center gap-2 px-5 py-3 text-sm"
          >
            <Plus size={17} /> Create business
          </button>
        </div>
      </header>

      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-300" role="status">
          <span className="flex items-center gap-2"><CheckCircle2 size={17} /> {notice}</span>
          <button type="button" onClick={() => setNotice("")} className="p-1" aria-label="Dismiss"><X size={15} /></button>
        </div>
      )}

      {selected && canOfferLegacyDraft && legacyDraft && (
        <section className="flex flex-col gap-4 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white"><Sparkles size={18} /></span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Turn your onboarding details into a business</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
                We found {legacyDraft.name}{legacyDraft.industry ? ` · ${legacyDraft.industry}` : ""}{legacyDraft.stage ? ` · ${legacyDraft.stage}` : ""}. Review the suggested fields before creating a separate private draft.
              </p>
            </div>
          </div>
          <button type="button" onClick={openLegacyBusiness} className="btn-primary inline-flex shrink-0 items-center justify-center gap-2 px-4 py-2.5 text-xs">
            Review suggestion <ArrowRight size={14} />
          </button>
        </section>
      )}

      {!selected ? (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900/70">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">
            <Building2 size={27} />
          </div>
          <h2 className="mt-5 text-xl font-bold text-slate-950 dark:text-white">
            {canOfferLegacyDraft ? "We found your onboarding details" : "Create your first business profile"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500 dark:text-zinc-400">
            {canOfferLegacyDraft && legacyDraft
              ? `Review a suggested draft for ${legacyDraft.name}, or start with a blank profile. Nothing is created or published without your confirmation.`
              : "Give your pitch practice a consistent business identity. Everything stays private until you explicitly publish it."}
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            {canOfferLegacyDraft && (
              <button type="button" onClick={openLegacyBusiness} className="btn-primary inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm">
                <Sparkles size={17} /> Review suggested draft
              </button>
            )}
            <button type="button" onClick={openBlankBusiness} className={cn(canOfferLegacyDraft ? "btn-secondary" : "btn-primary", "inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm")}>
              <Plus size={17} /> {canOfferLegacyDraft ? "Start blank" : "Create business"}
            </button>
          </div>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="self-start rounded-2xl border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 lg:sticky lg:top-24">
            <div className="flex items-center justify-between px-2 pb-3 pt-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Your businesses</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">{businesses.length}</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible">
              {businesses.map((business) => {
                const active = business.id === selected.id;
                return (
                  <button
                    type="button"
                    key={business.id}
                    onClick={() => selectBusiness(business.id)}
                    className={cn(
                      "flex min-w-[220px] items-center gap-3 rounded-xl p-3 text-left transition lg:w-full lg:min-w-0",
                      active
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300"
                        : "text-slate-600 hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-zinc-800/70",
                    )}
                  >
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400")}>
                      <Building2 size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{business.name}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium opacity-70">
                        <span className={cn("h-1.5 w-1.5 rounded-full", business.status === "published" ? "bg-emerald-500" : "bg-slate-400")} />
                        {business.status === "published" ? "Published" : "Private"}
                      </span>
                    </span>
                    <ChevronRight size={15} className="shrink-0 opacity-50" />
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={openBlankBusiness} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-xs font-semibold text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-indigo-700 dark:hover:text-indigo-300">
              <Plus size={14} /> Add another business
            </button>
          </aside>

          <main className="min-w-0 space-y-6">
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="border-b border-slate-100 p-5 dark:border-zinc-800 sm:p-7">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl gradient-brand text-white shadow-lg shadow-indigo-500/15">
                      <Building2 size={23} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-xl font-extrabold text-slate-950 dark:text-white sm:text-2xl">{selected.name}</h2>
                        <span className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                          isPublished
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300",
                        )}>
                          {isPublished ? <Globe2 size={11} /> : <LockKeyhole size={11} />}
                          {isPublished ? "Published" : "Private"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                        {selected.tagline || "Add a tagline that captures the business in one sentence."}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-medium text-slate-400">
                        <span>{titleCase(selected.businessType)}</span>
                        {selected.industry && <span>{selected.industry}</span>}
                        {selected.region && <span className="flex items-center gap-1"><MapPin size={12} /> {selected.region}</span>}
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">{titleCase(selected.membershipRole)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {canEdit && (
                      <button type="button" onClick={() => openBusinessEditor(selected)} className="btn-secondary inline-flex items-center gap-2 px-3.5 py-2 text-xs">
                        <Pencil size={14} /> Edit profile
                      </button>
                    )}
                    {canPublish && (
                      <button type="button" onClick={() => void openPreview()} className="btn-secondary inline-flex items-center gap-2 px-3.5 py-2 text-xs">
                        <Eye size={14} /> Preview
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-px bg-slate-100 dark:bg-zinc-800 sm:grid-cols-3">
                <div className="bg-white p-5 dark:bg-zinc-900">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Profile readiness</p>
                  <div className="mt-2 flex items-end justify-between">
                    <p className="text-2xl font-extrabold text-slate-950 dark:text-white">{completionPercent}%</p>
                    <p className="text-[11px] text-slate-400">{completedFields}/{publicationFields.length} essentials</p>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                    <div className="h-full rounded-full gradient-brand transition-all" style={{ width: `${completionPercent}%` }} />
                  </div>
                </div>
                <div className="bg-white p-5 dark:bg-zinc-900">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Last updated</p>
                  <p className="mt-2 text-lg font-bold text-slate-900 dark:text-zinc-100">{formatDate(selected.updatedAt)}</p>
                  <p className="mt-1 text-[11px] text-slate-400">Profile version {selected.profileVersion}</p>
                </div>
                <div className="bg-white p-5 dark:bg-zinc-900">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Published</p>
                  <p className="mt-2 text-lg font-bold text-slate-900 dark:text-zinc-100">{formatDate(selected.publishedAt)}</p>
                  <p className="mt-1 text-[11px] text-slate-400">Visibility stays in your control</p>
                </div>
              </div>
            </section>

            <section aria-labelledby="workspace-actions">
              <h3 id="workspace-actions" className="text-base font-bold text-slate-950 dark:text-white">What would you like to do?</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                Everything uses this one business. Private practice stays private.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                <WorkspaceAction
                  icon={Mic}
                  title="Practice with AI"
                  text="Rehearse privately with this business's details filled in."
                  action="Open pre-pitch room"
                  onClick={() => navigate(`/setup?business=${encodeURIComponent(selected.id)}`)}
                  highlight
                />
                {isPublished ? (
                  <WorkspaceAction
                    icon={Globe2}
                    title="Your public profile"
                    text="See what people find on Discover, with support and questions."
                    action="View public profile"
                    to={`/businesses/${selected.slug}`}
                  />
                ) : (
                  <WorkspaceAction
                    icon={Globe2}
                    title="Get discovered"
                    text={canPublish ? "Preview every public field, then publish when you're ready." : "Owners and admins publish once the profile is complete."}
                    action={canPublish ? "Review before publishing" : canEdit ? "Complete profile" : "View checklist"}
                    onClick={() => (canPublish ? void openPreview() : canEdit ? openBusinessEditor(selected) : scrollToPanel("publication-checklist"))}
                  />
                )}
                {ecosystemFeatures.pitchArena && (
                  <WorkspaceAction
                    icon={Presentation}
                    title="Prepare a public pitch"
                    text="Write a short pitch people can give structured feedback on."
                    action="Open pitch editor"
                    onClick={() => scrollToPanel("public-pitch")}
                  />
                )}
                <WorkspaceAction
                  icon={Inbox}
                  title="Answer questions"
                  text="Reply to the community and post updates followers will see."
                  action="Open questions"
                  onClick={() => scrollToPanel("questions")}
                />
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
              <div className="space-y-6">
                <section id="publication-checklist" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-950 dark:text-white">Publication checklist</h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">Required before this profile can go public.</p>
                    </div>
                    {completionPercent === 100 ? <CheckCircle2 size={22} className="text-emerald-500" /> : <CircleDashed size={22} className="text-amber-500" />}
                  </div>
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {publicationFields.map(({ key, label }) => {
                      const complete = selected[key].trim().length > 0;
                      return (
                        <div key={key} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-3 dark:bg-zinc-800/60">
                          <span className={cn("flex h-6 w-6 items-center justify-center rounded-full", complete ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-white text-slate-300 dark:bg-zinc-900 dark:text-zinc-600")}>
                            {complete ? <Check size={13} strokeWidth={3} /> : <CircleDashed size={13} />}
                          </span>
                          <span className={cn("text-xs font-semibold", complete ? "text-slate-700 dark:text-zinc-200" : "text-slate-400 dark:text-zinc-500")}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                  {canEdit && completionPercent < 100 && (
                    <button type="button" onClick={() => openBusinessEditor(selected)} className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
                      Complete profile <ArrowRight size={14} />
                    </button>
                  )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-950 dark:text-white">Business story</h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">The context PitchNest will use across future workflows.</p>
                    </div>
                    <Sparkles size={19} className="text-indigo-500" />
                  </div>
                  <div className="mt-5 space-y-5">
                    <StoryRow title="Description" value={selected.description} />
                    <div className="grid gap-5 border-t border-slate-100 pt-5 dark:border-zinc-800 sm:grid-cols-2">
                      <StoryRow title="Problem" value={selected.problem} />
                      <StoryRow title="Solution" value={selected.solution} />
                    </div>
                    <div className="border-t border-slate-100 pt-5 dark:border-zinc-800">
                      <StoryRow title="Target customer" value={selected.targetCustomer} />
                    </div>
                  </div>
                </section>

                {ecosystemFeatures.pitchArena && (
                  <PublicPitchPanel business={selected} canEdit={canEdit} canPublish={canPublish} />
                )}

                <BusinessActivityPanel business={selected} canEdit={canEdit} />
              </div>

              <div className="space-y-6">
                <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-600 to-sky-600 p-5 text-white shadow-lg shadow-indigo-500/10 dark:border-indigo-800">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15"><Rocket size={20} /></div>
                  <h3 className="mt-4 text-lg font-extrabold">Practice this business pitch</h3>
                  <p className="mt-2 text-xs leading-relaxed text-white/75">Rehearse privately with this business's details prefilled. Reports stay private and are listed below.</p>
                  <button
                    type="button"
                    onClick={() => navigate(`/setup?business=${encodeURIComponent(selected.id)}`)}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-indigo-700 transition hover:bg-indigo-50"
                  >
                    Open pre-pitch room <ArrowRight size={16} />
                  </button>
                </section>

                <PracticeHistory businessId={selected.id} />

                <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Users size={17} className="text-sky-500" />
                      <h3 className="text-sm font-bold text-slate-950 dark:text-white">Members</h3>
                    </div>
                    {!membersLoading && <span className="text-[11px] font-semibold text-slate-400">{members.length}</span>}
                  </div>
                  <div className="mt-4 space-y-2.5">
                    {membersLoading ? (
                      <div className="flex justify-center py-5"><Loader2 size={19} className="animate-spin text-slate-400" /></div>
                    ) : membersError ? (
                      <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-zinc-800/60 dark:text-zinc-400">{membersError}</p>
                    ) : members.map((member) => (
                      <div key={member.userId} className="flex items-center gap-3">
                        {member.avatarUrl ? (
                          <img src={member.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">{member.name.slice(0, 1).toUpperCase()}</span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-slate-800 dark:text-zinc-200">{member.name}</p>
                          <p className="truncate text-[10px] text-slate-400">{member.email || titleCase(member.role)}</p>
                        </div>
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">{member.role}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center gap-2">
                    {isPublished ? <Globe2 size={17} className="text-emerald-500" /> : <EyeOff size={17} className="text-slate-400" />}
                    <h3 className="text-sm font-bold text-slate-950 dark:text-white">Visibility</h3>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
                    {isPublished
                      ? "This business profile is public. You can take it offline without deleting your work."
                      : "This business is only visible to its workspace members."}
                  </p>
                  {canPublish && (
                    isPublished ? (
                      <div className="mt-4 grid gap-2">
                        <Link to={`/businesses/${selected.slug}`} className="btn-primary flex w-full items-center justify-center gap-2 px-3 py-2.5 text-xs">
                          <ExternalLink size={14} /> View public profile
                        </Link>
                        <button type="button" disabled={visibilityChanging} onClick={() => void handleUnpublish()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-rose-900 dark:hover:bg-rose-950/20 dark:hover:text-rose-300">
                          {visibilityChanging ? <Loader2 size={14} className="animate-spin" /> : <EyeOff size={14} />} Unpublish
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => void openPreview()} className="btn-primary mt-4 flex w-full items-center justify-center gap-2 px-3 py-2.5 text-xs">
                        <Eye size={14} /> Review before publishing
                      </button>
                    )
                  )}
                </section>

                {selected.websiteUrl && (
                  <a href={selected.websiteUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-indigo-800 dark:hover:text-indigo-300">
                    <span className="flex min-w-0 items-center gap-2"><Globe2 size={16} className="shrink-0" /><span className="truncate">Visit website</span></span>
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          </main>
        </div>
      )}

      {formBusiness !== undefined && (
        <BusinessFormModal
          business={formBusiness}
          initialValues={createSeed}
          importedFromLegacy={Boolean(!formBusiness && createSeed)}
          saving={saving}
          error={formError}
          onClose={() => { if (!saving) { setFormBusiness(undefined); setCreateSeed(null); } }}
          onSubmit={handleSave}
          onArchive={formBusiness?.membershipRole === "owner" ? handleArchive : undefined}
        />
      )}

      {previewOpen && selected && (
        <PreviewModal
          preview={preview}
          loading={previewLoading}
          error={previewError}
          publishing={publishing}
          alreadyPublished={isPublished}
          onClose={() => { if (!publishing) setPreviewOpen(false); }}
          onPublish={handlePublish}
        />
      )}
    </div>
  );
}

function WorkspaceAction({
  icon: Icon,
  title,
  text,
  action,
  to,
  onClick,
  highlight = false,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  text: string;
  action: string;
  to?: string;
  onClick?: () => void;
  highlight?: boolean;
}) {
  const body = (
    <>
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl",
          highlight
            ? "bg-accent text-accent-ink"
            : "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300",
        )}
      >
        <Icon size={18} />
      </span>
      <span className="mt-3 block text-sm font-bold text-slate-950 dark:text-white">{title}</span>
      <span className="mt-1 block text-xs leading-relaxed text-slate-500 dark:text-zinc-400">{text}</span>
      <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-bold text-indigo-600 dark:text-indigo-400">
        {action} <ArrowRight size={13} />
      </span>
    </>
  );
  const className =
    "flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-800";
  return to ? (
    <Link to={to} className={className}>{body}</Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>{body}</button>
  );
}

function StoryRow({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{title}</p>
      <p className={cn("mt-2 whitespace-pre-wrap text-sm leading-relaxed", value ? "text-slate-600 dark:text-zinc-300" : "italic text-slate-400 dark:text-zinc-600")}>
        {value || "Not added yet."}
      </p>
    </div>
  );
}
