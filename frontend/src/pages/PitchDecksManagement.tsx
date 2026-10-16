import React, { useState, useCallback, useEffect } from "react";
import { FirstTimeTour } from "../components/FirstTimeTour";
import {
  Eye,
  Upload,
  CheckCircle2,
  FileText,
  Sparkles,
  FileUp,
  Play,
  Trash2,
  Loader2,
  Plus,
  AlertTriangle,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { cn } from "../lib/utils";
import { Link } from "react-router-dom";
import { Skeleton } from "../components/Skeleton";
import { useAuth } from "../contexts/AuthContext";

// --- Subcomponents ---
const DeckCard = ({
  name,
  date,
  status,
  image,
  fileUrl,
  deckId,
  onRemove,
  onPreview,
}: {
  name: string;
  date: string;
  status: string;
  image: string;
  fileUrl?: string;
  deckId?: string | number;
  onRemove?: () => void;
  onPreview?: (deckId: string | number, fileUrl?: string) => void;
  key?: React.Key;
}) => (
  <div className="card overflow-hidden group dark:bg-zinc-900 dark:border-zinc-800 flex flex-col shadow-sm hover:shadow-xl transition-shadow relative">
    <div className="aspect-4/3 relative overflow-hidden bg-slate-100 dark:bg-zinc-800">
      {image ? (
        <img
          src={image}
          className={cn(
            "w-full h-full object-cover transition-all duration-500",
            status === "DRAFT" || status === "FAILED"
              ? "opacity-40 grayscale blur-sm"
              : "group-hover:scale-105 opacity-90",
          )}
          referrerPolicy="no-referrer"
          alt="Deck cover"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 dark:text-zinc-600 gap-3">
          <FileText size={48} />
        </div>
      )}

      {/* State Overlays */}
      {status === "DRAFT" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-3">
          <Loader2
            size={32}
            className="animate-spin text-sky-500 drop-shadow-md"
          />
        </div>
      )}

      {status === "FAILED" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-3 bg-rose-500/10">
          <AlertTriangle size={32} className="text-rose-500 drop-shadow-md" />
          <span className="text-xs font-bold text-rose-600 px-3 py-1 bg-white rounded-full shadow-sm">
            Upload Failed
          </span>
        </div>
      )}

      <div className="absolute top-4 right-4 flex gap-2 z-20">
        <span
          className={cn(
            "text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1",
            status === "READY"
              ? "bg-emerald-500 text-white"
              : status === "DRAFT"
                ? "bg-amber-500 text-white"
                : "bg-rose-500 text-white",
          )}
        >
          {status === "DRAFT" ? "UPLOADING" : status}
        </span>
        {onRemove && status.toUpperCase() == "READY" && (
          <button
            onClick={onRemove}
            className="p-1.5 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600 shadow-sm"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
    <div className="p-6 space-y-6 flex-1 flex flex-col justify-between">
      <div>
        <h3
          className="text-lg font-bold text-slate-900 dark:text-zinc-100 mb-1 truncate"
          title={name}
        >
          {name}
        </h3>
        <p className="text-xs text-slate-400 dark:text-zinc-500 font-medium">
          {status === "DRAFT"
            ? "Processing file..."
            : status === "FAILED"
              ? "Please try again"
              : `Uploaded ${date}`}
        </p>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3">
          <button
            type="button"
            onClick={() => {
              if (deckId !== undefined) onPreview?.(deckId, fileUrl);
            }}
            disabled={!fileUrl || status !== "READY"}
            className={cn(
              "py-2.5 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2",
              (!fileUrl || status !== "READY") &&
                "opacity-50 pointer-events-none cursor-not-allowed",
            )}
          >
            <Eye size={14} /> Preview Deck
          </button>
        </div>
        <Link
          to="/setup"
          state={{ preSelectedDeck: name }}
          className={cn(
            "w-full py-3 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2",
            status !== "READY"
              ? "bg-slate-100 text-slate-400 cursor-not-allowed pointer-events-none dark:bg-zinc-800 dark:text-zinc-600"
              : "bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/30",
          )}
        >
          <Play size={14} fill={status === "READY" ? "currentColor" : "none"} />{" "}
          Assign & Pitch
        </Link>
      </div>
    </div>
  </div>
);

// --- Main Component ---
export default function PitchDecksManagement() {
  const { authFetch } = useAuth();
  const [decks, setDecks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  // 📡 Fetch Decks
  useEffect(() => {
    const fetchDecks = async () => {
      try {
        // Cache-buster so deleted/uploaded decks stay in sync.
        const response = await authFetch(`/api/decks?t=${Date.now()}`, {
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        });
        if (response.ok) {
          const data = await response.json();
          const formattedData = data.map((deck: any) => ({
            ...deck,
            image: "/deck-placeholder.svg",
          }));
          setDecks(formattedData);
          setIsLoading(false);
          return;
        }
      } catch (error) {
        console.warn("Backend unavailable. Ensure your server is running.");
      }
      setIsLoading(false);
    };

    fetchDecks();
  }, []);

  // 🖼️ Preview a deck — resolve a short-lived signed URL (private bucket) then
  // open it. Raw database file references are never used as navigation targets;
  // only the owner-checked signing endpoint may issue a preview capability.
  const onPreview = useCallback(
    async (deckId: string | number, _fileUrl?: string) => {
      let target = "";
      try {
        const res = await authFetch(`/api/decks/${deckId}/signed-url`);
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.url) target = data.url;
        }
      } catch {}
      if (!target) return;
      window.open(target, "_blank", "noreferrer");
    },
    [authFetch],
  );

  // ☁️ Upload File
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploadedFiles((prev) => [...acceptedFiles, ...prev]);

    const tempDecks = acceptedFiles.map((file) => {
      const tempId = Math.random().toString(36).substring(7);
      return {
        id: tempId,
        name: file.name.replace(/\.[^/.]+$/, ""),
        created_at: new Date().toISOString(),
        status: "DRAFT",
        image: "/deck-placeholder.svg",
        size: parseFloat((file.size / (1024 * 1024)).toFixed(2)),
        file: file,
      };
    });

    setDecks((prev) => [...tempDecks, ...prev]);

    for (const tempDeck of tempDecks) {
      const formData = new FormData();
      formData.append("deck", tempDeck.file);

      try {
        const res = await authFetch("/api/upload-deck", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("Upload failed");
        const savedDeck = await res.json();

        setDecks((currentDecks) =>
          currentDecks.map((d) =>
            d.id === tempDeck.id
              ? {
                  ...savedDeck,
                  image: "/deck-placeholder.svg",
                }
              : d,
          ),
        );
      } catch (err) {
        console.error(`Failed to upload ${tempDeck.name} to Cloud Storage.`);
        setDecks((currentDecks) =>
          currentDecks.map((d) =>
            d.id === tempDeck.id ? { ...d, status: "FAILED" } : d,
          ),
        );
      }
    }
  }, []);

  const removeDeck = async (idToRemove: string) => {
    setDecks((prev) => prev.filter((deck) => deck.id !== idToRemove));
    try {
      await authFetch(`/api/decks/${idToRemove}`, { method: "DELETE" });
    } catch (err) {}
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: true,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.ms-powerpoint": [".ppt"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        [".pptx"],
    },
    maxSize: 25 * 1024 * 1024,
  } as any);

  const totalStorageUsedMB = decks.reduce((sum, deck) => sum + deck.size, 0);
  const storagePercentage = Math.min(100, (totalStorageUsedMB / 500) * 100);
  const readyDecks = decks.filter((d) => d.status === "READY").length;

  return (
    <div className="space-y-10 pb-20">
      <FirstTimeTour
        tourKey="decks"
        steps={[
          { title: "Upload your slides", body: "Drag & drop or tap Add Pitch Deck to store your slides here once — PDF or PPTX, up to 25MB.", target: '[data-tour="decks-upload"]' },
          { title: "Smarter, deck-aware questions", body: "Attach a deck to any session and the investors read it — they'll challenge your real numbers and claims, not generic ones." },
        ]}
      />
      {/* Header Stats */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-6">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-zinc-100 mb-2">
            Pitch Decks
          </h1>
          <p className="text-slate-500 dark:text-zinc-500">
            Manage and prepare your presentations for AI investor sessions.
          </p>
        </div>
        <div className="flex flex-wrap gap-6 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="flex flex-col items-end px-4 border-r border-slate-100 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">
              Total Decks
            </span>
            <span className="text-2xl font-bold text-slate-900 dark:text-zinc-100">
              {decks.length}
            </span>
          </div>
          <div className="flex flex-col items-end px-4 border-r border-slate-100 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">
              Ready
            </span>
            <span className="text-2xl font-bold text-emerald-500">
              {readyDecks}
            </span>
          </div>
          <div className="flex flex-col items-end min-w-35 px-2">
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">
              Storage Used
            </span>
            <div className="flex items-center gap-3 w-full">
              <span className="text-xl font-bold text-slate-900 dark:text-zinc-100">
                {Math.round(storagePercentage)}%
              </span>
              <div className="flex-1 h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="bg-sky-500 h-full transition-all duration-500"
                  style={{ width: `${storagePercentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Dropzone Area */}
          <div
            {...getRootProps()}
            data-tour="decks-upload"
            className={cn(
              "border-2 border-dashed rounded-4xl flex flex-col items-center justify-center p-8 transition-all group min-h-75",
              isDragActive
                ? "border-sky-500 bg-sky-50 dark:bg-sky-900/20"
                : "border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50",
            )}
          >
            <input {...getInputProps()} />
            <div
              className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors shadow-sm",
                isDragActive
                  ? "bg-sky-500 text-white"
                  : "bg-white dark:bg-zinc-800 text-slate-400 dark:text-zinc-500",
              )}
            >
              {isDragActive ? (
                <FileUp size={32} className="animate-bounce" />
              ) : (
                <Upload size={32} />
              )}
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-1 text-center">
              {isDragActive ? "Drop files here..." : "Drag & Drop files"}
            </p>
            <p className="text-xs text-slate-400 dark:text-zinc-500 text-center mb-6">
              PDF or PPTX (Max 25MB)
            </p>

            <button
              type="button"
              onClick={open}
              className="px-6 py-3 bg-sky-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-sky-500/20 hover:bg-sky-600 transition-colors flex items-center gap-2"
            >
              <Plus size={16} />
              Add Pitch Deck
            </button>

            {uploadedFiles.length > 0 && (
              <div className="mt-8 w-full space-y-2 border-t border-slate-200 dark:border-zinc-800 pt-6">
                <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest text-center mb-3">
                  Recently Added
                </p>
                {uploadedFiles.slice(0, 2).map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-xl shadow-sm"
                  >
                    <FileText size={16} className="text-sky-500 shrink-0" />
                    <span className="text-xs font-medium text-slate-700 dark:text-zinc-300 truncate flex-1">
                      {file.name}
                    </span>
                    <CheckCircle2
                      size={14}
                      className="text-emerald-500 shrink-0"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dynamic Deck Cards */}
          {isLoading ? (
            <>
              <div className="card h-75 p-6 space-y-4">
                <Skeleton className="w-full h-32 rounded-xl" />
                <Skeleton className="w-3/4 h-6" />
                <Skeleton className="w-1/2 h-4" />
              </div>
              <div className="card h-75 p-6 space-y-4">
                <Skeleton className="w-full h-32 rounded-xl" />
                <Skeleton className="w-3/4 h-6" />
                <Skeleton className="w-1/2 h-4" />
              </div>
            </>
          ) : decks.length === 0 ? (
            <div className="md:col-span-1 lg:col-span-2 flex flex-col items-center justify-center p-10 text-slate-400 border-2 border-dashed border-slate-100 dark:border-zinc-800 rounded-4xl">
              <FileText size={48} className="mb-4 opacity-50" />
              <p>No pitch decks uploaded yet.</p>
            </div>
          ) : (
            decks.map((deck) => (
              <DeckCard
                key={deck.id}
                name={deck.name}
                date={new Date(deck.created_at).toLocaleDateString()}
                status={deck.status}
                image={deck.image}
                fileUrl={deck.file_url}
                deckId={deck.id}
                onRemove={() => removeDeck(deck.id)}
                onPreview={onPreview}
              />
            ))
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-8">
          <div className="bg-slate-900 dark:bg-zinc-900 rounded-[40px] p-8 text-white relative overflow-hidden border border-white/5 shadow-xl">
            <div className="relative z-10 space-y-8">
              <div className="flex items-center gap-2">
                <Sparkles className="text-sky-400" size={20} />
                <h3 className="text-lg font-bold">AI Quick Prep</h3>
              </div>
              <p className="text-xs text-white/60 leading-relaxed">
                Optimizing your slides helps our AI engine analyze your pitch
                more accurately.
              </p>
              <div className="space-y-6">
                {[
                  {
                    title: "Clear Headings",
                    desc: "Use H1 tags or large bold text for slide titles.",
                  },
                  {
                    title: "High Contrast Charts",
                    desc: "Ensure data labels are readable for computer vision.",
                  },
                  {
                    title: "Minimalist Layout",
                    desc: "Avoid overlapping text and complex background patterns.",
                  },
                ].map((tip, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-6 h-6 bg-sky-500/20 text-sky-400 rounded-lg flex items-center justify-center shrink-0">
                      <CheckCircle2 size={14} />
                    </div>
                    <div>
                      <p className="text-xs font-bold mb-1">{tip.title}</p>
                      <p className="text-[10px] text-white/40 leading-relaxed">
                        {tip.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full py-3 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/5 transition-colors">
                View Full Guide
              </button>
            </div>
            <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
