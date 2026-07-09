"use client";

import { useRef, useEffect } from "react";
import type { Category } from "@/types";
import { cn } from "@/lib/utils";

interface CategoryTabsProps {
  categories: Category[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}

export function CategoryTabs({ categories, selected, onSelect }: CategoryTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected && scrollRef.current) {
      const active = scrollRef.current.querySelector(`[data-id="${selected}"]`);
      active?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [selected]);

  return (
    <div ref={scrollRef} className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-hide">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
          !selected
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
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
            "whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            selected === cat.id
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
