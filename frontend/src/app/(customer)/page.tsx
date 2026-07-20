"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { MapPin, UtensilsCrossed } from "lucide-react";
import { api } from "@/lib/api";
import { useCart } from "@/hooks/use-cart";
import { useTable } from "@/hooks/use-table";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";
import { RestaurantHeader } from "@/components/customer/restaurant-header";
import { CategoryTabs } from "@/components/customer/category-tabs";
import { MenuSearch } from "@/components/customer/menu-search";
import { MenuCard } from "@/components/customer/menu-card";
import { CartFab } from "@/components/customer/cart-fab";
import { Skeleton } from "@/components/ui/skeleton";
import { useOperatingStatus } from "@/hooks/use-operating-status";
import type { MenuItem, Category, RestaurantProfile, CartItemAddon, ApiResponse } from "@/types";

export default function MenuPage() {
  const router = useRouter();
  const { addItem } = useCart();
  const { table, isDineIn } = useTable();
  const opStatus = useOperatingStatus();

  const [profile, setProfile] = useState<RestaurantProfile | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  // Active category tab — driven by scroll position, also set on tab click
  // so the highlight is immediate before IntersectionObserver catches up.
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const sectionsRef = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    Promise.all([
      api.get<ApiResponse<RestaurantProfile>>("/api/restaurant"),
      api.get<ApiResponse<Category[]>>("/api/categories"),
    ]).then(([profileRes, catRes]) => {
      setProfile(profileRes.data);
      setCategories(catRes.data);
    });
  }, []);

  // Load ALL menu (no category filter) — sections are rendered per category.
  const fetchMenu = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);

    const res = await api.get<ApiResponse<MenuItem[]>>(`/api/menu?${params}`);
    setMenuItems(res.data);
    setLoading(false);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  // Group items by category, preserving category sort order. Drop empty
  // categories (nothing to show there).
  const grouped = useMemo(() => {
    const byCat = new Map<string, MenuItem[]>();
    for (const item of menuItems) {
      const arr = byCat.get(item.categoryId) ?? [];
      arr.push(item);
      byCat.set(item.categoryId, arr);
    }
    return categories
      .filter((c) => byCat.has(c.id))
      .map((c) => ({ category: c, items: byCat.get(c.id)! }));
  }, [categories, menuItems]);

  // Active-tab-on-scroll: highlight the section currently in view.
  useEffect(() => {
    if (grouped.length === 0) return;
    // Default to first category until scroll settles.
    setActiveCat((prev) => prev ?? grouped[0].category.id);
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost intersecting section.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          const id = visible[0].target.getAttribute("data-cat-id");
          if (id) setActiveCat(id);
        }
      },
      // Trigger when section header crosses ~25% from top (below sticky tabs).
      { rootMargin: "-30% 0px -65% 0px", threshold: 0 }
    );
    for (const el of Object.values(sectionsRef.current)) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [grouped]);

  // Scroll a category section into view (called from tab click).
  const handleTabSelect = (id: string | null) => {
    setActiveCat(id);
    if (!id) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const el = sectionsRef.current[id];
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 140; // offset for sticky tabs
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const handleAdd = (item: MenuItem, addons: CartItemAddon[]) => {
    if (!opStatus.loading && !opStatus.isOpen) {
      toast.error("Restoran sedang tutup, tidak bisa memesan.");
      return;
    }
    addItem({
      menuItemId: item.id,
      name: item.name,
      imageUrl: item.imageUrl,
      priceSnapshot: item.price,
      addons,
    });
    const suffix = addons.length ? ` +${addons.length} addon` : "";
    toast.success(`${item.name}${suffix} ditambahkan ke keranjang`);
  };

  return (
    <div className="pb-28">
      <RestaurantHeader profile={profile} />

      {!opStatus.loading && !opStatus.isOpen && (
        <div className="mx-auto mt-4 max-w-6xl px-4 sm:px-6 md:px-8">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-sm">
            <p className="font-semibold">Restoran sedang tutup</p>
            <p className="text-xs opacity-90">{opStatus.message}. Pemesanan akan dibuka kembali sesuai jam operasional.</p>
          </div>
        </div>
      )}

      {/* Table indicator */}
      {isDineIn && table && (
        <div className="mx-auto mt-4 max-w-6xl px-4 sm:px-6 md:px-8">
          <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3 shadow-sm sm:px-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Kamu sedang di</p>
              <p className="font-semibold text-primary">
                {table.name || `Meja ${table.number}`}
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              Dine In
            </span>
          </div>
        </div>
      )}

      {/* Sticky search + tabs */}
      <div className="sticky top-0 z-20 mt-4 space-y-2 border-b border-border/50 bg-background/80 py-3 backdrop-blur-lg">
        <MenuSearch value={search} onChange={setSearch} />
        <div className="mx-auto max-w-6xl">
          <CategoryTabs
            categories={grouped.map((g) => g.category)}
            activeId={activeCat}
            onSelect={handleTabSelect}
          />
        </div>
      </div>

      {/* Menu grouped by category */}
      <div className="mx-auto mt-4 max-w-6xl px-4 sm:px-6 md:px-8">
        {loading ? (
          <div className="space-y-8">
            {Array.from({ length: 2 }).map((_, s) => (
              <div key={s}>
                <Skeleton className="mb-3 h-7 w-40" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
                      <Skeleton className="aspect-[4/3] w-full rounded-none" />
                      <div className="space-y-2 p-3">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <div className="flex justify-between pt-1">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-8 w-8 rounded-full" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-muted to-muted/40 shadow-inner">
              <UtensilsCrossed className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                Menu tidak ditemukan
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Coba kata kunci lain atau pilih kategori berbeda
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            {grouped.map(({ category, items }) => (
              <section
                key={category.id}
                data-cat-id={category.id}
                ref={(el) => { sectionsRef.current[category.id] = el; }}
                className="scroll-mt-32"
              >
                <h2 className="mb-3 flex items-center gap-2 text-lg font-bold sm:text-xl">
                  <span className="h-5 w-1.5 rounded-full bg-primary" />
                  {category.name}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({items.length})
                  </span>
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
                  {items.map((item) => (
                    <MenuCard key={item.id} item={item} onAdd={handleAdd} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <CartFab onClick={() => router.push("/cart")} />
    </div>
  );
}
