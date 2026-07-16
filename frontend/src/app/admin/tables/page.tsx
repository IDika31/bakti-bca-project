"use client";

import { useEffect, useState } from "react";
import { Plus, QrCode, RefreshCw, Pencil, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
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

interface RestaurantProfile {
  name: string;
  description: string | null;
  logoUrl: string | null;
}

type FormState = { number: number; name: string };

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c] as string));
}

export default function AdminTablesPage() {
  const [tables, setTables] = useState<TableAdmin[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrDialog, setQrDialog] = useState<QrData | null>(null);
  const [editing, setEditing] = useState<TableAdmin | null>(null);
  const [form, setForm] = useState<FormState>({ number: 1, name: "" });
  const [profile, setProfile] = useState<RestaurantProfile | null>(null);

  const regenDialog = useConfirmDialog();
  const [regenId, setRegenId] = useState<string | null>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("admin-token") || "" : "";

  const fetchData = async () => {
    const res = await api.get<ApiResponse<TableAdmin[]>>("/api/admin/tables", { token });
    setTables(res.data);
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    api.get<ApiResponse<RestaurantProfile>>("/api/restaurant")
      .then((r) => setProfile(r.data))
      .catch(() => setProfile(null));
  }, []);

  const openCreate = () => {
    const nextNumber = tables.length
      ? Math.max(...tables.map((t) => t.number)) + 1
      : 1;
    setEditing(null);
    setForm({ number: nextNumber, name: "" });
    setDialogOpen(true);
  };

  const openEdit = (table: TableAdmin) => {
    setEditing(table);
    setForm({ number: table.number, name: table.name || "" });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (editing) {
        await api.put(
          `/api/admin/tables/${editing.id}`,
          { number: form.number, name: form.name || undefined },
          { token }
        );
        toast.success("Meja diperbarui");
      } else {
        await api.post(
          "/api/admin/tables",
          { number: form.number, name: form.name || undefined },
          { token }
        );
        toast.success("Meja ditambahkan");
      }
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan meja");
    }
  };

  const toggleActive = async (t: TableAdmin, isActive: boolean) => {
    setTables((prev) => prev.map((row) => (row.id === t.id ? { ...row, isActive } : row)));
    try {
      await api.patch(`/api/admin/tables/${t.id}`, { isActive }, { token });
      toast.success(isActive ? "Meja diaktifkan" : "Meja dinonaktifkan");
    } catch (err) {
      setTables((prev) => prev.map((row) => (row.id === t.id ? { ...row, isActive: !isActive } : row)));
      toast.error(err instanceof Error ? err.message : "Gagal mengubah status");
    }
  };

  const handleRegenerate = async (id: string) => {
    setRegenId(id);
    const ok = await regenDialog.confirm();
    setRegenId(null);
    if (!ok) return;
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
    } catch {
      toast.error("Gagal generate QR");
    }
  };

  const printQr = (size: "A4" | "A6") => {
    if (!qrDialog) return;
    const w = window.open("", "_blank", "width=800,height=1000");
    if (!w) {
      toast.error("Popup diblokir. Izinkan popup untuk mencetak.");
      return;
    }
    const label = qrDialog.tableName || `Meja ${qrDialog.tableNumber}`;
    const restaurantName = profile?.name || "Silakan Scan";
    const logoImg = profile?.logoUrl
      ? `<img src="${escapeHtml(profile.logoUrl)}" alt="logo" style="max-height:60px;max-width:180px;object-fit:contain;margin-bottom:8px" />`
      : "";
    const isA4 = size === "A4";
    const pageSize = isA4 ? "A4" : "A6";
    const qrSize = isA4 ? "380px" : "220px";
    const tableFont = isA4 ? "72px" : "44px";
    const restFont = isA4 ? "24px" : "16px";
    const pad = isA4 ? "48px" : "16px";

    w.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>QR ${escapeHtml(label)}</title>
<style>
  @page { size: ${pageSize}; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111; }
  .sheet { width: 100%; min-height: 100vh; box-sizing: border-box; padding: ${pad}; display: flex; align-items: center; justify-content: center; }
  .card { width: 100%; max-width: ${isA4 ? "600px" : "100%"}; text-align: center; border: 2px solid #111; border-radius: 16px; padding: ${isA4 ? "32px" : "18px"}; }
  .brand { font-size: ${restFont}; font-weight: 700; letter-spacing: 0.02em; margin-bottom: ${isA4 ? "8px" : "4px"}; }
  .desc { font-size: ${isA4 ? "13px" : "10px"}; color: #555; margin-bottom: ${isA4 ? "20px" : "10px"}; }
  .divider { width: 40px; height: 3px; background: #111; margin: 0 auto ${isA4 ? "20px" : "10px"}; border-radius: 2px; }
  .table-label { font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
  .table-name { font-size: ${tableFont}; font-weight: 900; line-height: 1; margin-bottom: ${isA4 ? "24px" : "12px"}; }
  .qr-wrap { display: inline-block; padding: ${isA4 ? "12px" : "6px"}; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; }
  .qr-wrap img { display: block; width: ${qrSize}; height: ${qrSize}; }
  .instr { margin-top: ${isA4 ? "24px" : "12px"}; text-align: left; font-size: ${isA4 ? "13px" : "10px"}; color: #374151; }
  .instr ol { margin: 8px 0 0; padding-left: 20px; }
  .instr li { margin-bottom: 4px; }
  .footer { margin-top: ${isA4 ? "20px" : "10px"}; font-size: ${isA4 ? "11px" : "8px"}; color: #9ca3af; word-break: break-all; }
  @media print { .noprint { display: none; } }
</style>
</head>
<body>
<div class="sheet">
  <div class="card">
    ${logoImg}
    <div class="brand">${escapeHtml(restaurantName)}</div>
    ${profile?.description ? `<div class="desc">${escapeHtml(profile.description)}</div>` : ""}
    <div class="divider"></div>
    <div class="table-label">Meja</div>
    <div class="table-name">${escapeHtml(label)}</div>
    <div class="qr-wrap"><img src="${qrDialog.qrDataUrl}" alt="QR" /></div>
    <div class="instr">
      <strong>Cara Memesan</strong>
      <ol>
        <li>Buka kamera di ponsel</li>
        <li>Arahkan ke kode QR di atas</li>
        <li>Pilih menu dan pesan langsung</li>
        <li>Bayar di kasir atau via aplikasi</li>
      </ol>
    </div>
    <div class="footer">${escapeHtml(qrDialog.url)}</div>
  </div>
</div>
<script>
  window.onload = function() { setTimeout(function(){ window.print(); }, 250); };
</script>
</body>
</html>`);
    w.document.close();
  };

  const downloadQr = () => {
    if (!qrDialog) return;
    const a = document.createElement("a");
    a.href = qrDialog.qrDataUrl;
    const label = qrDialog.tableName?.replace(/\s+/g, "-").toLowerCase() || `meja-${qrDialog.tableNumber}`;
    a.download = `qr-${label}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Meja & QR Code</h2>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Tambah Meja
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tables.map((table) => (
          <Card key={table.id} className={table.isActive ? "" : "opacity-70"}>
            <CardContent className="p-4">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-bold truncate">
                      {table.name || `Meja ${table.number}`}
                    </p>
                    <Badge variant={table.isActive ? "default" : "secondary"} className="text-[10px]">
                      {table.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground">
                    Token: ...{table.token.slice(-8)}
                  </p>
                </div>
                <Switch
                  checked={table.isActive}
                  onCheckedChange={(v) => toggleActive(table, v)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-1" onClick={() => showQr(table.id)}>
                  <QrCode className="h-3 w-3" />
                  QR
                </Button>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => openEdit(table)}>
                  <Pencil className="h-3 w-3" />
                  Edit
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Meja" : "Tambah Meja"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nomor Meja</Label>
              <Input
                type="number"
                min={1}
                value={form.number}
                onChange={(e) => setForm({ ...form, number: Number(e.target.value) })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Nama (opsional)</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1"
                placeholder="Meja VIP 1"
              />
            </div>
            <Button className="w-full" onClick={handleSubmit}>
              {editing ? "Simpan Perubahan" : "Simpan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!qrDialog} onOpenChange={() => setQrDialog(null)}>
        <DialogContent className="text-center">
          <DialogHeader>
            <DialogTitle>{qrDialog?.tableName || `Meja ${qrDialog?.tableNumber}`}</DialogTitle>
          </DialogHeader>
          {qrDialog && (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDialog.qrDataUrl} alt="QR Code" className="mx-auto h-64 w-64" />
              <p className="break-all text-xs text-muted-foreground">{qrDialog.url}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={downloadQr} className="gap-2">
                  <Download className="h-4 w-4" />
                  Download PNG
                </Button>
                <Button variant="outline" onClick={() => printQr("A6")} className="gap-2">
                  <Printer className="h-4 w-4" />
                  Cetak A6
                </Button>
                <Button onClick={() => printQr("A4")} className="gap-2">
                  <Printer className="h-4 w-4" />
                  Cetak A4
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                A4 untuk stand meja · A6 untuk tempel di meja
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={regenDialog.open}
        onOpenChange={regenDialog.setOpen}
        title="Regenerate Token"
        description="QR lama akan tidak berlaku dan harus dicetak ulang. Lanjutkan?"
        confirmLabel="Regenerate"
        variant="destructive"
        onConfirm={regenDialog.handleConfirm}
      />
    </div>
  );
}
