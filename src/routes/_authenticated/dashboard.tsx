import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckSquare, Lightbulb, Flame, TrendingUp, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { bnRelative, urgencyLevel } from "@/lib/format";

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

function Dashboard() {
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

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  const pendingTasks = data!.tasks.filter((t) => t.status !== "done");
  const doneToday = data!.tasks.filter((t) => t.completed_at && new Date(t.completed_at).toDateString() === new Date().toDateString()).length;
  const avgPlan = data!.plans.length ? Math.round(data!.plans.reduce((a, p) => a + (p.progress ?? 0), 0) / data!.plans.length) : 0;

  const stats = [
    { label: "Active tasks", value: pendingTasks.length, icon: CheckSquare, grad: "gradient-primary", to: "/tasks" },
    { label: "Done today", value: doneToday, icon: TrendingUp, grad: "gradient-cool", to: "/tasks" },
    { label: "Ideas", value: data!.ideasCount, icon: Lightbulb, grad: "gradient-warm", to: "/ideas" },
    { label: "Challenges", value: data!.challenges.length, icon: Flame, grad: "gradient-primary", to: "/challenges" },
  ] as const;

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
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Today's tasks</h2>
            <Link to="/tasks" className="text-sm text-primary">View all →</Link>
          </div>
          {pendingTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending tasks 🎉</p>
          ) : (
            <ul className="space-y-2">
              {pendingTasks.slice(0, 5).map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{t.title}</div>
                    {t.due_date && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Clock className="h-3 w-3"/>{bnRelative(t.due_date)}</div>}
                  </div>
                  <span className={`text-xs rounded-full px-2 py-0.5 ${t.priority === "high" ? "bg-destructive/20 text-destructive" : t.priority === "medium" ? "bg-warning/20 text-warning" : "bg-info/20 text-info"}`}>
                    {t.priority === "high" ? "High" : t.priority === "medium" ? "Medium" : "Low"}
                  </span>
                </li>
              ))}
            </ul>
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
