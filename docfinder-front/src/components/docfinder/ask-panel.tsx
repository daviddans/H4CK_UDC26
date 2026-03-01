"use client";

import Link from "next/link";
import { Bot, ExternalLink, FileSearch } from "lucide-react";
import { motion } from "framer-motion";

import type { AskResponse } from "@/types/docfinder";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function cleanTitle(title: string, docId: string) {
  const source = title?.trim() || docId;
  return source.replace(/^UPL-[A-Z0-9]{8,}-/i, "").trim();
}

function fileTypeLabel(docType?: string, sourceName?: string, title?: string) {
  if (docType?.trim()) {
    return docType.trim().toUpperCase();
  }
  const raw = sourceName?.trim() || title?.trim() || "";
  const base = raw.replaceAll("\\", "/").split("/").pop() ?? raw;
  const ext = base.includes(".") ? base.split(".").pop()?.toUpperCase() : "";
  return ext || "FILE";
}

type AskPanelProps = {
  loading: boolean;
  response: AskResponse | null;
};

export function AskPanel({ loading, response }: AskPanelProps) {
  return (
    <div className="space-y-5">
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="h-5 w-5 text-cyan-600" />
            Assistant response
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm leading-relaxed text-slate-700 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-slate-200">
            {loading
              ? "Thinking..."
              : response?.answer || "Write your question in the top search box and press Send."}
          </div>
        </CardContent>
      </Card>

      {response?.citations?.length ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle className="text-base">Fuentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <FileSearch className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                Sources used in the answer
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {response.citations.map((citation, index) => (
                  <div
                    key={`${citation.doc_id}-${citation.page}-${index}`}
                    className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>pag. {citation.page}</span>
                      <Badge variant="outline">
                        {fileTypeLabel(citation.doc_type, citation.source_name, citation.title)}
                      </Badge>
                    </div>
                    <div className="mt-1">
                      <Link
                        href={`/document/${citation.doc_id}?from=search`}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200"
                      >
                        {cleanTitle(citation.source_name ?? citation.title, citation.doc_id)}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : null}
    </div>
  );
}
