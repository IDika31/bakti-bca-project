"use client";

import Image from "next/image";
import type { RestaurantProfile } from "@/types";

export function RestaurantHeader({ profile }: { profile: RestaurantProfile | null }) {
  if (!profile) return null;

  return (
    <header className="w-full">
      {profile.bannerUrl && (
        <div className="relative h-40 w-full overflow-hidden sm:h-52">
          <Image
            src={profile.bannerUrl}
            alt={profile.name}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      )}
      <div className="flex items-center gap-3 px-4 py-3">
        {profile.logoUrl && (
          <Image
            src={profile.logoUrl}
            alt={profile.name}
            width={48}
            height={48}
            className="rounded-full border-2 border-white shadow"
          />
        )}
        <div>
          <h1 className="text-xl font-bold">{profile.name}</h1>
          {profile.description && (
            <p className="text-sm text-muted-foreground">{profile.description}</p>
          )}
        </div>
      </div>
    </header>
  );
}
