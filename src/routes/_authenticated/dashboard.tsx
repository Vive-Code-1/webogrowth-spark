import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CheckSquare, Lightbulb, Flame, TrendingUp, Clock, Check, ArrowUpDown, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { bnRelative, urgencyLevel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · WeboGrowth" }] }),
  component: Dashboard,
});

const urgencyClass: Record<string, string> = {
  calm: "bg-info/20 text-info",
  warn: "bg-warning/20 text-warning",
  urgent: "bg-pink/20 text-pink",
  critical: "bg-destructive/20 text-destructive animate-pulse",
};

type Filter = "pending" | "completed" | "all";
type SortDir = "asc" | "desc";

async function updateTaskStatus(ids: string[], done: boolean) {
  const { error } = await supabase
    .from("tasks")
    .update({
      status: done ? "done" : "pending",
      completed_at: done ? new Date().toISOString() : null,
    })
    .in("id", ids);
  if (error) throw error;
}

function Dashboard() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("pending");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [tasks, ideas, plans, challenges] = await Promise.all([
        supabase.from("tasks").select("*").order("due_date", { ascending: true }),
        supabase.from("ideas").select("id").limit(100),
        supabase.from("plans").select("id, progress"),
        supabase.from("challenges").select("*").eq("status", "active").order("deadline", { ascending: true }),
      ]);
      return {
        tasks: tasks.data ?? [],
        ideasCount: ideas.data?.length ?? 0,
        plans: plans.data ?? [],
        challenges: challenges.data ?? [],
      };
    },
  });

  const toggle = useMutation({
    mutationFn: ({ ids, done }: { ids: string[]; done: boolean }) => updateTaskStatus(ids, done),
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      const n = vars.ids.length;
      if (vars.done) {
        toast.success(n > 1 ? `${n} tasks completed 🎉` : "Task completed 🎉", {
          action: {
            label: "Undo",
            onClick: () => toggle.mutate({ ids: vars.ids, done: false }),
          },
        });
      } else {
        toast.success(n > 1 ? `${n} tasks moved to pending` : "Task moved to pending");
      }
    },
    onError: (e: any, vars) => {
      toast.error(`Sync failed: ${e?.message ?? "unknown error"}`, {
        action: { label: "Retry", onClick: () => toggle.mutate(vars) },
        duration: 8000,
      });
    },
  });

  const visibleTasks = useMemo(() => {
    const all = data?.tasks ?? [];
    const filtered = all.filter((t) =>
      filter === "all" ? true : filter === "completed" ? t.status === "done" : t.status !== "done",
    );
    const sorted = [...filtered].sort((a, b) => {
      const av = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
      const bv = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return sorted.slice(0, 8);
  }, [data?.tasks, filter, sortDir]);

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  const pendingCount = data!.tasks.filter((t) => t.status !== "done").length;
  const doneToday = data!.tasks.filter((t) => t.completed_at && new Date(t.completed_at).toDateString() === new Date().toDateString()).length;
  const avgPlan = data!.plans.length ? Math.round(data!.plans.reduce((a, p) => a + (p.progress ?? 0), 0) / data!.plans.length) : 0;

  const stats = [
    { label: "Active tasks", value: pendingCount, icon: CheckSquare, grad: "gradient-primary", to: "/tasks" },
    { label: "Done today", value: doneToday, icon: TrendingUp, grad: "gradient-cool", to: "/tasks" },
    { label: "Ideas", value: data!.ideasCount, icon: Lightbulb, grad: "gradient-warm", to: "/ideas" },
    { label: "Challenges", value: data!.challenges.length, icon: Flame, grad: "gradient-primary", to: "/challenges" },
  ] as const;

  const visibleIds = visibleTasks.map((t) => t.id);
  const selectedVisible = visibleIds.filter((id) => selected.has(id));
  const allSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
  const someSelected = selectedVisible.length > 0 && !allSelected;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(visibleIds));
  };
  const runBulk = (done: boolean) => {
    if (selectedVisible.length === 0) return;
    toggle.mutate({ ids: selectedVisible, done });
    setSelected(new Set());
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Welcome 👋</h1>
        <p className="text-muted-foreground mt-1">Kick off today's growth mission.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="glass rounded-2xl p-5 transition hover:scale-[1.02]">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-3xl font-bold">{s.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
              </div>
              <div className={`grid h-10 w-10 place-items-center rounded-xl ${s.grad}`}>
                <s.icon className="h-5 w-5 text-white" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass rounded-2xl p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Today's tasks</h2>
            <Link to="/tasks" className="text-sm text-primary">View all →</Link>
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Tabs value={filter} onValueChange={(v) => { setFilter(v as Filter); setSelected(new Set()); }}>
              <TabsList className="h-8">
                <TabsTrigger value="pending" className="text-xs">Pending</TabsTrigger>
                <TabsTrigger value="completed" className="text-xs">Completed</TabsTrigger>
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              className="h-8 gap-1 text-xs"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Due {sortDir === "asc" ? "earliest" : "latest"}
            </Button>
          </div>

          {visibleTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {filter === "completed" ? "Nothing completed yet." : filter === "pending" ? "No pending tasks 🎉" : "No tasks."}
            </p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                  {selectedVisible.length > 0
                    ? `${selectedVisible.length} selected`
                    : "Select all"}
                </label>
                {selectedVisible.length > 0 && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => runBulk(true)}
                      disabled={toggle.isPending}
                      className="h-7 gap-1 gradient-cool text-white text-xs"
                    >
                      <Check className="h-3.5 w-3.5" /> Complete
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runBulk(false)}
                      disabled={toggle.isPending}
                      className="h-7 gap-1 text-xs"
                    >
                      <Undo2 className="h-3.5 w-3.5" /> Reopen
                    </Button>
                  </div>
                )}
              </div>

              <ul className="space-y-2">
                {visibleTasks.map((t) => {
                  const done = t.status === "done";
                  const isSel = selected.has(t.id);
                  return (
                    <li
                      key={t.id}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${isSel ? "bg-primary/10 ring-1 ring-primary/40" : "bg-muted/50"}`}
                    >
                      <Checkbox
                        checked={isSel}
                        onCheckedChange={() => toggleSelect(t.id)}
                        aria-label="Select task"
                      />
                      <button
                        onClick={() => toggle.mutate({ ids: [t.id], done: !done })}
                        disabled={toggle.isPending}
                        aria-label={done ? "Mark pending" : "Mark complete"}
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition ${
                          done
                            ? "bg-success border-success"
                            : "border-muted-foreground/40 hover:border-success hover:bg-success/20"
                        }`}
                      >
                        {done && <Check className="h-4 w-4 text-background" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className={`truncate font-medium ${done ? "line-through text-muted-foreground" : ""}`}>
                          {t.title}
                        </div>
                        {t.due_date && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {bnRelative(t.due_date)}
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-xs rounded-full px-2 py-0.5 ${
                          t.priority === "high"
                            ? "bg-destructive/20 text-destructive"
                            : t.priority === "medium"
                              ? "bg-warning/20 text-warning"
                              : "bg-info/20 text-info"
                        }`}
                      >
                        {t.priority === "high" ? "High" : t.priority === "medium" ? "Medium" : "Low"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        <section className="glass rounded-2xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Active challenges</h2>
            <Link to="/challenges" className="text-sm text-primary">View all →</Link>
          </div>
          {data!.challenges.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add a new challenge.</p>
          ) : (
            <ul className="space-y-3">
              {data!.challenges.slice(0, 4).map((c) => {
                const u = urgencyLevel(c.deadline);
                return (
                  <li key={c.id} className="rounded-xl bg-muted/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{c.title}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${urgencyClass[u]}`}>{bnRelative(c.deadline)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="glass rounded-2xl p-5 lg:col-span-2">
          <h2 className="font-display text-lg font-semibold">Plan progress</h2>
          <div className="mt-3 flex items-end gap-4">
            <div className="text-5xl font-bold text-gradient">{avgPlan}%</div>
            <div className="flex-1">
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div className="h-full gradient-primary transition-all" style={{ width: `${avgPlan}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Average progress across {data!.plans.length} plan{data!.plans.length === 1 ? "" : "s"}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
