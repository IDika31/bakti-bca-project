"use client";

import Image from "next/image";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { MenuItem } from "@/types";

interface MenuCardProps {
  item: MenuItem;
  onAdd: (item: MenuItem) => void;
}

export function MenuCard({ item, onAdd }: MenuCardProps) {
  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-square w-full bg-muted">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl text-muted-foreground/30">
            🍽️
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-1 text-sm font-semibold">{item.name}</h3>
        {item.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
        )}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-bold text-primary">{formatCurrency(item.price)}</span>
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => onAdd(item)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
