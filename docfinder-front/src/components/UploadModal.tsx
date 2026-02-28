"use client";

import { AlertTriangle, FileUp, UploadCloud } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, DOC_TYPES, LANGUAGES, TAGS } from "@/lib/mock-data";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type UploadState = "idle" | "uploading" | "success" | "error";

const toggleTag = (values: string[], value: string) => (values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);

export function UploadModal({ open, onOpenChange }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [lang, setLang] = useState(LANGUAGES[0]);
  const [tags, setTags] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState<UploadState>("idle");
  const [dragging, setDragging] = useState(false);

  const canUpload = useMemo(() => file && state !== "uploading", [file, state]);

  const startUpload = () => {
    if (!file) {
      setState("error");
      return;
    }

    setState("uploading");
    setProgress(0);

    const timer = setInterval(() => {
      setProgress((current) => {
        const next = Math.min(100, current + Math.floor(Math.random() * 18) + 8);
        if (next >= 100) {
          clearInterval(timer);
          setState("success");
        }
        return next;
      });
    }, 220);
  };

  const reset = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setTimeout(() => {
        setFile(null);
        setTags([]);
        setProgress(0);
        setState("idle");
      }, 100);
    }
  };

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        <div className="bg-gradient-to-br from-[hsl(var(--primary))]/10 via-[hsl(var(--background))] to-[hsl(var(--background))] p-6">
          <DialogHeader>
            <DialogTitle className="text-xl">Upload document</DialogTitle>
            <DialogDescription>
              Drag & drop, metadata and simulated indexing. Backend upload endpoint no está disponible aún.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-4">
            <label
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const dropped = event.dataTransfer.files?.[0];
                if (dropped) {
                  setFile(dropped);
                  setState("idle");
                }
              }}
              className={`flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 text-center transition ${
                dragging ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5" : "border-[hsl(var(--border))] bg-[hsl(var(--card))]/70"
              }`}
            >
              <FileUp className="mb-2 h-8 w-8 text-[hsl(var(--muted-foreground))]" />
              <p className="text-sm font-medium">{file ? file.name : "Drop file here or click to browse"}</p>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">PDF, DOCX, TXT up to 20MB</p>
              <Input type="file" className="hidden" onChange={(event) => {
                const selected = event.target.files?.[0];
                if (selected) {
                  setFile(selected);
                  setState("idle");
                }
              }} />
            </label>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Doc type</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DOC_TYPES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={lang} onValueChange={setLang}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LANGUAGES.map((v) => <SelectItem key={v} value={v}>{v.toUpperCase()}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {TAGS.map((tag) => {
                  const active = tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setTags((current) => toggleTag(current, tag))}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        active ? "border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]" : "bg-[hsl(var(--background))] hover:bg-[hsl(var(--muted))]"
                      }`}
                    >
                      #{tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {(state === "uploading" || state === "success") ? (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{state === "success" ? "Upload completed" : `Uploading... ${progress}%`}</p>
              </div>
            ) : null}

            {state === "error" ? (
              <p className="inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 px-3 py-2 text-sm text-[hsl(var(--destructive))]">
                <AlertTriangle className="h-4 w-4" /> Select a file before uploading.
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => reset(false)}>Cancel</Button>
              <Button onClick={startUpload} disabled={!canUpload}><UploadCloud className="h-4 w-4" />Upload</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
