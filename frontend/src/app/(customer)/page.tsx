"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useCart } from "@/hooks/use-cart";
import { useTable } from "@/hooks/use-table";
import { useDebounce } from "@/hooks/use-debounce";
import { RestaurantHeader } from "@/components/customer/restaurant-header";
import { CategoryTabs } from "@/components/customer/category-tabs";
import { MenuSearch } from "@/components/customer/menu-search";
import { MenuCard } from "@/components/customer/menu-card";
import { CartFab } from "@/components/customer/cart-fab";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { MenuItem, Category, RestaurantProfile, ApiResponse } from "@/types";

export default function MenuPage() {
  const router = useRouter();
  const { addItem } = useCart();
  const { table, isDineIn } = useTable();

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
    addItem({
      menuItemId: item.id,
      name: item.name,
      imageUrl: item.imageUrl,
      priceSnapshot: item.price,
    });
  };

  return (
    <div className="pb-24">
      <RestaurantHeader profile={profile} />

      {isDineIn && table && (
        <div className="px-4 pb-2">
          <Badge variant="secondary" className="text-sm">
            📍 {table.name || `Meja ${table.number}`}
          </Badge>
        </div>
      )}

      <div className="space-y-3">
        <MenuSearch value={search} onChange={setSearch} />
        <CategoryTabs categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} />

        {loading ? (
          <div className="grid grid-cols-2 gap-3 px-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
            ))}
          </div>
        ) : menuItems.length === 0 ? (
          <div className="px-4 py-12 text-center text-muted-foreground">
            <p className="text-4xl">🍽️</p>
            <p className="mt-2">Menu tidak ditemukan</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3">
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
