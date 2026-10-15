import React, { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2, Flag, Loader2, X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import {
  REPORT_REASON_LABELS,
  REPORT_REASONS,
  reportContent,
  type ReportInput,
  type ReportReason,
} from "../../api/discover";
import { reportCommunityItem } from "../../api/community";

/** Discover items are addressed by business slug; community items by id. */
export type ReportTarget =
  | {
      entityType: ReportInput["entityType"];
      slug: string;
      commentId?: string;
      /** Short human label, e.g. "this profile" or "this comment". */
      label: string;
    }
  | {
      entityType: "thread" | "reply";
      entityId: string;
      label: string;
    };

interface ReportDialogProps {
  target: ReportTarget | null;
  onClose: () => void;
}

/** Sends a content report to the moderation queue. Requires a signed-in user. */
export function ReportDialog({ target, onClose }: ReportDialogProps) {
  const { authFetch } = useAuth();
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (target) {
      setReason("");
      setDetails("");
      setState("idle");
      setMessage("");
    }
  }, [target]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!target || !reason) return;
    setState("sending");
    setMessage("");
    try {
      const current = target;
      const result =
        "entityId" in current
          ? await reportCommunityItem(authFetch, {
              entityType: current.entityType,
              entityId: current.entityId,
              reason,
              details: details.trim() || undefined,
            })
          : await reportContent(authFetch, {
              entityType: current.entityType,
              slug: current.slug,
              commentId: current.commentId,
              reason,
              details: details.trim() || undefined,
            });
      setState("sent");
      setMessage(
        result.alreadyReported
          ? "You already reported this. Our moderators have it in their queue."
          : "Thanks. A PitchNest moderator will review it.",
      );
    } catch (error) {
      setState("idle");
      setMessage(error instanceof Error ? error.message : "We couldn't send that report.");
    }
  };

  return (
    <Dialog.Root open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
          aria-describedby="report-dialog-lead"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
              <Flag size={20} />
            </div>
            <Dialog.Close
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              aria-label="Close"
            >
              <X size={18} />
            </Dialog.Close>
          </div>

          <Dialog.Title className="mt-4 text-lg font-bold text-slate-900 dark:text-zinc-100">
            Report {target?.label ?? "content"}
          </Dialog.Title>
          <Dialog.Description id="report-dialog-lead" className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-zinc-400">
            Reports are private. The founder won't see who sent it.
          </Dialog.Description>

          {state === "sent" ? (
            <div className="mt-6">
              <p className="flex items-start gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200" role="status">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> {message}
              </p>
              <Dialog.Close className="btn-primary mt-5 w-full py-2.5 text-sm">Done</Dialog.Close>
            </div>
          ) : (
            <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-4">
              <fieldset>
                <legend className="text-xs font-bold uppercase tracking-wider text-slate-400">Reason</legend>
                <div className="mt-2 space-y-1.5">
                  {REPORT_REASONS.map((value) => (
                    <label
                      key={value}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
                        reason === value
                          ? "border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-100"
                          : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                      }`}
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        value={value}
                        checked={reason === value}
                        onChange={() => setReason(value)}
                        className="accent-indigo-600"
                      />
                      {REPORT_REASON_LABELS[value]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="report-details" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Details (optional)
                </label>
                <textarea
                  id="report-details"
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  maxLength={1000}
                  rows={3}
                  className="input-field mt-2 w-full resize-none text-sm"
                  placeholder="Anything that helps a moderator understand the problem"
                />
              </div>

              {message && (
                <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">{message}</p>
              )}

              <button
                type="submit"
                disabled={!reason || state === "sending"}
                className="btn-primary flex w-full items-center justify-center gap-2 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {state === "sending" && <Loader2 size={16} className="animate-spin" />}
                Send report
              </button>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
