"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Upload, X, ImageIcon, Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { api, resolveImageUrl } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";
import type { ApiResponse, PaginatedResponse, Category } from "@/types";

interface MenuItemAdmin {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  categoryId: string;
  category: { id: string; name: string };
}

export default function AdminMenuPage() {
  const [items, setItems] = useState<MenuItemAdmin[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItemAdmin | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: 0, categoryId: "", imageUrl: "" });
  const [imageMode, setImageMode] = useState<"upload" | "url">("upload");
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_LIMIT = 50;
  const [deleteTarget, setDeleteTarget] = useState<MenuItemAdmin | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("admin-token") || "" : "";

  const fetchMenu = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(PAGE_LIMIT));
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (categoryFilter !== "ALL") params.set("category", categoryFilter);
    const menuRes = await api.get<PaginatedResponse<MenuItemAdmin>>(`/api/admin/menu?${params}`, { token });
    setItems(menuRes.data);
    setTotal(menuRes.meta.total);
    setTotalPages(menuRes.meta.totalPages);
  }, [page, debouncedSearch, categoryFilter, token]);

  useEffect(() => {
    api.get<ApiResponse<Category[]>>("/api/admin/categories", { token }).then((res) => setCategories(res.data));
  }, [token]);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  // Reset to page 1 when filters change.
  useEffect(() => { setPage(1); }, [debouncedSearch, categoryFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "", price: 0, categoryId: categories[0]?.id || "", imageUrl: "" });
    setImageMode("upload");
    setDialogOpen(true);
  };

  const openEdit = (item: MenuItemAdmin) => {
    setEditing(item);
    setForm({
      name: item.name,
      description: item.description || "",
      price: item.price,
      categoryId: item.categoryId,
      imageUrl: item.imageUrl || "",
    });
    setImageMode(item.imageUrl && /^https?:\/\//i.test(item.imageUrl) ? "url" : "upload");
    setDialogOpen(true);
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran maksimal 5MB");
      return;
    }
    setUploading(true);
    try {
      const res = await api.upload<ApiResponse<{ url: string }>>(
        "/api/admin/upload/menu",
        file,
        { token }
      );
      setForm((f) => ({ ...f, imageUrl: res.data.url }));
      toast.success("Gambar terunggah");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal upload");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        price: form.price,
        categoryId: form.categoryId,
        // Send "" to clear the image; backend normalizes to null + deletes file.
        imageUrl: form.imageUrl,
      };

      if (editing) {
        await api.put(`/api/admin/menu/${editing.id}`, payload, { token });
        toast.success("Menu diperbarui");
      } else {
        await api.post("/api/admin/menu", payload, { token });
        toast.success("Menu ditambahkan");
      }
      setDialogOpen(false);
      fetchMenu();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/admin/menu/${deleteTarget.id}`, { token });
      toast.success("Menu dihapus");
      setDeleteTarget(null);
      fetchMenu();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
    }
  };

  const toggleAvailability = async (id: string, isAvailable: boolean) => {
    await api.patch(`/api/admin/menu/${id}/availability`, { isAvailable }, { token });
    fetchMenu();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Daftar Menu</h2>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Tambah Menu
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari menu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "ALL")}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Kategori</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">{total} menu{totalPages > 1 ? ` · halaman ${page}/${totalPages}` : ""}</p>

      <div className="space-y-2">
        {items.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Tidak ada menu{debouncedSearch || categoryFilter !== "ALL" ? " yang cocok dengan filter" : ""}. Klik &ldquo;Tambah Menu&rdquo; untuk membuat.
            </CardContent>
          </Card>
        ) : items.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex items-center gap-3 p-3">
              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border bg-muted">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolveImageUrl(item.imageUrl)}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{item.name}</p>
                <p className="text-sm text-muted-foreground">
                  {item.category.name} · {formatCurrency(item.price)}
                </p>
              </div>
              <Switch
                checked={item.isAvailable}
                onCheckedChange={(checked) => toggleAvailability(item.id, checked)}
              />
              <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(item)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            Sebelumnya
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Berikutnya
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Menu" : "Tambah Menu"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nama</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" rows={2} />
            </div>
            <div>
              <Label>Harga (Rp)</Label>
              <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="mt-1" />
            </div>
            <div>
              <Label>Kategori</Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v ?? "" })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Gambar Menu</Label>
              <div className="mt-1 flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setImageMode("upload")}
                  className={`rounded-md px-3 py-1 ${imageMode === "upload" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setImageMode("url")}
                  className={`rounded-md px-3 py-1 ${imageMode === "url" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  Pakai URL
                </button>
              </div>

              {form.imageUrl && (
                <div className="relative mt-2 h-32 w-32 overflow-hidden rounded-md border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveImageUrl(form.imageUrl)}
                    alt="preview"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, imageUrl: "" })}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                    aria-label="Hapus gambar"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {imageMode === "upload" ? (
                <div className="mt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Mengunggah...</>
                    ) : form.imageUrl ? (
                      <><ImageIcon className="h-4 w-4" /> Ganti Gambar</>
                    ) : (
                      <><Upload className="h-4 w-4" /> Pilih Gambar</>
                    )}
                  </Button>
                  <p className="mt-1 text-xs text-muted-foreground">JPG/PNG/WEBP/GIF, maks 5MB</p>
                </div>
              ) : (
                <Input
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  className="mt-2"
                  placeholder="https://..."
                />
              )}
            </div>
            <Button className="w-full" onClick={handleSubmit}>Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Hapus Menu?"
        description={`"${deleteTarget?.name}" akan dihapus permanen.`}
        confirmLabel="Ya, Hapus"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
