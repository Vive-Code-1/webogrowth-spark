import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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
import { runOrQueue, flushQueue, queueSize, isOffline } from "@/lib/offline-queue";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · WeboGrowth" }] }),
  component: Dashboard,
});

type Filter = "pending" | "completed" | "all";
type SortDir = "asc" | "desc";
type IdeasFilter = "incomplete" | "all";

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
  const [ideaInput, setIdeaInput] = useState("");
  const [ideasFilter, setIdeasFilter] = useState<IdeasFilter>("incomplete");
  const [challengesFilter, setChallengesFilter] = useState<IdeasFilter>("incomplete");

  const [txnType, setTxnType] = useState<"income" | "expense">("income");
  const [txnAmount, setTxnAmount] = useState("");
  const [txnNote, setTxnNote] = useState("");
  const [offline, setOffline] = useState<boolean>(isOffline());
  const [pendingSync, setPendingSync] = useState<number>(queueSize());

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [tasks, plans, challenges, sessions, txns, target, ideas, activity] = await Promise.all([
        supabase.from("tasks").select("*").order("due_date", { ascending: true }),
        supabase.from("plans").select("id, progress"),
        supabase.from("challenges").select("*").order("deadline", { ascending: true }),
        supabase.from("work_sessions").select("*").order("start_time", { ascending: false }),
        supabase.from("transactions").select("*").order("txn_date", { ascending: false }),
        supabase.from("daily_targets").select("*").eq("target_date", new Date().toISOString().slice(0,10)).maybeSingle(),
        supabase.from("ideas").select("*").order("created_at", { ascending: false }).limit(10),
        supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(20),
      ]);
      return {
        tasks: tasks.data ?? [],
        plans: plans.data ?? [],
        challenges: challenges.data ?? [],
        sessions: sessions.data ?? [],
        txns: txns.data ?? [],
        target: target.data,
        ideas: ideas.data ?? [],
        activity: activity.data ?? [],
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

  const addIdea = useMutation({
    mutationFn: async (title: string) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("not signed in");
      const { error } = await supabase.from("ideas").insert({ user_id: u.user.id, title });
      if (error) throw error;
    },
    onSuccess: () => {
      setIdeaInput("");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["ideas"] });
      toast.success("Idea captured 💡");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  // per-row in-flight tracking so each challenge/idea has its own loading state
  const [pendingChallenges, setPendingChallenges] = useState<Set<string>>(new Set());
  const [pendingIdeas, setPendingIdeas] = useState<Set<string>>(new Set());

  const toggleIdea = useMutation({
    mutationFn: async ({ id, done, title }: { id: string; done: boolean; title?: string }) => {
      const r = await runOrQueue({ kind: "idea.toggle", entityId: id, done, title });
      return r;
    },
    onMutate: async ({ id, done }) => {
      setPendingIdeas((p) => { const n = new Set(p); n.add(id); return n; });
      await qc.cancelQueries({ queryKey: ["dashboard"] });
      const prev = qc.getQueryData<any>(["dashboard"]);
      qc.setQueryData<any>(["dashboard"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          ideas: old.ideas.map((i: any) =>
            i.id === id ? { ...i, status: done ? "converted" : "new" } : i
          ),
        };
      });
      return { prev };
    },
    onSuccess: (r, vars) => {
      qc.invalidateQueries({ queryKey: ["ideas"] });
      if (r?.queued) {
        setPendingSync(queueSize());
        toast.success("Saved offline — will sync when online");
      } else {
        toast.success(vars.done ? "Idea marked done ✅" : "Idea reopened");
      }
    },
    onError: (e: any, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["dashboard"], ctx.prev);
      toast.error(e?.message ?? "Failed");
    },
    onSettled: (_d, _e, vars) => {
      setPendingIdeas((p) => { const n = new Set(p); n.delete(vars.id); return n; });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });


  const toggleChallenge = useMutation({
    mutationFn: async ({ id, done, title }: { id: string; done: boolean; title?: string }) => {
      const r = await runOrQueue({ kind: "challenge.toggle", entityId: id, done, title });
      return r;
    },
    onMutate: async ({ id, done }) => {
      setPendingChallenges((p) => { const n = new Set(p); n.add(id); return n; });
      await qc.cancelQueries({ queryKey: ["dashboard"] });
      const prev = qc.getQueryData<any>(["dashboard"]);
      qc.setQueryData<any>(["dashboard"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          challenges: old.challenges.map((c: any) =>
            c.id === id
              ? { ...c, status: done ? "completed" : "active", updated_at: new Date().toISOString() }
              : c
          ),
        };
      });
      return { prev };
    },
    onSuccess: (r, vars) => {
      qc.invalidateQueries({ queryKey: ["challenges"] });
      if (r?.queued) {
        setPendingSync(queueSize());
        toast.success("Saved offline — will sync when online");
      } else {
        toast.success(vars.done ? "Challenge completed 🔥" : "Challenge reopened");
      }
    },
    onError: (e: any, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["dashboard"], ctx.prev);
      toast.error(e?.message ?? "Failed");
    },
    onSettled: (_d, _e, vars) => {
      setPendingChallenges((p) => { const n = new Set(p); n.delete(vars.id); return n; });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  // Realtime sync — challenges + tasks, scoped to current user, auto-resubscribe on drop
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (cancelled || !u.user) return;
      const uid = u.user.id;
      const filter = `user_id=eq.${uid}`;
      channel = supabase
        .channel(`dashboard-stream-${uid}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "challenges", filter }, () => {
          qc.invalidateQueries({ queryKey: ["dashboard"] });
          qc.invalidateQueries({ queryKey: ["challenges"] });
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter }, () => {
          qc.invalidateQueries({ queryKey: ["dashboard"] });
          qc.invalidateQueries({ queryKey: ["tasks"] });
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "activity_log", filter }, () => {
          qc.invalidateQueries({ queryKey: ["dashboard"] });
        })
        .subscribe((status) => {
          if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") && !cancelled) {
            if (channel) supabase.removeChannel(channel);
            channel = null;
            retry = setTimeout(() => { if (!cancelled) connect(); }, 2000);
          }
        });
    };

    connect();
    const onVisible = () => { if (document.visibilityState === "visible") qc.invalidateQueries({ queryKey: ["dashboard"] }); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
      if (channel) supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [qc]);

  // Offline queue: flush on reconnect + on mount; track online state
  useEffect(() => {
    const sync = async () => {
      setOffline(isOffline());
      if (!isOffline() && queueSize() > 0) {
        const r = await flushQueue(() => setPendingSync(queueSize()));
        setPendingSync(queueSize());
        if (r.ok > 0) {
          toast.success(`Synced ${r.ok} pending change${r.ok > 1 ? "s" : ""} ✓`);
          qc.invalidateQueries({ queryKey: ["dashboard"] });
        }
      }
    };
    sync();
    const onOnline = () => sync();
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [qc]);

  const addTxn = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(txnAmount);
      if (!amount || amount <= 0) throw new Error("Enter a valid amount");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("not signed in");
      const { error } = await supabase.from("transactions").insert({
        user_id: u.user.id,
        type: txnType,
        amount,
        description: txnNote || null,
        txn_date: new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTxnAmount(""); setTxnNote("");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["finance"] });
      toast.success(txnType === "income" ? "Income added ✓" : "Expense added ✓");
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
    return s;
  }, [data, filter, sortDir]);

  if (isLoading || !data) return <div className="text-muted-foreground">Loading...</div>;

  const today = startOfDay();
  // (live timer removed — hours are logged manually)

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

  const activeChallenges = data.challenges.filter((c: any) => c.status === "active");
  // Show active first, then recently completed — so checkbox stays available to reopen
  const visibleChallenges = [...data.challenges].sort((a: any, b: any) => {
    if (a.status === "active" && b.status !== "active") return -1;
    if (b.status === "active" && a.status !== "active") return 1;
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });

  // Activity stream — merges activity_log entries (challenge toggles with before/after)
  // with recent task completions, newest first
  const activityItems = (() => {
    const logged = (data.activity ?? []).map((a: any) => ({
      id: `a-${a.id}`,
      kind: a.entity_type === "challenge" ? "challenge" as const : "task" as const,
      action: a.action as string,
      from: a.from_state as string | null,
      to: a.to_state as string | null,
      title: a.title ?? "",
      at: a.created_at as string,
    }));
    const tasksDone = data.tasks
      .filter((t: any) => t.completed_at)
      .map((t: any) => ({ id: `t-${t.id}`, kind: "task" as const, action: "complete", from: "pending", to: "done", title: t.title, at: t.completed_at as string }));
    return [...logged, ...tasksDone]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 8);
  })();


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
      {(offline || pendingSync > 0) && (
        <div role="status" aria-live="polite" className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs ring-1 ${offline ? "bg-warning/10 text-warning ring-warning/30" : "bg-info/10 text-info ring-info/30"}`}>
          <span className={`h-2 w-2 rounded-full ${offline ? "bg-warning animate-pulse" : "bg-info"}`} />
          {offline
            ? `Offline — changes are queued${pendingSync > 0 ? ` (${pendingSync} pending)` : ""} and will sync when you're back online.`
            : `Syncing ${pendingSync} pending change${pendingSync > 1 ? "s" : ""}…`}
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">

        {/* LEFT — main */}
        <div className="space-y-6">
          {/* top stats — 4 cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Today's work" value={fmtMins(todayMins)} sub={`${fmtMins(monthMins)} this month`} icon={Clock} grad="gradient-blue" to="/time-tracking" />
            <StatTile label="Net (month)" value={fmtMoney(monthNet)} sub={`+${fmtMoney(monthIncome)} / −${fmtMoney(monthExpense)}`} icon={Wallet} grad="gradient-cool" to="/finance" />
            <StatTile label="Active tasks" value={String(data.tasks.filter((t: any) => t.status !== "done").length)} sub={`${doneToday} done today`} icon={Check} grad="gradient-primary" to="/tasks" />
            <StatTile label="Challenges" value={String(activeChallenges.length)} sub="active" icon={Flame} grad="gradient-warm" to="/challenges" />
          </div>

          {/* filter pills + task list — matching reference card style */}
          <section className="glass-panel rounded-2xl p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-lg font-semibold">Today's tasks</h2>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-white/10">{visibleTasks.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <Link to="/tasks" className="blue-pill inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-white transition hover:scale-[1.03]">
                  <HugeiconsIcon icon={PlusSignIcon} size={14} strokeWidth={2} /> New task
                </Link>
                <Link to="/tasks" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
              </div>
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

                <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-2 scrollbar-brand">
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
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 ring-1 ring-white/10 hover:ring-primary/40 transition">
                                    <CalendarDays className="h-3 w-3" />
                                    {t.due_date ? bnRelative(t.due_date) : "Set date"}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={t.due_date ? new Date(t.due_date) : undefined}
                                    onSelect={(d) => setTaskDate.mutate({ id: t.id, date: d })}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
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

          {/* Activity — full width, larger */}
          <section className="glass-panel rounded-2xl p-5">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold">Activity</h3>
                <div className="text-xs text-muted-foreground">{doneToday + data.tasks.filter((t: any) => t.completed_at && isThisMonth(t.completed_at)).length} tasks completed</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-info">{Math.round((todayMins / 60) * 10) / 10}h today</span>
                <Link to="/reports" className="inline-flex items-center gap-1 rounded-full gradient-blue px-3 py-1.5 text-xs font-medium text-white">Report <ArrowRight className="h-3 w-3" /></Link>
              </div>
            </div>
            <div className="h-56">
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

            {/* Activity stream — recent completions */}
            <div className="mt-4 border-t border-white/5 pt-4">
              <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Recent activity</div>
              {activityItems.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">Nothing logged yet — complete a task or challenge.</p>
              ) : (
                <ul className="space-y-1.5">
                  {activityItems.map((a: any) => {
                    const isReopen = a.action === "reopen";
                    const verb = a.kind === "challenge"
                      ? (isReopen ? "Challenge reopened" : "Challenge completed")
                      : (isReopen ? "Task reopened" : "Task done");
                    return (
                      <li key={a.id} className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-white/5">
                        <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${a.kind === "challenge" ? "gradient-warm" : "gradient-cool"}`}>
                          {a.kind === "challenge" ? <Flame className="h-3 w-3 text-white" /> : <Check className="h-3 w-3 text-white" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">
                            <span className="text-muted-foreground">{verb} · </span>
                            <span className="font-medium">{a.title}</span>
                          </div>
                          {a.from && a.to && (
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                              <span className="rounded bg-white/5 px-1.5 py-0.5">{a.from}</span>
                              <ArrowRight className="h-2.5 w-2.5" />
                              <span className={`rounded px-1.5 py-0.5 ${a.to === "completed" || a.to === "done" ? "bg-success/15 text-success" : "bg-info/15 text-info"}`}>{a.to}</span>
                            </div>
                          )}
                        </div>
                        <span className="shrink-0 text-[10px] text-muted-foreground" title={new Date(a.at).toLocaleString()}>{bnRelative(a.at)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {/* Challenges + Quick income/expense */}
          <div className="grid gap-6 md:grid-cols-2">
            <section className="glass-panel rounded-2xl p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-full gradient-warm">
                    <Flame className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="font-display font-semibold">Challenges</h3>
                </div>
                <Link to="/challenges" className="text-xs text-primary hover:underline">All →</Link>
              </div>
              <Tabs value={challengesFilter} onValueChange={(v) => setChallengesFilter(v as IdeasFilter)} className="mb-3">
                <TabsList className="h-8 w-full rounded-full bg-white/5 p-1">
                  <TabsTrigger value="incomplete" className="flex-1 rounded-full text-xs data-[state=active]:gradient-warm data-[state=active]:text-white">
                    Open ({data.challenges.filter((c: any) => c.status !== "completed").length})
                  </TabsTrigger>
                  <TabsTrigger value="all" className="flex-1 rounded-full text-xs data-[state=active]:gradient-warm data-[state=active]:text-white">
                    All ({data.challenges.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              {(() => {
                const filteredChallenges = challengesFilter === "incomplete"
                  ? visibleChallenges.filter((c: any) => c.status !== "completed")
                  : visibleChallenges;
                if (filteredChallenges.length === 0) {
                  return (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      {challengesFilter === "incomplete" ? "All challenges done 🔥" : "No challenges yet."}
                    </p>
                  );
                }
                return (
                <ul className="space-y-2">
                  {filteredChallenges.slice(0, 4).map((c: any) => {
                    const u = urgencyLevel(c.deadline);
                    const cls = u === "critical" ? "bg-destructive/20 text-destructive" : u === "urgent" ? "bg-pink/20 text-pink" : u === "warn" ? "bg-warning/20 text-warning" : "bg-info/20 text-info";
                    const done = c.status === "completed";
                    const busy = pendingChallenges.has(c.id);
                    return (
                      <li key={c.id} aria-busy={busy} className={`flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-white/5 transition ${done ? "opacity-60" : ""} ${busy ? "ring-primary/40" : ""}`}>
                        <label className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center cursor-pointer">
                          <Checkbox
                            checked={done}
                            onCheckedChange={(v) => toggleChallenge.mutate({ id: c.id, done: !!v, title: c.title })}
                            disabled={busy}
                            aria-label={`${done ? "Reopen" : "Complete"} challenge: ${c.title}`}
                            className={`transition ${busy ? "opacity-50" : ""}`}
                          />
                          {busy && (
                            <span className="pointer-events-none absolute inset-0 grid place-items-center">
                              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                            </span>
                          )}
                        </label>
                        <span className={`flex-1 truncate text-sm ${done ? "line-through text-muted-foreground" : ""}`}>{c.title}</span>
                        {busy && <span className="text-[10px] text-primary">Saving…</span>}
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${cls}`}>{bnRelative(c.deadline)}</span>
                      </li>
                    );
                  })}
                </ul>
                );
              })()}
            </section>


            {/* Quick income / expense */}
            <section className="glass-panel rounded-2xl p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-full gradient-cool">
                    <Wallet className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="font-display font-semibold">Quick entry</h3>
                </div>
                <Link to="/finance" className="text-xs text-primary hover:underline">Finance →</Link>
              </div>
              <Tabs value={txnType} onValueChange={(v) => setTxnType(v as "income" | "expense")}>
                <TabsList className="h-9 w-full rounded-full bg-white/5 p-1">
                  <TabsTrigger value="income" className="flex-1 rounded-full text-xs data-[state=active]:gradient-cool data-[state=active]:text-white">Income</TabsTrigger>
                  <TabsTrigger value="expense" className="flex-1 rounded-full text-xs data-[state=active]:gradient-warm data-[state=active]:text-white">Expense</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="mt-3 space-y-2">
                <Input
                  type="number"
                  min={0}
                  placeholder="Amount (৳)"
                  value={txnAmount}
                  onChange={(e) => setTxnAmount(e.target.value)}
                  className="h-10 bg-white/5"
                />
                <Input
                  placeholder="Note (optional)"
                  value={txnNote}
                  onChange={(e) => setTxnNote(e.target.value)}
                  className="h-10 bg-white/5"
                />
                <Button
                  onClick={() => addTxn.mutate()}
                  disabled={addTxn.isPending || !txnAmount}
                  className={`w-full text-white ${txnType === "income" ? "gradient-cool" : "gradient-warm"}`}
                >
                  <Save className="mr-1.5 h-4 w-4" /> Add {txnType === "income" ? "income" : "expense"}
                </Button>
              </div>
            </section>
          </div>

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
            <div className="rounded-xl bg-white/5 p-4 text-center">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Today's logged</div>
              <div className="font-display text-2xl font-bold">{fmtMins(todayMins)}</div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="text-xs text-muted-foreground">Log hours worked today</div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input type="number" min={0} max={24} placeholder="Hrs" value={hoursInput} onChange={(e) => setHoursInput(e.target.value)} className="h-10 bg-white/5" />
                </div>
                <div className="flex-1">
                  <Input type="number" min={0} max={59} placeholder="Min" value={minsInput} onChange={(e) => setMinsInput(e.target.value)} className="h-10 bg-white/5" />
                </div>
              </div>
              <Input placeholder="What did you work on? (optional)" value={sessionNote} onChange={(e) => setSessionNote(e.target.value)} className="h-10 bg-white/5" />
              <Button
                onClick={() => {
                  const h = parseInt(hoursInput || "0", 10);
                  const m = parseInt(minsInput || "0", 10);
                  const total = (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
                  if (total <= 0) return toast.error("Enter hours or minutes");
                  logHours.mutate({ minutes: total, note: sessionNote });
                }}
                disabled={logHours.isPending}
                className="w-full gradient-blue text-white glow-blue"
              >
                <Save className="mr-1.5 h-4 w-4" /> Log hours
              </Button>
            </div>
          </section>

          {/* Recent ideas */}
          <section className="glass-panel rounded-2xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-full gradient-warm">
                  <Lightbulb className="h-4 w-4 text-white" />
                </div>
                <h3 className="font-display font-semibold">Recent ideas</h3>
              </div>
              <Link to="/ideas" className="text-xs text-primary hover:underline">All →</Link>
            </div>
            {/* Filter toggle: incomplete vs all */}
            <Tabs value={ideasFilter} onValueChange={(v) => setIdeasFilter(v as IdeasFilter)} className="mb-3">
              <TabsList className="h-8 w-full rounded-full bg-white/5 p-1">
                <TabsTrigger value="incomplete" className="flex-1 rounded-full text-[11px] data-[state=active]:gradient-warm data-[state=active]:text-white">
                  Open ({data.ideas.filter((i: any) => i.status !== "converted").length})
                </TabsTrigger>
                <TabsTrigger value="all" className="flex-1 rounded-full text-[11px] data-[state=active]:bg-white/10">
                  All ({data.ideas.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {(() => {
              const filteredIdeas = ideasFilter === "incomplete"
                ? data.ideas.filter((i: any) => i.status !== "converted")
                : data.ideas;
              if (filteredIdeas.length === 0) {
                return <p className="py-3 text-center text-xs text-muted-foreground">
                  {ideasFilter === "incomplete" ? "All ideas done 🎉" : "No ideas yet. Capture one below!"}
                </p>;
              }
              return (
                <ul className="space-y-2">
                  {filteredIdeas.slice(0, 5).map((i: any) => {
                    const done = i.status === "converted";
                    const busy = pendingIdeas.has(i.id);
                    return (
                      <li key={i.id} aria-busy={busy} className={`flex items-start gap-2 rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-white/5 transition ${done ? "opacity-60" : ""} ${busy ? "ring-primary/40" : ""}`}>
                        <label className="relative mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center cursor-pointer">
                          <Checkbox
                            checked={done}
                            onCheckedChange={(v) => toggleIdea.mutate({ id: i.id, done: !!v, title: i.title })}
                            disabled={busy}
                            aria-label={`${done ? "Reopen" : "Mark done"} idea: ${i.title}`}
                            className={`transition ${busy ? "opacity-50" : ""}`}
                          />
                          {busy && (
                            <span className="pointer-events-none absolute inset-0 grid place-items-center">
                              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                            </span>
                          )}
                        </label>
                        <div className="min-w-0 flex-1">
                          <div className={`truncate text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}>{i.title}</div>
                          <div className="mt-0.5 flex items-center gap-2 text-[10px]">
                            {i.tag && <span className="uppercase tracking-wider text-info">{i.tag}</span>}
                            {busy && <span className="text-primary">Saving…</span>}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              );
            })()}
            {/* Quick capture */}
            <form
              onSubmit={(e) => { e.preventDefault(); const v = ideaInput.trim(); if (v) addIdea.mutate(v); }}
              className="mt-3 flex gap-2"
            >
              <Input
                value={ideaInput}
                onChange={(e) => setIdeaInput(e.target.value)}
                placeholder="Capture a quick idea…"
                className="h-9 bg-white/5 text-sm"
              />
              <Button type="submit" disabled={addIdea.isPending || !ideaInput.trim()} size="sm" className="h-9 gradient-warm text-white">
                <HugeiconsIcon icon={PlusSignIcon} size={14} strokeWidth={2} />
              </Button>
            </form>
          </section>

          {/* This month — snapshot to fill side rail */}
          <section className="glass-panel rounded-2xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-full gradient-cool">
                  <Wallet className="h-4 w-4 text-white" />
                </div>
                <h3 className="font-display font-semibold">This month</h3>
              </div>
              <Link to="/reports" className="text-xs text-primary hover:underline">Report →</Link>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Hours</div>
                <div className="mt-1 font-display text-lg font-bold">{fmtMins(monthMins)}</div>
              </div>
              <div className="rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Net</div>
                <div className={`mt-1 font-display text-lg font-bold ${monthNet >= 0 ? "text-success" : "text-destructive"}`}>{fmtMoney(monthNet)}</div>
              </div>
              <div className="rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Income</div>
                <div className="mt-1 text-sm font-semibold text-success">+{fmtMoney(monthIncome)}</div>
              </div>
              <div className="rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Expense</div>
                <div className="mt-1 text-sm font-semibold text-destructive">−{fmtMoney(monthExpense)}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg blue-highlight px-3 py-2 text-xs">
              <Flame className="h-3.5 w-3.5 text-pink" />
              <span className="text-muted-foreground">{data.plans.length} active plans · {data.tasks.filter((t:any)=>t.status!=="done").length} open tasks</span>
            </div>
          </section>
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
