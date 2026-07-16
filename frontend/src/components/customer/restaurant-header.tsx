"use client";

import Image from "next/image";
import { MapPin, Clock, Sparkles, UtensilsCrossed } from "lucide-react";
import { resolveImageUrl } from "@/lib/api";
import { useOperatingStatus } from "@/hooks/use-operating-status";
import type { RestaurantProfile } from "@/types";

export function RestaurantHeader({ profile }: { profile: RestaurantProfile | null }) {
  const status = useOperatingStatus();
  return (
    <header className="relative w-full overflow-hidden">
      {/* Banner / Hero */}
      <div className="relative h-52 w-full sm:h-64 md:h-80 lg:h-96">
        {profile?.bannerUrl ? (
          <Image
            src={resolveImageUrl(profile.bannerUrl)}
            alt={profile?.name || "Restaurant"}
            fill
            className="object-cover"
            priority
            unoptimized
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary via-primary/85 to-emerald-700" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />

        {/* Sparkle badge — desktop */}
        <div className="absolute right-4 top-4 hidden items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md sm:flex">
          <Sparkles className="h-3.5 w-3.5" />
          Self-order
        </div>

        {/* Overlay content */}
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-6xl p-4 sm:p-6 md:p-8">
            <div className="flex items-end gap-3 sm:gap-4">
              {profile?.logoUrl ? (
                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl border-2 border-white/80 shadow-2xl sm:h-20 sm:w-20 md:h-24 md:w-24">
                  <Image
                    src={resolveImageUrl(profile.logoUrl)}
                    alt={profile?.name || ""}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl border-2 border-white/40 bg-white/20 shadow-2xl backdrop-blur-md sm:h-20 sm:w-20 md:h-24 md:w-24">
                  <UtensilsCrossed className="h-8 w-8 text-white/70 sm:h-10 sm:w-10 md:h-12 md:w-12" />
                </div>
              )}
              <div className="min-w-0 flex-1 pb-1">
                <h1 className="truncate text-2xl font-bold text-white drop-shadow-lg sm:text-3xl md:text-4xl lg:text-5xl">
                  {profile?.name || "Rumah Makan"}
                </h1>
                {profile?.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-white/90 sm:text-base md:mt-1.5 md:text-lg">
                    {profile.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info bar */}
      {(profile?.address || true) && (
        <div className="border-b bg-card/60 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 text-xs text-muted-foreground sm:px-6 sm:text-sm md:px-8">
            {profile?.address && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span className="line-clamp-1">{profile.address}</span>
              </span>
            )}
            {!status.loading && (
              <span className="flex items-center gap-1.5">
                <Clock className={`h-3.5 w-3.5 ${status.isOpen ? "text-primary" : "text-destructive"}`} />
                <span className="flex items-center gap-1">
                  <span className="relative flex h-1.5 w-1.5">
                    {status.isOpen && (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                    )}
                    <span
                      className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                        status.isOpen ? "bg-green-500" : "bg-destructive"
                      }`}
                    />
                  </span>
                  {status.isOpen ? status.message : status.message || "Tutup"}
                </span>
              </span>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
