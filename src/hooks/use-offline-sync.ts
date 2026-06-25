import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { flushQueue, isOffline, queueSize } from "@/lib/offline-queue";

/**
 * Global offline sync engine. Mount once near the root.
 * - Listens to online/offline browser events
 * - Re-tries on window focus and every 30s while queue non-empty
 * - Invalidates queries after a successful flush
 */
export function useOfflineSync() {
  const qc = useQueryClient();
  const [offline, setOffline] = useState<boolean>(isOffline());
  const [pending, setPending] = useState<number>(queueSize());

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const refreshCount = () => setPending(queueSize());

    const attemptFlush = async (reason: "online" | "focus" | "interval" | "mount") => {
      refreshCount();
      setOffline(isOffline());
      if (isOffline()) return;
      if (queueSize() === 0) return;
      const r = await flushQueue(refreshCount);
      refreshCount();
      if (r.ok > 0) {
        toast.success(`Synced ${r.ok} change${r.ok > 1 ? "s" : ""} ✓`);
        // Invalidate everything — cheap and ensures every screen reflects synced data
        qc.invalidateQueries();
      }
      if (r.failed > 0 && reason !== "interval") {
        toast.message(`${r.failed} change${r.failed > 1 ? "s" : ""} still pending — will retry`);
      }
    };

    const onOnline = () => { setOffline(false); attemptFlush("online"); };
    const onOffline = () => setOffline(true);
    const onFocus = () => attemptFlush("focus");
    const onQueueChanged = (e: Event) => {
      const size = (e as CustomEvent).detail?.size ?? queueSize();
      setPending(size);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("focus", onFocus);
    window.addEventListener("wg:queue-changed", onQueueChanged as EventListener);

    // Retry every 30s while there are pending ops
    interval = setInterval(() => { if (queueSize() > 0) attemptFlush("interval"); }, 30_000);

    // Initial attempt
    attemptFlush("mount");

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("wg:queue-changed", onQueueChanged as EventListener);
      if (interval) clearInterval(interval);
    };
  }, [qc]);

  return { offline, pending };
}
