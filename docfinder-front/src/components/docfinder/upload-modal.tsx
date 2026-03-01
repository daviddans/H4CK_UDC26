"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileUp,
  Loader2,
  Plus,
  UploadCloud,
  X,
} from "lucide-react";

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

type FileJobStatus = "queued" | "uploading" | "indexing" | "done" | "error";

type FileJob = {
  id: string;
  file: File;
  status: FileJobStatus;
  message?: string;
  docId?: string;
};

function normalizeTag(value: string) {
  return value.trim().toLowerCase();
}

function makeFileId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function statusWeight(status: FileJobStatus) {
  switch (status) {
    case "queued":
      return 0;
    case "uploading":
      return 0.4;
    case "indexing":
      return 0.75;
    case "done":
    case "error":
      return 1;
    default:
      return 0;
  }
}

export function UploadModal({ trigger, onUploaded, suggestedTags = [] }: UploadModalProps) {
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<FileJob[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [knownTags, setKnownTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);

  const availableTags = useMemo(() => {
    return Array.from(
      new Set(
        [...suggestedTags, ...knownTags, ...selectedTags]
          .map(normalizeTag)
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [knownTags, selectedTags, suggestedTags]);

  const progress = useMemo(() => {
    if (jobs.length === 0) {
      return 0;
    }
    const sum = jobs.reduce((acc, job) => acc + statusWeight(job.status), 0);
    return Math.round((sum / jobs.length) * 100);
  }, [jobs]);

  const finishedCount = useMemo(
    () => jobs.filter((job) => job.status === "done" || job.status === "error").length,
    [jobs]
  );

  const progressLabel = useMemo(() => {
    if (jobs.length === 0) {
      return "Ready";
    }
    if (loading) {
      return `${finishedCount}/${jobs.length} processed`;
    }
    if (finishedCount === jobs.length) {
      const failed = jobs.filter((job) => job.status === "error").length;
      return failed > 0
        ? `Completed with ${failed} error${failed > 1 ? "s" : ""}`
        : "Completed";
    }
    return `${finishedCount}/${jobs.length} processed`;
  }, [finishedCount, jobs, loading]);

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

  const addFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files);
    if (incoming.length === 0) {
      return;
    }

    setJobs((prev) => {
      const existing = new Set(prev.map((job) => job.id));
      const next = [...prev];
      for (const file of incoming) {
        const id = makeFileId(file);
        if (existing.has(id)) {
          continue;
        }
        existing.add(id);
        next.push({ id, file, status: "queued" });
      }
      return next;
    });
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

  const updateJob = (id: string, patch: Partial<FileJob>) => {
    setJobs((prev) => prev.map((job) => (job.id === id ? { ...job, ...patch } : job)));
  };

  const onSubmit = async () => {
    if (jobs.length === 0) {
      setError("Please choose at least one file.");
      return;
    }

    setError(null);
    setLoading(true);
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    let cancelled = false;

    const queue = [...jobs];
    for (const job of queue) {
      if (controller.signal.aborted) {
        cancelled = true;
        break;
      }

      if (job.status === "done") {
        continue;
      }

      updateJob(job.id, { status: "uploading", message: "Uploading" });

      try {
        const formData = new FormData();
        formData.append("file", job.file);
        formData.append("tags", selectedTags.join(","));

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });

        const data = (await response.json()) as {
          error?: string;
          doc_id?: string;
          details?: string[];
        };

        if (!response.ok) {
          const reason = data.error ?? "Upload failed";
          const detail = Array.isArray(data.details) && data.details.length > 0 ? `: ${data.details[0]}` : "";
          throw new Error(`${reason}${detail}`);
        }

        updateJob(job.id, { status: "indexing", message: "Indexing" });
        await new Promise((resolve) => setTimeout(resolve, 220));

        updateJob(job.id, {
          status: "done",
          message: "Indexed",
          docId: data.doc_id,
        });

        if (data.doc_id) {
          onUploaded?.(data.doc_id);
        }
      } catch (err) {
        const isAbort =
          (err instanceof DOMException && err.name === "AbortError") ||
          (err instanceof Error && err.name === "AbortError");
        if (isAbort) {
          cancelled = true;
          break;
        }

        updateJob(job.id, {
          status: "error",
          message: err instanceof Error ? err.message : "Unexpected upload error",
        });
      }
    }

    if (cancelled) {
      setError("Upload canceled.");
    }

    uploadAbortRef.current = null;
    setLoading(false);
    // Return to initial state after each run.
    setJobs([]);
    setTagInput("");
    setSelectedTags([]);
  };

  const resetAndClose = () => {
    setOpen(false);
    setLoading(false);
    setJobs([]);
    setTagInput("");
    setSelectedTags([]);
    setError(null);
  };

  const cancelUpload = () => {
    uploadAbortRef.current?.abort();
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
          <DialogTitle>Upload documents</DialogTitle>
          <DialogDescription>
            Drop multiple files and track each one while it uploads and indexes.
          </DialogDescription>
        </DialogHeader>

        <label
          className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-center hover:border-cyan-300 hover:bg-cyan-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-cyan-500/60 dark:hover:bg-cyan-500/10"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            addFiles(event.dataTransfer.files);
          }}
        >
          <FileUp className="h-8 w-8 text-slate-400 dark:text-slate-500" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {jobs.length > 0 ? `${jobs.length} file(s) selected` : "Drop files here or click to browse"}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">PDF, TXT, CSV, XLSX</p>
          <Input
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) {
                addFiles(event.target.files);
                event.target.value = "";
              }
            }}
          />
        </label>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Tags (applied to all selected files)</p>
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

        {jobs.length > 0 ? (
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/80 p-2 dark:border-slate-700 dark:bg-slate-900/70">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-700 dark:text-slate-200">{job.file.name}</p>
                  {job.message ? (
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{job.message}</p>
                  ) : null}
                </div>

                <div className="shrink-0">
                  {job.status === "queued" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      <Clock3 className="h-3 w-3" /> queued
                    </span>
                  ) : null}
                  {job.status === "uploading" || job.status === "indexing" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-cyan-100 px-2 py-1 text-[11px] font-medium text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-200">
                      <Loader2 className="h-3 w-3 animate-spin" /> {job.status}
                    </span>
                  ) : null}
                  {job.status === "done" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                      <CheckCircle2 className="h-3 w-3" /> done
                    </span>
                  ) : null}
                  {job.status === "error" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-[11px] font-medium text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">
                      <AlertTriangle className="h-3 w-3" /> error
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

        <div className="flex justify-end gap-2">
          {loading ? (
            <Button variant="outline" onClick={cancelUpload}>
              Cancel
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={resetAndClose}>
                Close
              </Button>
              <Button onClick={onSubmit} variant="accent" disabled={jobs.length === 0}>
                Upload
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
