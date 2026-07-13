"use client";

import { Search, X } from "lucide-react";

interface MenuSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function MenuSearch({ value, onChange }: MenuSearchProps) {
  return (
    <div className="px-4 sm:px-6 md:px-8">
      <div className="group relative mx-auto max-w-2xl">
        <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-primary/20 via-emerald-400/20 to-primary/20 opacity-0 blur-md transition-opacity duration-300 group-focus-within:opacity-100" />
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <input
            type="text"
            placeholder="Cari menu favorit kamu..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-12 w-full rounded-full border border-border bg-card pl-11 pr-11 text-sm shadow-sm transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 sm:h-13 sm:text-base"
          />
          {value && (
            <button
              onClick={() => onChange("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
