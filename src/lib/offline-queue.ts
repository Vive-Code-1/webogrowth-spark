// Tiny offline queue for Supabase toggle ops on ideas & challenges.
// Persists to localStorage; flushes when the browser comes back online.

import { supabase } from "@/integrations/supabase/client";

const KEY = "wg.offline-queue.v1";

export type QueuedOp =
  | { id: string; kind: "idea.toggle"; entityId: string; done: boolean; title?: string; ts: number }
  | { id: string; kind: "challenge.toggle"; entityId: string; done: boolean; title?: string; ts: number };

function read(): QueuedOp[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as QueuedOp[]; } catch { return []; }
}
function write(ops: QueuedOp[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(ops));
}

export function enqueue(op: Omit<QueuedOp, "id" | "ts"> & Partial<Pick<QueuedOp, "id" | "ts">>) {
  const full = { id: crypto.randomUUID(), ts: Date.now(), ...op } as QueuedOp;
  write([...read(), full]);
  return full;
}

export function queueSize() { return read().length; }

export function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

async function runOp(op: QueuedOp): Promise<void> {
  if (op.kind === "idea.toggle") {
    const { error } = await supabase.from("ideas")
      .update({ status: op.done ? "converted" : "new" })
      .eq("id", op.entityId);
    if (error) throw error;
    return;
  }
  if (op.kind === "challenge.toggle") {
    const { data: u } = await supabase.auth.getUser();
    const { data: existing } = await supabase.from("challenges").select("status,title").eq("id", op.entityId).maybeSingle();
    const fromState = existing?.status ?? null;
    const toState = op.done ? "completed" : "active";
    const { error } = await supabase.from("challenges")
      .update({ status: toState })
      .eq("id", op.entityId);
    if (error) throw error;
    if (u.user && fromState !== toState) {
      await supabase.from("activity_log").insert({
        user_id: u.user.id,
        entity_type: "challenge",
        entity_id: op.entityId,
        action: op.done ? "complete" : "reopen",
        from_state: fromState,
        to_state: toState,
        title: op.title ?? existing?.title ?? null,
      });
    }
  }
}

let flushing = false;
export async function flushQueue(onChange?: () => void): Promise<{ ok: number; failed: number }> {
  if (flushing) return { ok: 0, failed: 0 };
  flushing = true;
  let ok = 0, failed = 0;
  try {
    let ops = read();
    const remaining: QueuedOp[] = [];
    for (const op of ops) {
      try { await runOp(op); ok++; }
      catch { failed++; remaining.push(op); }
    }
    write(remaining);
    onChange?.();
  } finally { flushing = false; }
  return { ok, failed };
}

/** Run op now if online, otherwise queue. Returns whether it was queued. */
export async function runOrQueue(op: Omit<QueuedOp, "id" | "ts">): Promise<{ queued: boolean }> {
  if (isOffline()) {
    enqueue(op);
    return { queued: true };
  }
  try {
    await runOp({ id: "live", ts: Date.now(), ...op } as QueuedOp);
    return { queued: false };
  } catch (e) {
    // Network-ish failure → queue and rethrow non-network errors
    if (isOffline() || /Failed to fetch|NetworkError|Load failed/i.test(String((e as any)?.message ?? ""))) {
      enqueue(op);
      return { queued: true };
    }
    throw e;
  }
}
