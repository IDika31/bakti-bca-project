"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
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

  const token = typeof window !== "undefined" ? localStorage.getItem("admin-token") || "" : "";

  const fetchData = async () => {
    const [menuRes, catRes] = await Promise.all([
      api.get<PaginatedResponse<MenuItemAdmin>>("/api/admin/menu", { token }),
      api.get<ApiResponse<Category[]>>("/api/admin/categories", { token }),
    ]);
    setItems(menuRes.data);
    setCategories(catRes.data);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "", price: 0, categoryId: categories[0]?.id || "", imageUrl: "" });
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
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        price: form.price,
        categoryId: form.categoryId,
        imageUrl: form.imageUrl || undefined,
      };

      if (editing) {
        await api.put(`/api/admin/menu/${editing.id}`, payload, { token });
        toast.success("Menu diperbarui");
      } else {
        await api.post("/api/admin/menu", payload, { token });
        toast.success("Menu ditambahkan");
      }
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus menu ini?")) return;
    try {
      await api.delete(`/api/admin/menu/${id}`, { token });
      toast.success("Menu dihapus");
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
    }
  };

  const toggleAvailability = async (id: string, isAvailable: boolean) => {
    await api.patch(`/api/admin/menu/${id}/availability`, { isAvailable }, { token });
    fetchData();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Daftar Menu</h2>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Tambah Menu
        </Button>
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
                <Label>URL Gambar</Label>
                <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className="mt-1" placeholder="https://..." />
              </div>
              <Button className="w-full" onClick={handleSubmit}>Simpan</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex items-center gap-3 p-3">
              <div className="flex-1">
                <p className="font-medium">{item.name}</p>
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
              <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
