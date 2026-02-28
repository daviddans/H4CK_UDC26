"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const getInitial = () => {
  if (typeof window === "undefined") {
    return false;
  }
  const stored = localStorage.getItem("docfinder-theme");
  if (stored) {
    return stored === "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

export function ThemeToggle() {
  const [dark, setDark] = useState(getInitial);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("docfinder-theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <Button variant="outline" size="icon" onClick={() => setDark((v) => !v)}>
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
