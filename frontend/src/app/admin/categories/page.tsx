"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ApiResponse } from "@/types";
import { useRequireRole } from "@/hooks/use-require-role";

interface CategoryAdmin {
  id: string;
  name: string;
  sortOrder: number;
  _count: { menuItems: number };
}

export default function AdminCategoriesPage() {
  const { ready, allowed } = useRequireRole("OWNER", "ADMIN");
  const [categories, setCategories] = useState<CategoryAdmin[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryAdmin | null>(null);
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState(0);

  const deleteDialog = useConfirmDialog();
  const [deletingCat, setDeletingCat] = useState<CategoryAdmin | null>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("admin-token") || "" : "";

  const fetchData = async () => {
    const res = await api.get<ApiResponse<CategoryAdmin[]>>("/api/admin/categories", { token });
    setCategories(res.data);
  };

  useEffect(() => { void fetchData(); }, [token]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setSortOrder(categories.length);
    setDialogOpen(true);
  };

  const openEdit = (cat: CategoryAdmin) => {
    setEditing(cat);
    setName(cat.name);
    setSortOrder(cat.sortOrder);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (editing) {
        await api.put(`/api/admin/categories/${editing.id}`, { name, sortOrder }, { token });
        toast.success("Kategori diperbarui");
      } else {
        await api.post("/api/admin/categories", { name, sortOrder }, { token });
        toast.success("Kategori ditambahkan");
      }
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    }
  };

  const handleDelete = async (cat: CategoryAdmin) => {
    if (cat._count.menuItems > 0) {
      toast.error(`Tidak bisa hapus — masih ada ${cat._count.menuItems} menu`);
      return;
    }
    setDeletingCat(cat);
    const ok = await deleteDialog.confirm();
    setDeletingCat(null);
    if (!ok) return;
    try {
      await api.delete(`/api/admin/categories/${cat.id}`, { token });
      toast.success("Kategori dihapus");
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
    }
  };

  if (!ready || !allowed) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Kategori Menu</h2>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Tambah
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Kategori" : "Tambah Kategori"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nama Kategori</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Urutan</Label>
                <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className="mt-1" />
              </div>
              <Button className="w-full" onClick={handleSubmit}>Simpan</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {categories.map((cat) => (
          <Card key={cat.id}>
            <CardContent className="flex items-center gap-3 p-3">
              <div className="flex-1">
                <p className="font-medium">{cat.name}</p>
              </div>
              <Badge variant="secondary">{cat._count.menuItems} menu</Badge>
              <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(cat)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={deleteDialog.setOpen}
        title="Hapus Kategori"
        description={`Yakin hapus kategori "${deletingCat?.name}"?`}
        confirmLabel="Hapus"
        variant="destructive"
        onConfirm={deleteDialog.handleConfirm}
      />
    </div>
  );
}
