import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { DocumentDetailView } from "@/components/DocumentDetailView";
import { Button } from "@/components/ui/button";
import { getDocumentById, getEvidenceByDocId } from "@/lib/mock-data";

export default function DocumentPage({ params }: { params: { docId: string } }) {
  const document = getDocumentById(params.docId);
  if (!document) {
    notFound();
  }

  const evidence = getEvidenceByDocId(params.docId);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,rgba(91,107,255,0.12),transparent_28%),linear-gradient(180deg,#f9fafe,#f6f7fc)] px-4 py-7 sm:px-6 lg:px-8 dark:bg-[linear-gradient(180deg,#121626,#0f172a)]">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Back to search
          </Link>
        </Button>

        <DocumentDetailView document={document} evidence={evidence} />
      </div>
    </main>
  );
}
