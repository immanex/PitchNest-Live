import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Loader2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { updateMyPublicProfile, type BusinessMember } from "../../api/businesses";

/**
 * The signed-in member's own choice to appear on the business's public page,
 * with an optional title. Only the member can change it.
 */
export function MyPublicProfile({
  businessId,
  businessPublished,
  member,
  onChange,
}: {
  businessId: string;
  /** Founder pages list published businesses only. */
  businessPublished: boolean;
  member: BusinessMember;
  onChange: (member: BusinessMember) => void;
}) {
  const { authFetch } = useAuth();
  const [consent, setConsent] = useState(member.publicDisplayConsent);
  const [title, setTitle] = useState(member.publicTitle ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setConsent(member.publicDisplayConsent);
    setTitle(member.publicTitle ?? "");
  }, [member.publicDisplayConsent, member.publicTitle]);

  const dirty = consent !== member.publicDisplayConsent || title.trim() !== (member.publicTitle ?? "");

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const result = await updateMyPublicProfile(authFetch, businessId, { consent, title: title.trim() });
      onChange({
        ...member,
        publicDisplayConsent: result.publicDisplayConsent,
        publicTitle: result.publicTitle,
        founderHandle: result.publicDisplayConsent ? result.founderHandle ?? member.founderHandle : null,
      });
      setMessage(result.publicDisplayConsent ? "You're shown on the public profile." : "You're not shown publicly.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-slate-200 p-3.5 dark:border-zinc-700">
      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-indigo-600"
        />
        <span>
          <span className="block text-xs font-bold text-slate-800 dark:text-zinc-100">Show me on the public profile</span>
          <span className="mt-0.5 block text-[11px] leading-snug text-slate-500 dark:text-zinc-400">
            Your name, photo and title appear on this business's public page while it's published. Turn it off any time.
          </span>
        </span>
      </label>
      {consent && (
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={80}
          placeholder="Your title, e.g. Co-founder & CEO"
          aria-label="Your public title"
          className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      )}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => void save()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:opacity-40"
        >
          {saving && <Loader2 size={12} className="animate-spin" />} Save
        </button>
        {message && <span className="text-[11px] text-slate-500 dark:text-zinc-400">{message}</span>}
      </div>
      {member.publicDisplayConsent && member.founderHandle && businessPublished && (
        <Link
          to={`/founders/${encodeURIComponent(member.founderHandle)}`}
          className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
        >
          <ExternalLink size={12} /> View your founder page
        </Link>
      )}
    </div>
  );
}
