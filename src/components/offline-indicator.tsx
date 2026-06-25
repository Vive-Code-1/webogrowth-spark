import { useOfflineSync } from "@/hooks/use-offline-sync";

/**
 * Floating badge that surfaces offline state and the pending sync queue size.
 * Renders nothing when online and queue is empty.
 */
export function OfflineIndicator() {
  const { offline, pending } = useOfflineSync();

  if (!offline && pending === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-slate-900/90 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-md">
      {offline ? (
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          Offline — {pending > 0 ? `${pending} change${pending > 1 ? "s" : ""} queued` : "changes will sync when back online"}
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
          Syncing {pending} change{pending > 1 ? "s" : ""}…
        </span>
      )}
    </div>
  );
}
