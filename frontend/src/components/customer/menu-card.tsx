"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Plus, UtensilsCrossed, Check } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { resolveImageUrl } from "@/lib/api";
import type { Addon, MenuItem, CartItemAddon } from "@/types";

interface MenuCardProps {
  item: MenuItem;
  onAdd: (item: MenuItem, addons: CartItemAddon[]) => void;
}

// Effective addons for an item: menu-scoped + category-scoped (deduped, sorted)
export function effectiveAddons(item: Pick<MenuItem, "addons" | "category">): Addon[] {
  const map = new Map<string, Addon>();
  for (const a of item.category?.addons ?? []) map.set(a.id, a);
  for (const a of item.addons ?? []) map.set(a.id, a);
  return [...map.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function MenuCard({ item, onAdd }: MenuCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const addons = useMemo(() => effectiveAddons(item), [item]);

  const selectedAddons: CartItemAddon[] = addons.filter((a) => selected[a.id]).map((a) => ({
    addonId: a.id,
    name: a.name,
    price: a.price,
  }));

  const addonTotal = selectedAddons.reduce((s, a) => s + a.price, 0);
  const unitPrice = item.price + addonTotal;

  const handlePrimaryClick = () => {
    if (addons.length > 0) {
      setSelected({});
      setPickerOpen(true);
    } else {
      onAdd(item, []);
    }
  };

  const confirmAdd = () => {
    onAdd(item, selectedAddons);
    setPickerOpen(false);
    setSelected({});
  };

  return (
    <>
      <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10">
        {/* Image */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          {item.imageUrl ? (
            <Image
              src={resolveImageUrl(item.imageUrl)}
              alt={item.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-110"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 via-emerald-100 to-primary/20 dark:from-primary/20 dark:via-emerald-900/40 dark:to-primary/30">
              <UtensilsCrossed className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}

          {/* Gradient overlay for readability on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          {/* Unavailable overlay */}
          {!item.isAvailable && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
              <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-red-600 shadow-lg">
                Habis
              </span>
            </div>
          )}

          {/* Addon badge */}
          {addons.length > 0 && item.isAvailable && (
            <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
              +{addons.length} addon
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col p-3 sm:p-4">
          <h3 className="line-clamp-1 text-sm font-semibold leading-tight sm:text-base">
            {item.name}
          </h3>
          {item.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {item.description}
            </p>
          )}
          <div className="mt-auto flex items-center justify-between pt-3">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground/70">Harga</span>
              <span className="text-sm font-bold text-primary sm:text-base">
                {formatCurrency(item.price)}
              </span>
            </div>
            <button
              onClick={handlePrimaryClick}
              disabled={!item.isAvailable}
              aria-label={`Tambah ${item.name}`}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/25 transition-all duration-200 hover:scale-110 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 sm:h-10 sm:w-10"
            >
              <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Addon picker dialog */}
      {pickerOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md overflow-hidden rounded-t-2xl border bg-background shadow-2xl sm:rounded-2xl">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-semibold">{item.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Pilih addon (opsional)</p>
            </div>

            <div className="max-h-[50vh] space-y-1 overflow-y-auto p-3">
              {addons.map((a) => {
                const checked = !!selected[a.id];
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelected((s) => ({ ...s, [a.id]: !s[a.id] }))}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                      checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                        checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
                      }`}
                    >
                      {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-medium">{a.name}</span>
                    <span className="whitespace-nowrap text-sm font-semibold text-primary">
                      +{formatCurrency(a.price)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="border-t bg-muted/30 px-4 py-3">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Harga / item</span>
                <span className="font-bold text-primary">{formatCurrency(unitPrice)}</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setPickerOpen(false); setSelected({}); }}
                  className="flex-1 rounded-xl border border-border bg-background py-2.5 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmAdd}
                  className="flex-[2] rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground shadow-md shadow-primary/25 transition-all hover:bg-primary/90 active:scale-[0.98]"
                >
                  Tambah — {formatCurrency(unitPrice)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
