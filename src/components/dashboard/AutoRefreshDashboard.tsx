"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

const REFRESH_EVERY_MS = 10000;
const MIN_GAP_MS = 2500;

export function AutoRefreshDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const lastRefreshRef = useRef(0);

  const refreshSafe = useCallback(() => {
    const now = Date.now();
    if (now - lastRefreshRef.current < MIN_GAP_MS) return;
    lastRefreshRef.current = now;
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!pathname?.startsWith("/dashboard")) return;

    const onFocus = () => refreshSafe();
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshSafe();
    };
    const onOnline = () => refreshSafe();

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      refreshSafe();
    }, REFRESH_EVERY_MS);

    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname, refreshSafe]);

  return null;
}
