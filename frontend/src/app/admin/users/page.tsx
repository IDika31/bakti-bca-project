"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, UserCog, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api";
import { getAdminUser } from "@/lib/auth";
import { useRequireRole } from "@/hooks/use-require-role";
import { toast } from "sonner";
import type { ApiResponse, AdminRole, AdminUser } from "@/types";

interface AdminUserRow extends AdminUser {
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const ROLE_LABEL: Record<AdminRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  CASHIER: "Kasir",
};

const ROLE_VARIANT: Record<AdminRole, "default" | "secondary" | "outline"> = {
  OWNER: "default",
  ADMIN: "secondary",
  CASHIER: "outline",
};

const emptyForm = { username: "", name: "", password: "", role: "CASHIER" as AdminRole };

export default function AdminUsersPage() {
  const { ready, allowed } = useRequireRole("OWNER");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("admin-token") || "" : "";
  const me = getAdminUser();

  const fetchUsers = async () => {
    const res = await api.get<ApiResponse<AdminUserRow[]>>("/api/admin/users", { token });
    setUsers(res.data);
  };

  useEffect(() => {
    if (ready && allowed) fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, allowed, token]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (u: AdminUserRow) => {
    setEditing(u);
    setForm({ username: u.username, name: u.name, password: "", role: u.role });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      if (editing) {
        const payload: Record<string, unknown> = { name: form.name, role: form.role };
        if (form.password) payload.password = form.password;
        await api.put(`/api/admin/users/${editing.id}`, payload, { token });
        toast.success("User diperbarui");
      } else {
        await api.post("/api/admin/users", form, { token });
        toast.success("User ditambahkan");
      }
      setDialogOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/admin/users/${deleteTarget.id}`, { token });
      toast.success("User dihapus");
      setDeleteTarget(null);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
    }
  };

  const toggleActive = async (u: AdminUserRow, isActive: boolean) => {
    try {
      await api.put(`/api/admin/users/${u.id}`, { isActive }, { token });
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah status");
    }
  };

  if (!ready || !allowed) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Kelola User</h2>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Tambah User
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Kelola akun staf. Owner memiliki akses penuh termasuk halaman ini. Minimal 1 owner aktif harus tetap ada.
      </p>

      <div className="space-y-2">
        {users.map((u) => {
          const isSelf = me?.id === u.id;
          return (
            <Card key={u.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <div className="h-10 w-10 flex-shrink-0 rounded-full bg-muted flex items-center justify-center">
                  <UserCog className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{u.name}</p>
                    <Badge variant={ROLE_VARIANT[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                    {isSelf && <span className="text-[10px] text-muted-foreground">(Anda)</span>}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    @{u.username}
                    {u.lastLoginAt ? ` · login ${new Date(u.lastLoginAt).toLocaleDateString("id-ID")}` : " · belum pernah login"}
                  </p>
                </div>
                <Switch
                  checked={u.isActive}
                  disabled={isSelf}
                  onCheckedChange={(checked) => toggleActive(u, checked)}
                />
                <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isSelf}
                  onClick={() => setDeleteTarget(u)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
        {users.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Belum ada user. Klik &ldquo;Tambah User&rdquo; untuk membuat.
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit User" : "Tambah User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Username</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                disabled={!!editing}
                className="mt-1"
                placeholder="huruf/angka/_-. min 3"
              />
            </div>
            <div>
              <Label>Nama</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: (v as AdminRole) ?? form.role })}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OWNER">Owner (akses penuh)</SelectItem>
                  <SelectItem value="ADMIN">Admin (operasional)</SelectItem>
                  <SelectItem value="CASHIER">Kasir (pesanan + pembayaran)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{editing ? "Password baru (kosongkan jika tidak ganti)" : "Password"}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="mt-1"
                placeholder={editing ? "••••••" : "min 6 karakter"}
              />
            </div>
            <Button className="w-full" onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Hapus User?"
        description={`"${deleteTarget?.name}" (@${deleteTarget?.username}) akan dihapus permanen.`}
        confirmLabel="Ya, Hapus"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
