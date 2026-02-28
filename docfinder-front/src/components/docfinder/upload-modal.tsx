"use client";

import { useMemo, useRef, useState } from "react";
import { FileUp, Loader2, UploadCloud } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type UploadModalProps = {
  trigger?: React.ReactNode;
  onUploaded?: (docId: string) => void;
};

const DOC_TYPES = ["policy", "report", "manual", "checklist", "template", "guide"];
const CATEGORIES = ["security", "compliance", "operations", "finance", "audit", "privacy"];
const LANGS = ["en", "es", "pt", "fr"];

export function UploadModal({ trigger, onUploaded }: UploadModalProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("policy");
  const [category, setCategory] = useState("compliance");
  const [tags, setTags] = useState("enterprise, controls");
  const [lang, setLang] = useState("en");
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

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
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
      formData.append("doc_type", docType);
      formData.append("category", category);
      formData.append("tags", tags);
      formData.append("lang", lang);

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
            Drag and drop your file, classify it, and send it to the index pipeline.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Backend tools
          </p>
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

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Doc type</p>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Category</p>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Language</p>
            <Select value={lang} onValueChange={setLang}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Tags</p>
            <Input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="security, gdpr"
            />
          </div>
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
