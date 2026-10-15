import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Pencil, Plus, ShieldAlert, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  fetchStaffOpportunities,
  KIND_LABELS,
  markStaffOpportunityChecked,
  OPPORTUNITY_KINDS,
  saveStaffOpportunity,
  updateStaffOpportunityStatus,
  type OpportunityInput,
  type OpportunityStatus,
  type StaffOpportunity,
} from "../../api/opportunities";
import { StateBadge } from "../../components/opportunities/OpportunityCard";
import { cn } from "../../lib/utils";

const EMPTY: OpportunityInput = {
  title: "",
  organizer: "",
  kind: "accelerator",
  summary: "",
  eligibility: "",
  region: "",
  sector: "",
  sourceUrl: "",
  opensOn: "",
  closesOn: "",
  status: "draft",
};

function toInput(item: StaffOpportunity): OpportunityInput {
  return {
    title: item.title,
    organizer: item.organizer,
    kind: item.kind,
    summary: item.summary,
    eligibility: item.eligibility,
    region: item.region,
    sector: item.sector,
    sourceUrl: item.sourceUrl,
    opensOn: item.opensOn ?? "",
    closesOn: item.closesOn ?? "",
    status: item.status,
  };
}

const STATUS_STYLES: Record<OpportunityStatus, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300",
  published: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  archived: "bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500",
};

/** Staff-only editor for curated opportunities. The API 404s for non-staff. */
export default function OpportunitiesAdmin() {
  const { authFetch } = useAuth();
  const [items, setItems] = useState<StaffOpportunity[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "forbidden" | "error">("loading");
  const [editing, setEditing] = useState<{ id?: string; input: OpportunityInput } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItems(await fetchStaffOpportunities(authFetch));
      setStatus("ready");
    } catch (error: any) {
      setStatus(error?.status === 404 ? "forbidden" : "error");
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const replace = (updated: StaffOpportunity) =>
    setItems((current) => {
      const exists = current.some((item) => item.id === updated.id);
      return exists ? current.map((item) => (item.id === updated.id ? updated : item)) : [updated, ...current];
    });

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing || saving) return;
    setSaving(true);
    setFormError("");
    try {
      replace(await saveStaffOpportunity(authFetch, editing.input, editing.id));
      setEditing(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Couldn't save this opportunity.");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (item: StaffOpportunity, action: () => Promise<StaffOpportunity>) => {
    setBusyId(item.id);
    try {
      replace(await action());
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "That action failed.");
    } finally {
      setBusyId(null);
    }
  };

  const set = <K extends keyof OpportunityInput>(key: K, value: OpportunityInput[K]) =>
    setEditing((current) => (current ? { ...current, input: { ...current.input, [key]: value } } : current));

  if (status === "forbidden") {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <ShieldAlert size={32} className="mx-auto text-slate-300" />
        <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-zinc-100">This area isn't available</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">Opportunities are curated by PitchNest staff.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Staff</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-950 dark:text-white">Opportunities</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            Only list programmes with an official source. Re-check each one at least every 30 days.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/staff/moderation" className="btn-secondary px-4 py-2 text-sm">Moderation</Link>
          <Link to="/staff/analytics" className="btn-secondary px-4 py-2 text-sm">Analytics</Link>
          <button
            type="button"
            onClick={() => {
              setFormError("");
              setEditing({ input: { ...EMPTY } });
            }}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
          >
            <Plus size={16} /> New opportunity
          </button>
        </div>
      </div>

      {editing && (
        <form onSubmit={(event) => void save(event)} className="mt-6 rounded-2xl border border-indigo-200 bg-white p-5 dark:border-indigo-900/60 dark:bg-zinc-900 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-950 dark:text-white">{editing.id ? "Edit opportunity" : "New opportunity"}</h2>
            <button type="button" onClick={() => setEditing(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800" aria-label="Close">
              <X size={17} />
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Title">
              <input value={editing.input.title} onChange={(e) => set("title", e.target.value)} maxLength={140} required className="input-field w-full text-sm" />
            </Field>
            <Field label="Organizer">
              <input value={editing.input.organizer} onChange={(e) => set("organizer", e.target.value)} maxLength={120} required className="input-field w-full text-sm" />
            </Field>
            <Field label="Type">
              <select value={editing.input.kind} onChange={(e) => set("kind", e.target.value as OpportunityInput["kind"])} className="input-field w-full text-sm">
                {OPPORTUNITY_KINDS.map((value) => <option key={value} value={value}>{KIND_LABELS[value]}</option>)}
              </select>
            </Field>
            <Field label="Official link">
              <input type="url" value={editing.input.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} maxLength={500} required placeholder="https://" className="input-field w-full text-sm" />
            </Field>
            <Field label="Opens (optional)">
              <input type="date" value={editing.input.opensOn} onChange={(e) => set("opensOn", e.target.value)} className="input-field w-full text-sm" />
            </Field>
            <Field label="Closes (leave empty if rolling)">
              <input type="date" value={editing.input.closesOn} onChange={(e) => set("closesOn", e.target.value)} className="input-field w-full text-sm" />
            </Field>
            <Field label="Region">
              <input value={editing.input.region} onChange={(e) => set("region", e.target.value)} maxLength={120} placeholder="e.g. Nigeria, West Africa, Africa-wide" className="input-field w-full text-sm" />
            </Field>
            <Field label="Sector (optional)">
              <input value={editing.input.sector} onChange={(e) => set("sector", e.target.value)} maxLength={100} className="input-field w-full text-sm" />
            </Field>
          </div>
          <Field label="Summary" className="mt-3">
            <textarea value={editing.input.summary} onChange={(e) => set("summary", e.target.value)} maxLength={1500} rows={3} required className="input-field w-full resize-y text-sm" />
          </Field>
          <Field label="Eligibility (optional)" className="mt-3">
            <textarea value={editing.input.eligibility} onChange={(e) => set("eligibility", e.target.value)} maxLength={1000} rows={2} className="input-field w-full resize-y text-sm" />
          </Field>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-zinc-300">
              Status
              <select value={editing.input.status} onChange={(e) => set("status", e.target.value as OpportunityStatus)} className="input-field text-sm">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2 px-5 py-2 text-sm disabled:opacity-50">
              {saving && <Loader2 size={15} className="animate-spin" />} Save
            </button>
          </div>
          {formError && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400" role="alert">{formError}</p>}
        </form>
      )}

      <div className="mt-6 space-y-3">
        {status === "loading" && (
          <p className="flex items-center gap-2 py-10 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> Loading…</p>
        )}
        {status === "error" && <p className="py-10 text-sm text-rose-600">Opportunities couldn't load.</p>}
        {status === "ready" && items.length === 0 && (
          <p className="py-10 text-sm text-slate-500 dark:text-zinc-400">No opportunities yet. Add the first one.</p>
        )}
        {status === "ready" &&
          items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize", STATUS_STYLES[item.status])}>{item.status}</span>
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">{KIND_LABELS[item.kind]}</span>
                <StateBadge opportunity={item} />
                {item.stale && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                    <AlertTriangle size={11} /> Needs re-check
                  </span>
                )}
              </div>
              <h2 className="mt-2 text-sm font-extrabold text-slate-950 dark:text-white">{item.title}</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {item.organizer}
                {item.region ? ` · ${item.region}` : ""}
                {item.lastCheckedAt ? ` · checked ${new Date(item.lastCheckedAt).toLocaleDateString()}` : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => { setFormError(""); setEditing({ id: item.id, input: toInput(item) }); }} className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs">
                  <Pencil size={13} /> Edit
                </button>
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => void runAction(item, () => markStaffOpportunityChecked(authFetch, item.id))}
                  className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
                >
                  <CheckCircle2 size={13} /> Checked today
                </button>
                {item.status !== "published" ? (
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void runAction(item, () => updateStaffOpportunityStatus(authFetch, item.id, "published"))}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Publish
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void runAction(item, () => updateStaffOpportunityStatus(authFetch, item.id, "archived"))}
                    className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
                  >
                    Archive
                  </button>
                )}
                {item.sourceUrl && (
                  <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    Source <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </article>
          ))}
      </div>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("block text-xs font-bold text-slate-600 dark:text-zinc-300", className)}>
      {label}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
