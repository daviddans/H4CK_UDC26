"use client";

import Link from "next/link";
import { Bot, FileSearch, Send } from "lucide-react";
import { motion } from "framer-motion";

import type { AskResponse } from "@/types/docfinder";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type AskPanelProps = {
  question: string;
  onChange: (value: string) => void;
  onAsk: () => void;
  loading: boolean;
  response: AskResponse | null;
};

export function AskPanel({ question, onChange, onAsk, loading, response }: AskPanelProps) {
  return (
    <div className="space-y-5">
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="h-5 w-5 text-cyan-600" />
            Ask your corpus
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={question}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Ask a specific question about your documents..."
            className="min-h-[120px]"
          />
          <div className="flex justify-end">
            <Button onClick={onAsk} variant="accent" size="lg" disabled={loading || !question.trim()}>
              <Send className="h-4 w-4" />
              {loading ? "Thinking..." : "Ask"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {response && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle className="text-base">Assistant response</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm leading-relaxed text-slate-700">
                {response.answer}
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <FileSearch className="h-4 w-4 text-slate-400" />
                  Fuentes
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {response.citations.map((citation) => (
                    <div
                      key={`${citation.doc_id}-${citation.page}`}
                      className="rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <Badge variant="outline">{citation.doc_id}</Badge>
                        <span className="text-xs text-slate-500">pag. {citation.page}</span>
                      </div>
                      <p className="mb-2 text-sm font-semibold leading-5 text-slate-800">
                        {citation.title}
                      </p>
                      <div
                        className="text-sm text-slate-600"
                        dangerouslySetInnerHTML={{ __html: citation.snippet_html }}
                      />
                      <div className="mt-3">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/document/${citation.doc_id}`}>Open source</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
