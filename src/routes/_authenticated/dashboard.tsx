import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Check, Clock, ArrowUpDown, Undo2, Flame, Wallet,
  ArrowRight, CalendarDays, Lightbulb, Save,
} from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon, NoteEditIcon, Notification01Icon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { bnRelative, urgencyLevel } from "@/lib/format";
import { fmtMoney, fmtMins, diffMinutes } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · WeboGrowth" }] }),
  component: Dashboard,
});

type Filter = "pending" | "completed" | "all";
type SortDir = "asc" | "desc";

async function updateTaskStatus(ids: string[], done: boolean) {
  const { error } = await supabase
    .from("tasks")
    .update({ status: done ? "done" : "pending", completed_at: done ? new Date().toISOString() : null })
    .in("id", ids);
  if (error) throw error;
}

function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function isThisMonth(d: string | Date) {
  const x = new Date(d); const n = new Date();
  return x.getFullYear() === n.getFullYear() && x.getMonth() === n.getMonth();
}

function Dashboard() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("pending");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hoursInput, setHoursInput] = useState("");
  const [minsInput, setMinsInput] = useState("");
  const [sessionNote, setSessionNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [tasks, plans, challenges, sessions, txns, target, ideas] = await Promise.all([
        supabase.from("tasks").select("*").order("due_date", { ascending: true }),
        supabase.from("plans").select("id, progress"),
        supabase.from("challenges").select("*").eq("status", "active").order("deadline", { ascending: true }),
        supabase.from("work_sessions").select("*").order("start_time", { ascending: false }),
        supabase.from("transactions").select("*").order("txn_date", { ascending: false }),
        supabase.from("daily_targets").select("*").eq("target_date", new Date().toISOString().slice(0,10)).maybeSingle(),
        supabase.from("ideas").select("*").order("created_at", { ascending: false }).limit(4),
      ]);
      return {
        tasks: tasks.data ?? [],
        plans: plans.data ?? [],
        challenges: challenges.data ?? [],
        sessions: sessions.data ?? [],
        txns: txns.data ?? [],
        target: target.data,
        ideas: ideas.data ?? [],
      };
    },
  });

  const toggle = useMutation({
    mutationFn: ({ ids, done }: { ids: string[]; done: boolean }) => updateTaskStatus(ids, done),
    retry: 2,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      const n = vars.ids.length;
      if (vars.done) toast.success(n > 1 ? `${n} tasks completed 🎉` : "Task completed 🎉", {
        action: { label: "Undo", onClick: () => toggle.mutate({ ids: vars.ids, done: false }) },
      });
      else toast.success(n > 1 ? `${n} tasks reopened` : "Task reopened");
    },
    onError: (e: any, vars) => toast.error(`Sync failed: ${e?.message ?? "error"}`, {
      action: { label: "Retry", onClick: () => toggle.mutate(vars) },
    }),
  });

  const logHours = useMutation({
    mutationFn: async ({ minutes, note }: { minutes: number; note: string }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("not signed in");
      const end = new Date();
      const start = new Date(end.getTime() - minutes * 60000);
      const { error } = await supabase.from("work_sessions").insert({
        user_id: u.user.id,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        is_running: false,
        total_minutes: minutes,
        project_name: note || "Manual entry",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setHoursInput(""); setMinsInput(""); setSessionNote("");
      toast.success("Work hours logged ✓");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to log"),
  });

  const setTaskDate = useMutation({
    mutationFn: async ({ id, date }: { id: string; date: Date | undefined }) => {
      const { error } = await supabase.from("tasks").update({
        due_date: date ? date.toISOString() : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Date updated");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const visibleTasks = useMemo(() => {
    const all = data?.tasks ?? [];
    const f = all.filter((t: any) => filter === "all" ? true : filter === "completed" ? t.status === "done" : t.status !== "done");
    const s = [...f].sort((a: any, b: any) => {
      const av = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const bv = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return s.slice(0, 6);
  }, [data, filter, sortDir]);

  if (isLoading || !data) return <div className="text-muted-foreground">Loading...</div>;

  const today = startOfDay();
  const running = data.sessions.find((s: any) => s.is_running);

  const todayMins = data.sessions.reduce((a: number, s: any) => {
    if (new Date(s.start_time) < today && !s.is_running) return a;
    if (s.is_running) return a + Math.max(0, diffMinutes(s.start_time, new Date()) - s.dashboard_minutes);
    if (new Date(s.start_time) >= today) return a + s.total_minutes;
    return a;
  }, 0);

  const monthMins = data.sessions.reduce((a: number, s: any) => {
    if (!isThisMonth(s.start_time)) return a;
    return a + (s.is_running ? Math.max(0, diffMinutes(s.start_time, new Date()) - s.dashboard_minutes) : s.total_minutes);
  }, 0);

  const monthIncome = data.txns.filter((t: any) => t.type === "income" && isThisMonth(t.txn_date)).reduce((a: number, t: any) => a + Number(t.amount), 0);
  const monthExpense = data.txns.filter((t: any) => t.type === "expense" && isThisMonth(t.txn_date)).reduce((a: number, t: any) => a + Number(t.amount), 0);
  const monthNet = monthIncome - monthExpense;

  const doneToday = data.tasks.filter((t: any) => t.completed_at && new Date(t.completed_at) >= today).length;
  const target = data.target ?? { target_hours: 8, target_tasks: 3 };
  const hourPct = Math.min(100, Math.round((todayMins / 60) / Number(target.target_hours) * 100));
  const taskPct = Math.min(100, Math.round(doneToday / Number(target.target_tasks) * 100));

  // weekly hours chart (last 7 days)
  const weekData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0,0,0,0);
    const dEnd = new Date(d); dEnd.setDate(dEnd.getDate() + 1);
    const mins = data.sessions.reduce((a: number, s: any) => {
      const st = new Date(s.start_time);
      if (st < d || st >= dEnd) return a;
      return a + (s.is_running ? Math.max(0, diffMinutes(s.start_time, new Date()) - s.dashboard_minutes) : s.total_minutes);
    }, 0);
    return { label: d.toLocaleDateString("en-US", { weekday: "short" }), hours: +(mins / 60).toFixed(2) };
  });

  const visibleIds = visibleTasks.map((t: any) => t.id);
  const selectedVisible = visibleIds.filter((id: string) => selected.has(id));
  const allSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
  const someSelected = selectedVisible.length > 0 && !allSelected;
  const toggleSelect = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(visibleIds));
  const runBulk = (done: boolean) => { if (!selectedVisible.length) return; toggle.mutate({ ids: selectedVisible, done }); setSelected(new Set()); };

  return (
    <div className="space-y-6">
      {/* breadcrumb / date */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link to="/dashboard" className="hover:text-foreground">Home</Link>
        <span>/</span>
        <span className="text-foreground">Dashboard</span>
        <span className="mx-2">·</span>
        <CalendarDays className="h-4 w-4" />
        <span>{new Date().toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" })}</span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        {/* LEFT — main */}
        <div className="space-y-6">
          {/* hero */}
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <h1 className="font-display text-4xl font-black leading-tight sm:text-5xl">
                Make Things <span className="text-gradient">Simple!</span>
              </h1>
              <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                আজকের কাজ, সময়, আয়—ব্যয় সব এক জায়গায়। Plan smart, ship daily.
              </p>
            </div>
            <Link to="/tasks" className="blue-pill inline-flex items-center gap-2 self-start rounded-full px-6 py-3 text-sm font-medium text-white transition hover:scale-[1.03] sm:self-end">
              <HugeiconsIcon icon={PlusSignIcon} size={18} strokeWidth={2} /> New task
            </Link>
          </div>

          {/* top stats — 4 cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Today's work" value={fmtMins(todayMins)} sub={`${fmtMins(monthMins)} this month`} icon={Clock} grad="gradient-blue" to="/time-tracking" />
            <StatTile label="Net (month)" value={fmtMoney(monthNet)} sub={`+${fmtMoney(monthIncome)} / −${fmtMoney(monthExpense)}`} icon={Wallet} grad="gradient-cool" to="/finance" />
            <StatTile label="Active tasks" value={String(data.tasks.filter((t: any) => t.status !== "done").length)} sub={`${doneToday} done today`} icon={Check} grad="gradient-primary" to="/tasks" />
            <StatTile label="Challenges" value={String(data.challenges.length)} sub="active" icon={Flame} grad="gradient-warm" to="/challenges" />
          </div>

          {/* filter pills + task list — matching reference card style */}
          <section className="glass-panel rounded-2xl p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-lg font-semibold">Today's tasks</h2>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-white/10">{visibleTasks.length}</span>
              </div>
              <Link to="/tasks" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Tabs value={filter} onValueChange={(v) => { setFilter(v as Filter); setSelected(new Set()); }}>
                <TabsList className="h-9 rounded-full bg-white/5 p-1">
                  <TabsTrigger value="pending" className="rounded-full px-3 text-xs data-[state=active]:gradient-blue data-[state=active]:text-white">To do</TabsTrigger>
                  <TabsTrigger value="completed" className="rounded-full px-3 text-xs data-[state=active]:gradient-cool data-[state=active]:text-white">Done</TabsTrigger>
                  <TabsTrigger value="all" className="rounded-full px-3 text-xs data-[state=active]:bg-white/10">All</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button variant="ghost" size="sm" onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")} className="h-9 gap-1.5 rounded-full bg-white/5 text-xs hover:bg-white/10">
                <ArrowUpDown className="h-3.5 w-3.5" /> Due {sortDir === "asc" ? "earliest" : "latest"}
              </Button>
            </div>

            {visibleTasks.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {filter === "completed" ? "Nothing completed yet." : filter === "pending" ? "No pending tasks 🎉" : "No tasks."}
              </p>
            ) : (
              <>
                {selectedVisible.length > 0 && (
                  <div className="mb-3 flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2 ring-1 ring-primary/30">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox checked={allSelected ? true : someSelected ? "indeterminate" : false} onCheckedChange={toggleSelectAll} />
                      {selectedVisible.length} selected
                    </label>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => runBulk(true)} disabled={toggle.isPending} className="h-7 gap-1 gradient-cool text-white text-xs"><Check className="h-3.5 w-3.5" /> Complete</Button>
                      <Button size="sm" variant="outline" onClick={() => runBulk(false)} disabled={toggle.isPending} className="h-7 gap-1 text-xs"><Undo2 className="h-3.5 w-3.5" /> Reopen</Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2.5">
                  {visibleTasks.map((t: any) => {
                    const done = t.status === "done";
                    const isSel = selected.has(t.id);
                    return (
                      <div key={t.id} className={`group rounded-xl p-4 transition ${isSel ? "blue-highlight" : "bg-white/[0.03] ring-1 ring-white/5 hover:ring-white/15"}`}>
                        <div className="flex items-start gap-3">
                          <Checkbox checked={isSel} onCheckedChange={() => toggleSelect(t.id)} className="mt-1" />
                          <button
                            onClick={() => toggle.mutate({ ids: [t.id], done: !done })}
                            disabled={toggle.isPending}
                            className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition ${done ? "bg-success border-success" : "border-muted-foreground/40 hover:border-success"}`}
                            aria-label={done ? "Mark pending" : "Mark complete"}
                          >
                            {done && <Check className="h-4 w-4 text-background" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                              <span className={`h-1.5 w-1.5 rounded-full ${done ? "bg-success" : t.priority === "high" ? "bg-destructive" : t.priority === "medium" ? "bg-warning" : "bg-info"}`} />
                              {done ? "Done" : t.due_date && new Date(t.due_date) < new Date() ? "Overdue" : "Today"}
                            </div>
                            <div className={`mt-1 font-semibold ${done ? "line-through text-muted-foreground" : ""}`}>{t.title}</div>
                            {t.description && <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{t.description}</div>}
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              {t.due_date && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{bnRelative(t.due_date)}</span>}
                              <span className={`rounded-full px-2 py-0.5 ${t.priority === "high" ? "bg-destructive/20 text-destructive" : t.priority === "medium" ? "bg-warning/20 text-warning" : "bg-info/20 text-info"}`}>
                                {t.priority === "high" ? "High priority" : t.priority === "medium" ? "Medium" : "Low"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </div>

        {/* RIGHT — side rail */}
        <div className="space-y-6">
          {/* Today's Target — like 'Today note' */}
          <section className="blue-highlight rounded-2xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display font-semibold">Today's Target</h3>
              <div className="grid h-8 w-8 place-items-center rounded-full blue-pill text-white">
                <HugeiconsIcon icon={NoteEditIcon} size={16} strokeWidth={1.8} />
              </div>
            </div>
            <div className="space-y-3">
              <TargetBar label="Work hours" value={(todayMins / 60).toFixed(1)} of={`${target.target_hours}h`} pct={hourPct} grad="gradient-blue" />
              <TargetBar label="Tasks done" value={String(doneToday)} of={String(target.target_tasks)} pct={taskPct} grad="gradient-cool" />
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-muted-foreground">
              <HugeiconsIcon icon={Notification01Icon} size={14} strokeWidth={1.8} className="text-info" />
              {hourPct >= 100 && taskPct >= 100 ? "Target hit 🎉 — keep momentum!" : "Stay focused — small wins add up."}
            </div>
          </section>

          {/* Live timer card */}
          <section className="glass-panel rounded-2xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display font-semibold">Work session</h3>
              <Link to="/time-tracking" className="text-xs text-primary hover:underline">Details →</Link>
            </div>
            {running ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl gradient-cool">
                    <Clock className="h-6 w-6 animate-pulse text-white" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-success">● Live</div>
                    <div className="font-display text-2xl font-bold">{fmtMins(diffMinutes(running.start_time, new Date()))}</div>
                    <div className="text-xs text-muted-foreground">{running.project_name ?? "Untitled"}</div>
                  </div>
                </div>
                <Button onClick={() => stopTimer.mutate(running)} disabled={stopTimer.isPending} className="mt-4 w-full gradient-warm text-white">
                  <Square className="mr-1.5 h-4 w-4" /> Stop & Save
                </Button>
              </>
            ) : (
              <>
                <div className="rounded-xl bg-white/5 p-4 text-center">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Ready</div>
                  <div className="font-display text-2xl font-bold">00h 00m</div>
                </div>
                <Button onClick={() => startTimer.mutate()} disabled={startTimer.isPending} className="mt-4 w-full gradient-blue text-white glow-blue">
                  <Play className="mr-1.5 h-4 w-4" /> Start Timer
                </Button>
              </>
            )}
          </section>

          {/* Activity — weekly hours area chart, like reference 'Activity' */}
          <section className="glass-panel rounded-2xl p-5">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold">Activity</h3>
                <div className="text-xs text-muted-foreground">{doneToday + data.tasks.filter((t: any) => t.completed_at && isThisMonth(t.completed_at)).length} tasks completed</div>
              </div>
              <Link to="/reports" className="inline-flex items-center gap-1 rounded-full gradient-blue px-3 py-1.5 text-xs font-medium text-white">Report <ArrowRight className="h-3 w-3" /></Link>
            </div>
            <div className="text-right text-xs font-bold text-info">{Math.round((todayMins / 60) * 10) / 10}h today</div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weekData}>
                  <defs>
                    <linearGradient id="actg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6ab1ff" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#6ab1ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" stroke="oklch(0.7 0 0)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "oklch(0.18 0.04 265)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8 }} formatter={(v: any) => `${v}h`} />
                  <Area type="monotone" dataKey="hours" stroke="#6ab1ff" strokeWidth={2} fill="url(#actg)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Active challenges mini */}
          {data.challenges.length > 0 && (
            <section className="glass-panel rounded-2xl p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display font-semibold">Challenges</h3>
                <Link to="/challenges" className="text-xs text-primary hover:underline">All →</Link>
              </div>
              <ul className="space-y-2">
                {data.challenges.slice(0, 3).map((c: any) => {
                  const u = urgencyLevel(c.deadline);
                  const cls = u === "critical" ? "bg-destructive/20 text-destructive" : u === "urgent" ? "bg-pink/20 text-pink" : u === "warn" ? "bg-warning/20 text-warning" : "bg-info/20 text-info";
                  return (
                    <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-white/5">
                      <span className="truncate text-sm">{c.title}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${cls}`}>{bnRelative(c.deadline)}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, sub, icon: Icon, grad, to }: { label: string; value: string; sub: string; icon: any; grad: string; to: string }) {
  return (
    <Link to={to} className="glass-card group rounded-2xl p-5 transition hover:scale-[1.02]">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-2 truncate text-2xl font-bold">{value}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{sub}</div>
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${grad} transition group-hover:scale-110`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </Link>
  );
}

function TargetBar({ label, value, of, pct, grad }: { label: string; value: string; of: string; pct: number; grad: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value} <span className="text-muted-foreground">/ {of}</span> · <span className="text-info">{pct}%</span></span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <div className={`h-full ${grad} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
