"use client";

import { useEffect, useState, useCallback } from "react";
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
import type { MenuItem, Category, RestaurantProfile, ApiResponse } from "@/types";

export default function MenuPage() {
  const router = useRouter();
  const { addItem } = useCart();
  const { table, isDineIn } = useTable();
  const opStatus = useOperatingStatus();

  const [profile, setProfile] = useState<RestaurantProfile | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    Promise.all([
      api.get<ApiResponse<RestaurantProfile>>("/api/restaurant"),
      api.get<ApiResponse<Category[]>>("/api/categories"),
    ]).then(([profileRes, catRes]) => {
      setProfile(profileRes.data);
      setCategories(catRes.data);
    });
  }, []);

  const fetchMenu = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedCategory) params.set("category", selectedCategory);
    if (debouncedSearch) params.set("search", debouncedSearch);

    const res = await api.get<ApiResponse<MenuItem[]>>(`/api/menu?${params}`);
    setMenuItems(res.data);
    setLoading(false);
  }, [selectedCategory, debouncedSearch]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  const handleAdd = (item: MenuItem) => {
    if (!opStatus.loading && !opStatus.isOpen) {
      toast.error("Restoran sedang tutup, tidak bisa memesan.");
      return;
    }
    addItem({
      menuItemId: item.id,
      name: item.name,
      imageUrl: item.imageUrl,
      priceSnapshot: item.price,
    });
    toast.success(`${item.name} ditambahkan ke keranjang`);
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
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
        </div>
      </div>

      {/* Menu grid */}
      <div className="mx-auto mt-4 max-w-6xl px-4 sm:px-6 md:px-8">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
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
        ) : menuItems.length === 0 ? (
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {menuItems.map((item) => (
              <MenuCard key={item.id} item={item} onAdd={handleAdd} />
            ))}
          </div>
        )}
      </div>

      <CartFab onClick={() => router.push("/cart")} />
    </div>
  );
}
