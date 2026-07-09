"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface MenuSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function MenuSearch({ value, onChange }: MenuSearchProps) {
  return (
    <div className="relative px-4">
      <Search className="absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Cari menu..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 pr-9"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-7 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
