"use client";

import { Command, Search, UploadCloud } from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  query: string;
  onQueryChange: (value: string) => void;
  onOpenUpload: () => void;
  onOpenPalette: () => void;
}

export function SearchHeader({ query, onQueryChange, onOpenUpload, onOpenPalette }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b bg-[hsl(var(--background))]/85 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-w-fit items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">D</div>
          <div>
            <p className="font-semibold">DocFinder</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Document Search</p>
          </div>
        </div>

        <div className="hidden flex-1 md:block">
          <div className="relative mx-auto max-w-2xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search policies, contracts, evidence..."
              className="h-11 rounded-2xl pl-11"
            />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" className="hidden md:flex" onClick={onOpenPalette}>
            <Command className="h-4 w-4" />
            Ctrl+K
          </Button>
          <ThemeToggle />
          <Button onClick={onOpenUpload}>
            <UploadCloud className="h-4 w-4" />
            Upload
          </Button>
        </div>
      </div>
    </header>
  );
}
