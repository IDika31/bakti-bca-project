"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { api, resolveImageUrl } from "@/lib/api";
import { toast } from "sonner";
import type { ApiResponse } from "@/types";

function ImageField({
  label,
  folder,
  value,
  onChange,
  token,
}: {
  label: string;
  folder: "logo" | "banner";
  value: string;
  onChange: (v: string) => void;
  token: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Harus gambar");
    if (file.size > 5 * 1024 * 1024) return toast.error("Maks 5MB");
    setUploading(true);
    try {
      const res = await api.upload<ApiResponse<{ url: string }>>(
        `/api/admin/upload/${folder}`,
        file,
        { token }
      );
      onChange(res.data.url);
      toast.success("Terunggah");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <Label>{label}</Label>
      {value && (
        <div className="relative mt-1 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveImageUrl(value)}
            alt={label}
            className="h-20 w-32 rounded-md border object-cover"
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute -right-2 -top-2 rounded-full bg-black/70 p-0.5 text-white"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <div className="mt-1 flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://... atau upload"
          className="flex-1"
        />
        <input
          ref={ref}
          type="file"
          accept="image/*"
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
          size="icon"
          disabled={uploading}
          onClick={() => ref.current?.click()}
          title="Upload"
        >
          <Upload className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface Profile {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

interface TaxConfig {
  id: string;
  taxEnabled: boolean;
  taxPercentage: number;
  serviceEnabled: boolean;
  servicePercentage: number;
}

interface OperatingHour {
  id: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

interface TripaySettings {
  id: string;
  mode: string;
  sandboxMerchantCode: string;
  sandboxApiKey: string;
  sandboxPrivateKey: string;
  productionMerchantCode: string;
  productionApiKey: string;
  productionPrivateKey: string;
}

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export default function AdminSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tax, setTax] = useState<TaxConfig | null>(null);
  const [hours, setHours] = useState<OperatingHour[]>([]);
  const [tripay, setTripay] = useState<TripaySettings | null>(null);
  const [loading, setLoading] = useState(true);

  const token = typeof window !== "undefined" ? localStorage.getItem("admin-token") || "" : "";

  useEffect(() => {
    Promise.all([
      api.get<ApiResponse<Profile>>("/api/admin/settings/profile", { token }),
      api.get<ApiResponse<TaxConfig>>("/api/admin/settings/tax", { token }),
      api.get<ApiResponse<OperatingHour[]>>("/api/admin/settings/hours", { token }),
      api.get<ApiResponse<TripaySettings>>("/api/admin/settings/tripay", { token }),
    ]).then(([p, t, h, tr]) => {
      setProfile(p.data);
      setTax(t.data);
      setHours(h.data);
      setTripay(tr.data);
    }).finally(() => setLoading(false));
  }, []);

  const saveProfile = async () => {
    if (!profile) return;
    const { id, ...data } = profile;
    try {
      await api.put("/api/admin/settings/profile", data, { token });
      toast.success("Profil disimpan");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Gagal menyimpan profil"); }
  };

  const saveTax = async () => {
    if (!tax) return;
    const { id, ...data } = tax;
    try {
      await api.put("/api/admin/settings/tax", data, { token });
      toast.success("Pajak & servis disimpan");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Gagal menyimpan"); }
  };

  const saveHours = async () => {
    try {
      const cleaned = hours.map(({ id, ...rest }) => rest);
      await api.put("/api/admin/settings/hours", { hours: cleaned }, { token });
      toast.success("Jam operasional disimpan");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Gagal menyimpan"); }
  };

  const saveTripay = async () => {
    if (!tripay) return;
    if (tripay.mode === "PRODUCTION" && !confirm("Mode PRODUCTION akan memproses pembayaran sungguhan. Lanjutkan?")) return;
    const { id, ...data } = tripay;
    try {
      await api.put("/api/admin/settings/tripay", data, { token });
      toast.success("Konfigurasi Tripay disimpan");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Gagal menyimpan"); }
  };

  if (loading) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Pengaturan</h2>

      <Tabs defaultValue="profile">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="tax">Pajak</TabsTrigger>
          <TabsTrigger value="hours">Jam Buka</TabsTrigger>
          <TabsTrigger value="tripay">Tripay</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader><CardTitle className="text-base">Profil Restoran</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {profile && (
                <>
                  <div>
                    <Label>Nama Restoran</Label>
                    <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label>Deskripsi</Label>
                    <Textarea value={profile.description || ""} onChange={(e) => setProfile({ ...profile, description: e.target.value })} className="mt-1" rows={2} />
                  </div>
                  <div>
                    <Label>Alamat</Label>
                    <Input value={profile.address || ""} onChange={(e) => setProfile({ ...profile, address: e.target.value })} className="mt-1" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Telepon</Label>
                      <Input value={profile.phone || ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className="mt-1" />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input value={profile.email || ""} onChange={(e) => setProfile({ ...profile, email: e.target.value })} className="mt-1" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <ImageField
                      label="Logo"
                      folder="logo"
                      value={profile.logoUrl || ""}
                      onChange={(v) => setProfile({ ...profile, logoUrl: v || null })}
                      token={token}
                    />
                    <ImageField
                      label="Banner"
                      folder="banner"
                      value={profile.bannerUrl || ""}
                      onChange={(v) => setProfile({ ...profile, bannerUrl: v || null })}
                      token={token}
                    />
                  </div>
                  <Button onClick={saveProfile}>Simpan Profil</Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax">
          <Card>
            <CardHeader><CardTitle className="text-base">Pajak & Servis</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {tax && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Pajak (PB1)</p>
                      <p className="text-sm text-muted-foreground">Pajak restoran</p>
                    </div>
                    <Switch checked={tax.taxEnabled} onCheckedChange={(v) => setTax({ ...tax, taxEnabled: v })} />
                  </div>
                  {tax.taxEnabled && (
                    <div>
                      <Label>Persentase Pajak (%)</Label>
                      <Input type="number" value={tax.taxPercentage} onChange={(e) => setTax({ ...tax, taxPercentage: Number(e.target.value) })} className="mt-1 w-32" />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Service Charge</p>
                      <p className="text-sm text-muted-foreground">Biaya layanan</p>
                    </div>
                    <Switch checked={tax.serviceEnabled} onCheckedChange={(v) => setTax({ ...tax, serviceEnabled: v })} />
                  </div>
                  {tax.serviceEnabled && (
                    <div>
                      <Label>Persentase Servis (%)</Label>
                      <Input type="number" value={tax.servicePercentage} onChange={(e) => setTax({ ...tax, servicePercentage: Number(e.target.value) })} className="mt-1 w-32" />
                    </div>
                  )}
                  <Button onClick={saveTax}>Simpan</Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hours">
          <Card>
            <CardHeader><CardTitle className="text-base">Jam Operasional</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {hours.map((h, i) => (
                <div key={h.id} className="flex items-center gap-3">
                  <span className="w-16 text-sm font-medium">{DAY_NAMES[h.dayOfWeek]}</span>
                  <Switch
                    checked={!h.isClosed}
                    onCheckedChange={(open) => {
                      const updated = [...hours];
                      updated[i] = { ...h, isClosed: !open };
                      setHours(updated);
                    }}
                  />
                  {!h.isClosed && (
                    <>
                      <Input
                        type="time"
                        value={h.openTime}
                        onChange={(e) => {
                          const updated = [...hours];
                          updated[i] = { ...h, openTime: e.target.value };
                          setHours(updated);
                        }}
                        className="w-28"
                      />
                      <span className="text-sm">-</span>
                      <Input
                        type="time"
                        value={h.closeTime}
                        onChange={(e) => {
                          const updated = [...hours];
                          updated[i] = { ...h, closeTime: e.target.value };
                          setHours(updated);
                        }}
                        className="w-28"
                      />
                    </>
                  )}
                  {h.isClosed && <span className="text-sm text-muted-foreground">Tutup</span>}
                </div>
              ))}
              <Button onClick={saveHours}>Simpan Jam Operasional</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tripay">
          <Card>
            <CardHeader><CardTitle className="text-base">Konfigurasi Tripay</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {tripay && (
                <>
                  <div>
                    <Label>Mode</Label>
                    <Select value={tripay.mode} onValueChange={(v) => setTripay({ ...tripay, mode: v ?? tripay.mode })}>
                      <SelectTrigger className="mt-1 w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SANDBOX">Sandbox (Testing)</SelectItem>
                        <SelectItem value="PRODUCTION">Production (Live)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3 rounded-lg border p-4">
                    <p className="text-sm font-semibold">Sandbox Credentials</p>
                    <div>
                      <Label>Merchant Code</Label>
                      <Input value={tripay.sandboxMerchantCode} onChange={(e) => setTripay({ ...tripay, sandboxMerchantCode: e.target.value })} className="mt-1" />
                    </div>
                    <div>
                      <Label>API Key</Label>
                      <Input value={tripay.sandboxApiKey} onChange={(e) => setTripay({ ...tripay, sandboxApiKey: e.target.value })} className="mt-1" />
                    </div>
                    <div>
                      <Label>Private Key</Label>
                      <Input value={tripay.sandboxPrivateKey} onChange={(e) => setTripay({ ...tripay, sandboxPrivateKey: e.target.value })} className="mt-1" />
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border p-4">
                    <p className="text-sm font-semibold">Production Credentials</p>
                    <div>
                      <Label>Merchant Code</Label>
                      <Input value={tripay.productionMerchantCode} onChange={(e) => setTripay({ ...tripay, productionMerchantCode: e.target.value })} className="mt-1" />
                    </div>
                    <div>
                      <Label>API Key</Label>
                      <Input value={tripay.productionApiKey} onChange={(e) => setTripay({ ...tripay, productionApiKey: e.target.value })} className="mt-1" />
                    </div>
                    <div>
                      <Label>Private Key</Label>
                      <Input value={tripay.productionPrivateKey} onChange={(e) => setTripay({ ...tripay, productionPrivateKey: e.target.value })} className="mt-1" />
                    </div>
                  </div>

                  <Button onClick={saveTripay}>Simpan Konfigurasi Tripay</Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
