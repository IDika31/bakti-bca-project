"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { witaClock } from "@/lib/time";
import type { ApiResponse, OperatingHours } from "@/types";

export interface OperatingStatus {
  isOpen: boolean;
  today: OperatingHours | null;
  loading: boolean;
  message: string;
}

const DAY_LABELS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function parseHM(hm: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

function computeStatus(hours: OperatingHours[]): OperatingStatus {
  const clock = witaClock();
  const dow = clock.dayOfWeek;
  const today = hours.find((h) => h.dayOfWeek === dow) ?? null;

  if (!today || today.isClosed) {
    return {
      isOpen: false,
      today,
      loading: false,
      message: `Tutup hari ini (${DAY_LABELS[dow]})`,
    };
  }

  const open = parseHM(today.openTime);
  const close = parseHM(today.closeTime);
  if (!open || !close) {
    return { isOpen: true, today, loading: false, message: "Buka" };
  }

  const nowMin = clock.minutes;
  const openMin = open.h * 60 + open.m;
  const closeMin = close.h * 60 + close.m;
  const overnight = closeMin <= openMin;
  const isOpen = overnight
    ? nowMin >= openMin || nowMin < closeMin
    : nowMin >= openMin && nowMin < closeMin;

  return {
    isOpen,
    today,
    loading: false,
    message: isOpen
      ? `Buka sampai ${today.closeTime}`
      : nowMin < openMin
        ? `Buka pukul ${today.openTime}`
        : `Tutup, buka lagi besok`,
  };
}

export function useOperatingStatus(): OperatingStatus {
  const [hours, setHours] = useState<OperatingHours[] | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    api
      .get<ApiResponse<OperatingHours[]>>("/api/operating-hours")
      .then((res) => setHours(res.data))
      .catch(() => setHours([]));
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (!hours) {
    return { isOpen: true, today: null, loading: true, message: "" };
  }
  return computeStatus(hours);
}
