"use client";

import { useEffect, useState } from "react";
import { Plus, QrCode, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { ApiResponse } from "@/types";

interface TableAdmin {
  id: string;
  number: number;
  name: string | null;
  token: string;
  isActive: boolean;
}

interface QrData {
  url: string;
  qrDataUrl: string;
  tableNumber: number;
  tableName: string | null;
}

export default function AdminTablesPage() {
  const [tables, setTables] = useState<TableAdmin[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrDialog, setQrDialog] = useState<QrData | null>(null);
  const [form, setForm] = useState({ number: 1, name: "" });

  const token = typeof window !== "undefined" ? localStorage.getItem("admin-token") || "" : "";

  const fetchData = async () => {
    const res = await api.get<ApiResponse<TableAdmin[]>>("/api/admin/tables", { token });
    setTables(res.data);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    try {
      await api.post("/api/admin/tables", { number: form.number, name: form.name || undefined }, { token });
      toast.success("Meja ditambahkan");
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menambah meja");
    }
  };

  const handleRegenerate = async (id: string) => {
    if (!confirm("Regenerate token? QR lama akan tidak berlaku dan harus dicetak ulang.")) return;
    try {
      await api.post(`/api/admin/tables/${id}/regenerate`, {}, { token });
      toast.success("Token di-regenerate. Cetak ulang QR.");
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal regenerate");
    }
  };

  const showQr = async (id: string) => {
    try {
      const res = await api.get<ApiResponse<QrData>>(`/api/admin/tables/${id}/qr`, { token });
      setQrDialog(res.data);
    } catch (err) {
      toast.error("Gagal generate QR");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Meja & QR Code</h2>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Tambah Meja
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Meja</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nomor Meja</Label>
                <Input type="number" value={form.number} onChange={(e) => setForm({ ...form, number: Number(e.target.value) })} className="mt-1" />
              </div>
              <div>
                <Label>Nama (opsional)</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" placeholder="Meja VIP 1" />
              </div>
              <Button className="w-full" onClick={handleCreate}>Simpan</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tables.map((table) => (
          <Card key={table.id}>
            <CardContent className="p-4">
              <div className="mb-3">
                <p className="text-lg font-bold">{table.name || `Meja ${table.number}`}</p>
                <p className="text-xs font-mono text-muted-foreground">Token: ...{table.token.slice(-8)}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1" onClick={() => showQr(table.id)}>
                  <QrCode className="h-3 w-3" />
                  QR
                </Button>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => handleRegenerate(table.id)}>
                  <RefreshCw className="h-3 w-3" />
                  Regenerate
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* QR Dialog */}
      <Dialog open={!!qrDialog} onOpenChange={() => setQrDialog(null)}>
        <DialogContent className="text-center">
          <DialogHeader>
            <DialogTitle>{qrDialog?.tableName || `Meja ${qrDialog?.tableNumber}`}</DialogTitle>
          </DialogHeader>
          {qrDialog && (
            <div className="space-y-3">
              <img src={qrDialog.qrDataUrl} alt="QR Code" className="mx-auto h-64 w-64" />
              <p className="break-all text-xs text-muted-foreground">{qrDialog.url}</p>
              <Button onClick={() => window.print()}>Cetak QR</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
