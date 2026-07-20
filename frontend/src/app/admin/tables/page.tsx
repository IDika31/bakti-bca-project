"use client";

import { useEffect, useState } from "react";
import { Plus, QrCode, RefreshCw, Pencil, Download, Printer, Loader2 } from "lucide-react";
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

// HTML entity map for safe interpolation into the print HTML. We use
// fromCharCode so the source stays pure ASCII and avoids any tool mangling.
const HTML_ENTITIES: Record<string, string> = {
  "&": String.fromCharCode(38),
  "<": String.fromCharCode(60),
  ">": String.fromCharCode(62),
  "\"": String.fromCharCode(34),
  "'": String.fromCharCode(39),
};
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ENTITIES[c] ?? c);
}

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

export default function AdminTablesPage() {
  const [tables, setTables] = useState<TableAdmin[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrDialog, setQrDialog] = useState<QrData | null>(null);
  const [editing, setEditing] = useState<TableAdmin | null>(null);
  const [form, setForm] = useState<FormState>({ number: 1, name: "" });
  const [profile, setProfile] = useState<RestaurantProfile | null>(null);
  const [printingAll, setPrintingAll] = useState<"A4" | "A6" | null>(null);

  const regenDialog = useConfirmDialog();
  const [regenId, setRegenId] = useState<string | null>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("admin-token") || "" : "";

  // api.get returns the raw { success, data } envelope, so read .data.
  const fetchData = async () => {
    const res = await api.get<ApiResponse<TableAdmin[]>>("/api/admin/tables", { token });
    setTables(Array.isArray(res?.data) ? res.data : []);
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    api.get<ApiResponse<RestaurantProfile>>("/api/restaurant", { token })
      .then((r) => setProfile(r?.data ?? null))
      .catch(() => setProfile(null));
  }, [token]);

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
      setQrDialog(res?.data ?? null);
    } catch {
      toast.error("Gagal generate QR");
    }
  };

  // Fetch QR data for every existing table (used by the Print All buttons).
  const fetchAllQrs = async (): Promise<QrData[]> => {
    const results = await Promise.all(
      tables.map((t) =>
        api
          .get<ApiResponse<QrData>>(`/api/admin/tables/${t.id}/qr`, { token })
          .then((r) => r?.data ?? null)
          .catch(() => null)
      )
    );
    return results.filter((r): r is QrData => r !== null && !!r.qrDataUrl);
  };

  const labelOf = (q: QrData) => q.tableName || `Meja ${q.tableNumber}`;

  // Render one QR card. Each card is titled with its own table name so a
  // printed sheet with multiple codes is self-identifying.
  const renderQrCard = (q: QrData, size: "A4" | "A6"): string => {
    const label = labelOf(q);
    const restaurantName = profile?.name || "Silakan Scan";
    const logoImg = profile?.logoUrl
      ? `<img src="${escapeHtml(profile.logoUrl)}" alt="logo" style="max-height:48px;max-width:160px;object-fit:contain;margin-bottom:6px" />`
      : "";
    const isA4 = size === "A4";
    const qrSize = isA4 ? "150px" : "220px";
    const tableFont = isA4 ? "34px" : "44px";
    const restFont = isA4 ? "15px" : "16px";
    const pad = isA4 ? "12px" : "16px";

    return `<div class="card">
    ${logoImg}
    <div class="brand">${escapeHtml(restaurantName)}</div>
    <div class="divider"></div>
    <div class="table-label">Meja</div>
    <div class="table-name" style="font-size:${tableFont};padding:${pad}">${escapeHtml(label)}</div>
    <div class="qr-wrap"><img src="${q.qrDataUrl}" alt="QR" style="width:${qrSize};height:${qrSize}" /></div>
    <div class="instr">
      <strong>Cara Memesan</strong>
      <ol>
        <li>Buka kamera di ponsel</li>
        <li>Arahkan ke kode QR di atas</li>
        <li>Pilih menu dan pesan langsung</li>
        <li>Bayar di kasir atau via aplikasi</li>
      </ol>
    </div>
    <div class="footer">${escapeHtml(q.url)}</div>
  </div>`;
  };

  // Open a print window containing the given QR cards, paginating them so
  // each physical page is filled before moving to the next. A4 packs 6 cards
  // (3 columns x 2 rows); A6 shows 1 card per page.
  function openPrintWindow(qrs: QrData[], size: "A4" | "A6") {
    if (!qrs.length) {
      toast.error("Tidak ada QR untuk dicetak");
      return;
    }
    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) {
      toast.error("Popup diblokir. Izinkan popup untuk mencetak.");
      return;
    }

    const isA4 = size === "A4";
    const pageSize = isA4 ? "A4" : "A6";
    const cardsPerPage = isA4 ? 6 : 1;

    // Build pages: chunk cards so each page is full before the next.
    const pages: string[] = [];
    for (let i = 0; i < qrs.length; i += cardsPerPage) {
      const chunk = qrs.slice(i, i + cardsPerPage);
      // A6 page heading = the single card's label.
      // A4 page heading = first label + "+N lainnya" when multiple.
      let heading: string;
      if (isA4) {
        const first = labelOf(chunk[0]);
        const extra = chunk.length - 1;
        heading = extra > 0 ? `${escapeHtml(first)} +${extra} lainnya` : escapeHtml(first);
      } else {
        heading = escapeHtml(labelOf(chunk[0]));
      }

      const gridStyle = isA4
        ? "display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);gap:10px;width:100%;height:100%;"
        : "display:flex;align-items:center;justify-content:center;width:100%;height:100%;";
      const cardWrapClass = isA4 ? "card-cell" : "card-single";

      pages.push(`<div class="sheet">
  ${isA4 ? `<div class="page-head">${heading}</div>` : ""}
  <div class="grid" style="${gridStyle}">
    ${chunk
      .map(
        (q) =>
          `<div class="${cardWrapClass}">${renderQrCard(q, size)}</div>`
      )
      .join("")}
  </div>
</div>`);
    }

    const sheetsCss = isA4
      ? `
  .sheet { width: 210mm; height: 297mm; box-sizing: border-box; padding: 10mm; display: flex; flex-direction: column; page-break-after: always; }
  .page-head { font-size: 13px; font-weight: 700; margin-bottom: 6px; color: #111; }
  .card-cell { display: flex; align-items: center; justify-content: center; }
  .card { width: 100%; height: 100%; max-height: 100%; box-sizing: border-box; text-align: center; border: 1.5px solid #111; border-radius: 8px; padding: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; }
  .card .brand { font-size: 13px; font-weight: 700; }
  .card .table-label { font-size: 8px; }
  .card .qr-wrap img { width: 120px; height: 120px; }
  .card .table-name { font-size: 20px; margin: 2px 0; padding: 2px; }
  .card .instr { font-size: 9px; }
  .card .instr ol { margin: 2px 0 0; padding-left: 14px; }
  .card .footer { font-size: 6px; }
  .card .divider { width: 24px; height: 2px; margin: 3px auto; }`
      : `
  .sheet { width: 105mm; height: 148mm; box-sizing: border-box; padding: 6mm; display: flex; flex-direction: column; align-items: center; justify-content: center; page-break-after: always; }
  .card-single { width: 100%; }
  .card { width: 100%; text-align: center; border: 1.5px solid #111; border-radius: 12px; padding: 12px; }
  .card .brand { font-size: 15px; font-weight: 700; }
  .card .qr-wrap img { width: 200px; height: 200px; }
  .card .table-name { font-size: 40px; margin: 6px 0; }
  .card .instr { font-size: 11px; }
  .card .footer { font-size: 8px; }`;

    w.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>QR Meja</title>
<style>
  @page { size: ${pageSize}; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111; }
  ${sheetsCss}
  .brand { font-weight: 700; letter-spacing: 0.02em; }
  .table-label { font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.1em; }
  .qr-wrap { display: inline-block; padding: 6px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; }
  .qr-wrap img { display: block; }
  .instr { text-align: left; }
  .instr ol { margin: 6px 0 0; padding-left: 18px; }
  .instr li { margin-bottom: 3px; }
  .footer { margin-top: 8px; color: #9ca3af; word-break: break-all; }
  .divider { width: 30px; height: 2px; background: #111; margin: 4px auto; border-radius: 2px; }
  .noprint { position: fixed; top: 8px; right: 8px; }
  @media print { .noprint { display: none; } .sheet:last-child { page-break-after: auto; } }
</style>
</head>
<body>
<button class="noprint" onclick="window.print()">Cetak</button>
${pages.join("\n")}
<script>
  window.onload = function() { setTimeout(function(){ window.print(); }, 300); };
</script>
</body>
</html>`);
    w.document.close();
  }

  // Print a single QR (from the QR dialog) in the chosen page size — one
  // card filling the page.
  const printQr = (size: "A4" | "A6") => {
    if (!qrDialog) return;
    openPrintWindow([qrDialog], size);
  };

  // Print every table's QR, filling each page before continuing to the next.
  const printAll = async (size: "A4" | "A6") => {
    if (!tables.length) {
      toast.error("Belum ada meja");
      return;
    }
    setPrintingAll(size);
    try {
      const qrs = await fetchAllQrs();
      if (!qrs.length) {
        toast.error("Gagal mengambil QR");
        return;
      }
      openPrintWindow(qrs, size);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mencetak semua QR");
    } finally {
      setPrintingAll(null);
    }
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

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => printAll("A4")}
          disabled={!!printingAll}
          className="gap-2"
        >
          {printingAll === "A4" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Printer className="h-4 w-4" />
          )}
          Print All A4
        </Button>
        <Button
          variant="outline"
          onClick={() => printAll("A6")}
          disabled={!!printingAll}
          className="gap-2"
        >
          {printingAll === "A6" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Printer className="h-4 w-4" />
          )}
          Print All A6
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
