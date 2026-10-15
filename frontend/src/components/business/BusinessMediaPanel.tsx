import { useRef, useState } from "react";
import { AlertCircle, ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { cn } from "../../lib/utils";
import {
  removeBusinessMedia,
  uploadBusinessMedia,
  type Business,
  type BusinessMediaKind,
} from "../../api/businesses";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

const SLOTS: Record<BusinessMediaKind, { label: string; maxMb: number; hint: string }> = {
  logo: { label: "Logo", maxMb: 2, hint: "Square or wide, at least 64 × 64 px. Up to 2 MB." },
  cover: { label: "Cover image", maxMb: 6, hint: "A wide banner, at least 600 × 200 px. Up to 6 MB." },
};

/**
 * Logo and cover for a business. Uploads are private drafts until the
 * business is published; the server checks, resizes and strips metadata.
 */
export function BusinessMediaPanel({
  business,
  canEdit,
  onUpdated,
}: {
  business: Business;
  canEdit: boolean;
  onUpdated: (business: Business) => void;
}) {
  const { authFetch } = useAuth();
  const [busy, setBusy] = useState<BusinessMediaKind | null>(null);
  const [error, setError] = useState("");
  const inputs = { logo: useRef<HTMLInputElement>(null), cover: useRef<HTMLInputElement>(null) };

  const upload = async (kind: BusinessMediaKind, file: File | undefined) => {
    if (!file) return;
    setError("");
    if (!ACCEPTED.includes(file.type)) {
      setError("Use a PNG, JPEG or WebP image.");
      return;
    }
    if (file.size > SLOTS[kind].maxMb * 1024 * 1024) {
      setError(`${SLOTS[kind].label} must be ${SLOTS[kind].maxMb} MB or smaller.`);
      return;
    }
    setBusy(kind);
    try {
      onUpdated(await uploadBusinessMedia(authFetch, business.id, kind, file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(null);
      if (inputs[kind].current) inputs[kind].current.value = "";
    }
  };

  const remove = async (kind: BusinessMediaKind) => {
    setError("");
    setBusy(kind);
    try {
      onUpdated(await removeBusinessMedia(authFetch, business.id, kind));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the image.");
    } finally {
      setBusy(null);
    }
  };

  const slot = (kind: BusinessMediaKind) => {
    const url = kind === "logo" ? business.logoUrl : business.coverUrl;
    const spec = SLOTS[kind];
    return (
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-700 dark:text-zinc-200">{spec.label}</p>
        <div
          className={cn(
            "relative mt-2 flex items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/50",
            kind === "logo" ? "h-28 w-28" : "aspect-8/3 w-full",
            url && "border-solid bg-white dark:bg-zinc-900",
          )}
        >
          {url ? (
            <img src={url} alt={`${business.name} ${spec.label.toLowerCase()}`} className={cn("h-full w-full", kind === "logo" ? "object-contain p-2" : "object-cover")} />
          ) : (
            <ImageIcon size={22} className="text-slate-300 dark:text-zinc-600" />
          )}
          {busy === kind && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-zinc-900/70">
              <Loader2 size={20} className="animate-spin text-indigo-500" />
            </div>
          )}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-slate-400">{spec.hint}</p>
        {canEdit && (
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              ref={inputs[kind]}
              type="file"
              accept={ACCEPTED.join(",")}
              className="hidden"
              onChange={(event) => void upload(kind, event.target.files?.[0])}
            />
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => inputs[kind].current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
            >
              <Upload size={13} /> {url ? "Replace" : "Upload"}
            </button>
            {url && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void remove(kind)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-500 transition hover:text-rose-600 disabled:opacity-50 dark:text-zinc-400"
              >
                <Trash2 size={13} /> Remove
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
      <h3 className="text-base font-bold text-slate-950 dark:text-white">Logo and cover</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
        Shown on your public profile, Discover and shared links once you publish.
        {business.status === "published" && " Changes go live when you publish again."}
      </p>
      {error && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertCircle size={14} className="shrink-0" /> {error}
        </p>
      )}
      <div className="mt-5 grid gap-6 sm:grid-cols-[10rem_minmax(0,1fr)]">
        {slot("logo")}
        {slot("cover")}
      </div>
    </section>
  );
}
