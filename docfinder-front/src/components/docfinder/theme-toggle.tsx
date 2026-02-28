"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

type ThemeMode = "light" | "dark";

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  localStorage.setItem("docfinder-theme", mode);
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  });

  return (
    <Button
      size="icon"
      variant="secondary"
      aria-label="Toggle theme"
      onClick={() => {
        const next = mode === "light" ? "dark" : "light";
        setMode(next);
        applyTheme(next);
      }}
      title={mode === "light" ? "Enable dark mode" : "Enable light mode"}
    >
      {mode === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  );
}
