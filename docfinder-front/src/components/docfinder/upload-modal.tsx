"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileUp, Loader2, Plus, UploadCloud, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type UploadModalProps = {
  trigger?: React.ReactNode;
  onUploaded?: (docId: string) => void;
  suggestedTags?: string[];
};

function normalizeTag(value: string) {
  return value.trim().toLowerCase();
}

export function UploadModal({ trigger, onUploaded, suggestedTags = [] }: UploadModalProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [knownTags, setKnownTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(false);
  const [initMessage, setInitMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const progressLabel = useMemo(() => {
    if (!loading && progress === 0) {
      return "Ready";
    }
    if (loading) {
      return `Uploading ${progress}%`;
    }
    return "Completed";
  }, [loading, progress]);

  const availableTags = useMemo(() => {
    return Array.from(
      new Set(
        [...suggestedTags, ...knownTags, ...selectedTags]
          .map(normalizeTag)
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [knownTags, selectedTags, suggestedTags]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let disposed = false;
    async function loadTags() {
      try {
        const response = await fetch("/api/tags");
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { tags?: string[] };
        if (!disposed) {
          setKnownTags(Array.isArray(payload.tags) ? payload.tags.map(normalizeTag).filter(Boolean) : []);
        }
      } catch {
        if (!disposed) {
          setKnownTags([]);
        }
      }
    }

    void loadTags();
    return () => {
      disposed = true;
    };
  }, [open]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const addTag = (raw: string) => {
    const next = normalizeTag(raw);
    if (!next) {
      return;
    }
    setSelectedTags((prev) => (prev.includes(next) ? prev : [...prev, next]));
    setKnownTags((prev) =>
      prev.includes(next) ? prev : [...prev, next].sort((a, b) => a.localeCompare(b))
    );
    setTagInput("");
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const onSubmit = async () => {
    if (!file) {
      setError("Please choose a file first.");
      return;
    }

    setError(null);
    setLoading(true);
    setProgress(0);

    timerRef.current = setInterval(() => {
      setProgress((prev) => Math.min(prev + 7, 95));
    }, 120);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tags", selectedTags.join(","));

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Upload failed");
      }

      clearTimer();
      setProgress(100);
      onUploaded?.(data.doc_id as string);
      window.setTimeout(() => {
        setOpen(false);
        setLoading(false);
        setProgress(0);
        setFile(null);
        setSelectedTags([]);
        setTagInput("");
      }, 500);
    } catch (err) {
      clearTimer();
      setLoading(false);
      setProgress(0);
      setError(err instanceof Error ? err.message : "Unexpected upload error");
    }
  };

  const onInitIndex = async () => {
    setInitLoading(true);
    setInitMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/init", { method: "POST" });
      const payload = (await response.json()) as {
        error?: string;
        details?: string[];
      };
      if (!response.ok) {
        throw new Error(
          payload.error
            ? `${payload.error}${payload.details?.[0] ? `: ${payload.details[0]}` : ""}`
            : "Init failed"
        );
      }
      setInitMessage("Index initialized in backend.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected init error");
    } finally {
      setInitLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="accent" size="lg">
            <UploadCloud className="h-5 w-5" />
            Upload
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>
            Drop your file and tag it before sending to the index pipeline.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs text-slate-600 dark:text-slate-300">Backend tools</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={onInitIndex}
            disabled={initLoading || loading}
          >
            {initLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Initializing
              </>
            ) : (
              "Init index"
            )}
          </Button>
        </div>

        {initMessage && (
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {initMessage}
          </p>
        )}

        <label
          className="flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-center hover:border-cyan-300 hover:bg-cyan-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-cyan-500/60 dark:hover:bg-cyan-500/10"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const dropped = event.dataTransfer.files?.[0];
            if (dropped) {
              setFile(dropped);
            }
          }}
        >
          <FileUp className="h-8 w-8 text-slate-400 dark:text-slate-500" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {file ? file.name : "Drop file here or click to browse"}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">PDF, TXT, CSV, XLSX</p>
          <Input
            type="file"
            className="hidden"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Tags</p>
          <div className="flex items-center gap-2">
            <Input
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              placeholder="Write a tag and press Enter"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTag(tagInput);
                }
              }}
            />
            <Button type="button" variant="secondary" onClick={() => addTag(tagInput)}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>

          {selectedTags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-cyan-200/80 bg-cyan-50/80 p-2 dark:border-cyan-500/40 dark:bg-cyan-500/10">
              {selectedTags.map((tag) => (
                <button
                  key={`selected-${tag}`}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="inline-flex items-center gap-1 rounded-full border border-cyan-300 bg-cyan-100 px-2 py-1 text-xs font-medium text-cyan-700 dark:border-cyan-400/60 dark:bg-cyan-500/20 dark:text-cyan-200"
                  title="Unselect tag"
                >
                  {tag}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          ) : null}

          {availableTags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {availableTags.map((tag) => {
                const selected = selectedTags.includes(tag);
                return (
                  <button
                    key={`known-${tag}`}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={
                      selected
                        ? "rounded-full border border-cyan-300 bg-cyan-100 px-2 py-1 text-xs font-medium text-cyan-700 dark:border-cyan-400/60 dark:bg-cyan-500/20 dark:text-cyan-200"
                        : "rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    }
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">No tags yet. Create the first one.</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{progressLabel}</p>
        </div>

        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onSubmit} variant="accent" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading
              </>
            ) : (
              "Upload"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
