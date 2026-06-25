// Offline write queue for Supabase mutations.
// Persists to localStorage; auto-flushes when the browser reconnects.

import { supabase } from "@/integrations/supabase/client";

const KEY = "wg.offline-queue.v1";

export type QueuedOp =
  | { id: string; kind: "idea.toggle"; entityId: string; done: boolean; title?: string; ts: number }
  | { id: string; kind: "challenge.toggle"; entityId: string; done: boolean; title?: string; ts: number }
  | { id: string; kind: "task.toggle"; entityIds: string[]; done: boolean; ts: number }
  | { id: string; kind: "task.update"; entityId: string; patch: Record<string, any>; ts: number }
  | { id: string; kind: "idea.create"; userId: string; title: string; ts: number }
  | { id: string; kind: "work_session.create"; row: Record<string, any>; ts: number }
  | { id: string; kind: "transaction.create"; row: Record<string, any>; ts: number };

type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;
export type NewOp = DistributiveOmit<QueuedOp, "id" | "ts">;

function read(): QueuedOp[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as QueuedOp[]; } catch { return []; }
}
function write(ops: QueuedOp[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(ops));
  // Broadcast so any listener (status badge, hook) can refresh count.
  try { window.dispatchEvent(new CustomEvent("wg:queue-changed", { detail: { size: ops.length } })); } catch {}
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

function isNetworkError(e: unknown) {
  const msg = String((e as any)?.message ?? "");
  return isOffline() || /Failed to fetch|NetworkError|Load failed|ECONN|ETIMEDOUT|timeout/i.test(msg);
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
    return;
  }
  if (op.kind === "task.toggle") {
    const { error } = await supabase.from("tasks")
      .update({ status: op.done ? "done" : "pending", completed_at: op.done ? new Date().toISOString() : null })
      .in("id", op.entityIds);
    if (error) throw error;
    return;
  }
  if (op.kind === "task.update") {
    const { error } = await supabase.from("tasks").update(op.patch as any).eq("id", op.entityId);
    if (error) throw error;
    return;
  }
  if (op.kind === "idea.create") {
    const { error } = await supabase.from("ideas").insert({ user_id: op.userId, title: op.title });
    if (error) throw error;
    return;
  }
  if (op.kind === "work_session.create") {
    const { error } = await supabase.from("work_sessions").insert(op.row as any);
    if (error) throw error;
    return;
  }
  if (op.kind === "transaction.create") {
    const { error } = await supabase.from("transactions").insert(op.row as any);
    if (error) throw error;
    return;
  }
}

let flushing = false;
export async function flushQueue(onChange?: () => void): Promise<{ ok: number; failed: number }> {
  if (flushing) return { ok: 0, failed: 0 };
  flushing = true;
  let ok = 0, failed = 0;
  try {
    const ops = read();
    const remaining: QueuedOp[] = [];
    for (const op of ops) {
      try { await runOp(op); ok++; }
      catch (e) {
        // Only retry transient network errors; permanent errors (RLS, validation) drop after one try
        if (isNetworkError(e)) { failed++; remaining.push(op); }
        else { failed++; /* discard to avoid infinite loop */ }
      }
    }
    write(remaining);
    onChange?.();
  } finally { flushing = false; }
  return { ok, failed };
}

/** Run op now if online, otherwise queue. Returns whether it was queued. */
export async function runOrQueue(op: NewOp): Promise<{ queued: boolean }> {
  if (isOffline()) {
    enqueue(op);
    return { queued: true };
  }
  try {
    await runOp({ id: "live", ts: Date.now(), ...op } as QueuedOp);
    return { queued: false };
  } catch (e) {
    if (isNetworkError(e)) {
      enqueue(op);
      return { queued: true };
    }
    throw e;
  }
}
