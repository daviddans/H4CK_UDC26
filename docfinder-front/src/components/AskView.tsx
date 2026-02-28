"use client";

import { MessageSquareText, Send, Sparkles } from "lucide-react";
import { FormEvent, useState } from "react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { AskResponse } from "@/lib/types";

export function AskView({ defaultQuestion = "" }: { defaultQuestion?: string }) {
  const [question, setQuestion] = useState(defaultQuestion);
  const [data, setData] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!question.trim()) {
      setError("Escribe una pregunta");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) throw new Error("ask failed");
      setData((await response.json()) as AskResponse);
    } catch {
      setError("No se pudo obtener respuesta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquareText className="h-5 w-5" /> Ask the corpus
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onSubmit}>
            <Textarea value={question} onChange={(event) => setQuestion(event.target.value)} className="min-h-28" placeholder="Ask about SLA, compliance, GDPR..." />
            <div className="flex items-center justify-between">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Grounded only on available snippets.</p>
              <Button type="submit" disabled={loading}>{loading ? "Asking..." : "Ask"}<Send className="h-4 w-4" /></Button>
            </div>
          </form>
          {error ? <p className="mt-2 text-sm text-[hsl(var(--destructive))]">{error}</p> : null}
        </CardContent>
      </Card>

      {data ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" />Answer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl border border-[hsl(var(--primary))]/20 bg-[hsl(var(--primary))]/5 p-4 text-sm leading-7">{data.answer}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Fuentes</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {data.citations.map((c, i) => (
                <article key={`${c.doc_id}-${i}`} className="rounded-xl border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{c.title}</p>
                    <span className="rounded-lg bg-[hsl(var(--muted))] px-2 py-0.5 text-xs">p. {c.page}</span>
                  </div>
                  <p className="mb-2 text-xs text-[hsl(var(--muted-foreground))]">{c.doc_id}</p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]" dangerouslySetInnerHTML={{ __html: c.snippet_html }} />
                </article>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      ) : null}
    </section>
  );
}
