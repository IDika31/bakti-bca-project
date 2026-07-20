"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Tag, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ApiResponse, PaginatedResponse, Category } from "@/types";

interface AddonAdmin {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  sortOrder: number;
  menuItemId: string | null;
  categoryId: string | null;
  menuItem: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
}

interface MenuItemAdmin {
  id: string;
  name: string;
  category: { id: string; name: string };
}

type Scope = "menu" | "category";

export default function AdminAddonsPage() {
  const [addons, setAddons] = useState<AddonAdmin[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemAdmin[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AddonAdmin | null>(null);

  const [scope, setScope] = useState<Scope>("menu");
  const [menuItemId, setMenuItemId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  const [scopeFilter, setScopeFilter] = useState<"ALL" | Scope>("ALL");

  const deleteDialog = useConfirmDialog();
  const [deletingAddon, setDeletingAddon] = useState<AddonAdmin | null>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("admin-token") || "" : "";

  const fetchData = async () => {
    const [addonRes, catRes, menuRes] = await Promise.all([
      api.get<ApiResponse<AddonAdmin[]>>("/api/admin/addons", { token }),
      api.get<ApiResponse<Category[]>>("/api/admin/categories", { token }),
      api.get<PaginatedResponse<MenuItemAdmin>>("/api/admin/menu?limit=200", { token }),
    ]);
    setAddons(addonRes.data);
    setCategories(catRes.data);
    setMenuItems(menuRes.data);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = addons.filter((a) => {
    if (scopeFilter === "ALL") return true;
    if (scopeFilter === "menu") return !!a.menuItemId;
    return !!a.categoryId;
  });

  const openCreate = () => {
    setEditing(null);
    setScope("menu");
    setMenuItemId("");
    setCategoryId("");
    setName("");
    setPrice(0);
    setSortOrder(0);
    setIsActive(true);
    setDialogOpen(true);
  };

  const openEdit = (a: AddonAdmin) => {
    setEditing(a);
    if (a.menuItemId) {
      setScope("menu");
      setMenuItemId(a.menuItemId);
      setCategoryId("");
    } else if (a.categoryId) {
      setScope("category");
      setCategoryId(a.categoryId);
      setMenuItemId("");
    }
    setName(a.name);
    setPrice(a.price);
    setSortOrder(a.sortOrder);
    setIsActive(a.isActive);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Nama addon wajib diisi");
      return;
    }
    if (scope === "menu" && !menuItemId) {
      toast.error("Pilih menu terlebih dahulu");
      return;
    }
    if (scope === "category" && !categoryId) {
      toast.error("Pilih kategori terlebih dahulu");
      return;
    }

    const payload: Record<string, unknown> = {
      name,
      price,
      sortOrder,
      isActive,
    };
    if (scope === "menu") payload.menuItemId = menuItemId;
    else payload.categoryId = categoryId;

    try {
      if (editing) {
        await api.put(`/api/admin/addons/${editing.id}`, payload, { token });
        toast.success("Addon diperbarui");
      } else {
        await api.post("/api/admin/addons", payload, { token });
        toast.success("Addon ditambahkan");
      }
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    }
  };

  const handleDelete = async (a: AddonAdmin) => {
    setDeletingAddon(a);
    const ok = await deleteDialog.confirm();
    setDeletingAddon(null);
    if (!ok) return;
    try {
      await api.delete(`/api/admin/addons/${a.id}`, { token });
      toast.success("Addon dihapus");
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
    }
  };

  const toggleActive = async (a: AddonAdmin, isActive: boolean) => {
    await api.patch(`/api/admin/addons/${a.id}/availability`, { isActive }, { token });
    fetchData();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Addon Menu</h2>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Tambah Addon
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Addon berlaku untuk satu menu (menu-specific) atau semua menu dalam kategori (category-wide). Customer dapat memilih addon saat memesan.
      </p>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Filter:</span>
        <Select value={scopeFilter} onValueChange={(v) => setScopeFilter((v ?? "ALL") as "ALL" | Scope)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua</SelectItem>
            <SelectItem value="menu">Per Menu</SelectItem>
            <SelectItem value="category">Per Kategori</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} addon</span>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Belum ada addon. Klik "Tambah Addon" untuk membuat.
            </CardContent>
          </Card>
        ) : (
          filtered.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${a.menuItemId ? "bg-primary/10 text-primary" : "bg-blue-500/10 text-blue-600"}`}>
                  {a.menuItemId ? <Tag className="h-4 w-4" /> : <FolderOpen className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(a.price)} · {a.menuItemId ? `Menu: ${a.menuItem?.name ?? "-"}` : `Kategori: ${a.category?.name ?? "-"}`}
                  </p>
                </div>
                <Badge variant={a.isActive ? "default" : "secondary"}>
                  {a.isActive ? "Aktif" : "Nonaktif"}
                </Badge>
                <Switch checked={a.isActive} onCheckedChange={(v) => toggleActive(a, v)} />
                <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(a)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Addon" : "Tambah Addon"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Scope toggle */}
            <div>
              <Label>Berlaku untuk</Label>
              <div className="mt-1 flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => { setScope("menu"); setCategoryId(""); }}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 ${scope === "menu" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  <Tag className="h-3.5 w-3.5" /> Satu Menu
                </button>
                <button
                  type="button"
                  onClick={() => { setScope("category"); setMenuItemId(""); }}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 ${scope === "category" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  <FolderOpen className="h-3.5 w-3.5" /> Semua Menu di Kategori
                </button>
              </div>
            </div>

            {scope === "menu" ? (
              <div>
                <Label>Menu</Label>
                <Select value={menuItemId} onValueChange={(v) => setMenuItemId(v ?? "")}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Pilih menu" /></SelectTrigger>
                  <SelectContent>
                    {menuItems.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name} ({m.category.name})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Kategori</Label>
                <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Nama Addon</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Extra Telur, Level Pedas" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Harga (Rp)</Label>
                <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="mt-1" />
              </div>
              <div>
                <Label>Urutan</Label>
                <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className="mt-1" />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label className="text-sm">Addon aktif</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <Button className="w-full" onClick={handleSubmit}>Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={deleteDialog.setOpen}
        title="Hapus Addon"
        description={`Yakin hapus addon "${deletingAddon?.name}"?`}
        confirmLabel="Hapus"
        variant="destructive"
        onConfirm={deleteDialog.handleConfirm}
      />
    </div>
  );
}
