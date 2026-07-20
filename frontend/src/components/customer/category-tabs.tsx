"use client";

import { useRef, useEffect } from "react";
import type { Category } from "@/types";
import { cn } from "@/lib/utils";

interface CategoryTabsProps {
  categories: Category[];
  /** Currently-active category id (drives highlight). null = "Semua". */
  activeId: string | null;
  /** Called on tab click with the category id, or null for "Semua". */
  onSelect: (id: string | null) => void;
}

export function CategoryTabs({ categories, activeId, onSelect }: CategoryTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the active tab in view inside the horizontal scroller.
  useEffect(() => {
    const active = activeId
      ? scrollRef.current?.querySelector(`[data-id="${activeId}"]`)
      : scrollRef.current?.querySelector(`[data-id="__all"]`);
    active?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeId]);

  if (categories.length === 0) return null;

  return (
    <div className="relative">
      {/* Fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-background to-transparent sm:w-8" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-background to-transparent sm:w-8" />

      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-hide sm:px-6 md:px-8"
      >
        <button
          data-id="__all"
          onClick={() => onSelect(null)}
          className={cn(
            "flex-shrink-0 whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium transition-all duration-200",
            !activeId
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-2 ring-primary/20 ring-offset-2 ring-offset-background"
              : "border border-border bg-card text-muted-foreground hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground hover:shadow-md"
          )}
        >
          Semua
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            data-id={cat.id}
            onClick={() => onSelect(cat.id)}
            className={cn(
              "flex-shrink-0 whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium transition-all duration-200",
              activeId === cat.id
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-2 ring-primary/20 ring-offset-2 ring-offset-background"
                : "border border-border bg-card text-muted-foreground hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground hover:shadow-md"
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  );
}
