import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-cyan-700">404</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">Page not found</h1>
      <p className="mt-3 max-w-md text-slate-500">
        The requested page does not exist in this DocFinder demo workspace.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Go to Home</Link>
      </Button>
    </div>
  );
}
