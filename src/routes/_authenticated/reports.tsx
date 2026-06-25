import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BarChart3, Clock, Wallet, CheckCircle2, XCircle, Flame, Download } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney, fmtMins, diffMinutes } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Monthly Report · WeboGrowth" }] }),
  component: Reports,
});

function monthKey(d: string | Date) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}
function daysInMonth(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function Reports() {
  const [month, setMonth] = useState(monthKey(new Date()));

  const { data } = useQuery({
    queryKey: ["report-all"],
    queryFn: async () => {
      const [ws, tx, tasks, ch] = await Promise.all([
        supabase.from("work_sessions").select("*"),
        supabase.from("transactions").select("*"),
        supabase.from("tasks").select("*"),
        supabase.from("challenges").select("*"),
      ]);
      return {
        sessions: ws.data ?? [],
        txns: tx.data ?? [],
        tasks: tasks.data ?? [],
        challenges: ch.data ?? [],
      };
    },
  });

  const monthsAvail = useMemo(() => {
    const set = new Set<string>([monthKey(new Date())]);
    data?.sessions.forEach((s: any) => set.add(monthKey(s.start_time)));
    data?.txns.forEach((t: any) => set.add(monthKey(t.txn_date)));
    return Array.from(set).sort().reverse();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return null;
    const inMonth = (d: string) => monthKey(d) === month;
    const sessions = data.sessions.filter((s: any) => inMonth(s.start_time));
    const txns = data.txns.filter((t: any) => inMonth(t.txn_date));
    const tasks = data.tasks.filter((t: any) => inMonth(t.created_at) || (t.completed_at && inMonth(t.completed_at)) || (t.due_date && inMonth(t.due_date)));
    const challenges = data.challenges.filter((c: any) => inMonth(c.created_at) || inMonth(c.deadline));

    const totalMins = sessions.reduce((a: number, s: any) =>
      a + (s.is_running ? diffMinutes(s.start_time, new Date()) - s.dashboard_minutes : s.total_minutes), 0);
    const income = txns.filter((t: any) => t.type === "income").reduce((a: number, t: any) => a + Number(t.amount), 0);
    const expense = txns.filter((t: any) => t.type === "expense").reduce((a: number, t: any) => a + Number(t.amount), 0);

    const completed = tasks.filter((t: any) => t.status === "done").length;
    const pending = tasks.filter((t: any) => t.status !== "done").length;
    const missed = tasks.filter((t: any) => t.status !== "done" && t.due_date && new Date(t.due_date) < new Date()).length;

    // hours per day for chart
    const dim = daysInMonth(month);
    const perDay = Array.from({ length: dim }, (_, i) => ({ day: i + 1, hours: 0 }));
    sessions.forEach((s: any) => {
      const d = new Date(s.start_time).getDate();
      const mins = s.is_running ? diffMinutes(s.start_time, new Date()) - s.dashboard_minutes : s.total_minutes;
      perDay[d - 1].hours += mins / 60;
    });

    return { sessions, txns, tasks, challenges, totalMins, income, expense, completed, pending, missed, perDay };
  }, [data, month]);

  const exportCsv = () => {
    if (!filtered) return;
    const lines = ["section,date,detail,amount/minutes"];
    filtered.sessions.forEach((s: any) => {
      const mins = s.is_running ? diffMinutes(s.start_time, new Date()) - s.dashboard_minutes : s.total_minutes;
      lines.push(`work,${s.start_time.slice(0,10)},"${(s.project_name ?? "").replace(/"/g,'""')}",${mins}min`);
    });
    filtered.txns.forEach((t: any) => {
      lines.push(`${t.type},${t.txn_date},"${(t.description ?? t.category).replace(/"/g,'""')}",${t.amount}`);
    });
    filtered.tasks.forEach((t: any) => {
      lines.push(`task-${t.status},${(t.due_date ?? t.created_at).slice(0,10)},"${t.title.replace(/"/g,'""')}",`);
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `report-${month}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!filtered) return <div className="text-muted-foreground">Loading...</div>;

  const net = filtered.income - filtered.expense;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">Monthly Report</h1>
          <p className="mt-1 text-muted-foreground">এক জায়গায় পুরো মাসের সব হিসাব — কাজ, আয়, ব্যয়, টাস্ক, চ্যালেঞ্জ।</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[200px] glass-card border-0"><SelectValue /></SelectTrigger>
            <SelectContent>{monthsAvail.map((k) => <SelectItem key={k} value={k}>{monthLabel(k)}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={exportCsv} variant="outline" className="glass-card border-0"><Download className="mr-1.5 h-4 w-4" /> CSV</Button>
        </div>
      </div>

      {/* top stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RepStat label="Total work" value={fmtMins(filtered.totalMins)} sub={`${filtered.sessions.length} sessions`} icon={Clock} grad="gradient-blue" />
        <RepStat label="Income" value={fmtMoney(filtered.income)} sub="this month" icon={Wallet} grad="gradient-cool" />
        <RepStat label="Expense" value={fmtMoney(filtered.expense)} sub={`Net: ${fmtMoney(net)}`} icon={Wallet} grad="gradient-warm" />
        <RepStat label="Tasks done" value={String(filtered.completed)} sub={`${filtered.pending} pending`} icon={CheckCircle2} grad="gradient-primary" />
      </div>

      {/* daily hours chart */}
      <section className="glass-panel rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Hours per day — {monthLabel(month)}</h2>
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filtered.perDay}>
              <defs>
                <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6ab1ff" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#6ab1ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="oklch(1 0 0 / 0.06)" vertical={false} />
              <XAxis dataKey="day" stroke="oklch(0.7 0 0)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.7 0 0)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "oklch(0.18 0.04 265)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8 }} formatter={(v: any) => `${Number(v).toFixed(1)}h`} />
              <Area type="monotone" dataKey="hours" stroke="#6ab1ff" strokeWidth={2} fill="url(#hg)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* missed tasks */}
        <section className="glass-panel rounded-2xl p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
            <XCircle className="h-5 w-5 text-destructive" /> Missed / overdue tasks
          </h2>
          {filtered.tasks.filter((t: any) => t.status !== "done" && t.due_date && new Date(t.due_date) < new Date()).length === 0 ? (
            <p className="text-sm text-muted-foreground">কিছুই মিস হয়নি 🎉</p>
          ) : (
            <ul className="space-y-2">
              {filtered.tasks
                .filter((t: any) => t.status !== "done" && t.due_date && new Date(t.due_date) < new Date())
                .slice(0, 10)
                .map((t: any) => (
                  <li key={t.id} className="flex items-center justify-between rounded-lg bg-destructive/10 px-3 py-2 text-sm ring-1 ring-destructive/20">
                    <span className="truncate">{t.title}</span>
                    <span className="text-xs text-destructive">{new Date(t.due_date).toLocaleDateString("en-GB")}</span>
                  </li>
                ))}
            </ul>
          )}
        </section>

        {/* challenges */}
        <section className="glass-panel rounded-2xl p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
            <Flame className="h-5 w-5 text-warning" /> Challenges
          </h2>
          {filtered.challenges.length === 0 ? (
            <p className="text-sm text-muted-foreground">এই মাসে কোনো চ্যালেঞ্জ নেই।</p>
          ) : (
            <ul className="space-y-2">
              {filtered.challenges.slice(0, 10).map((c: any) => (
                <li key={c.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-sm ring-1 ring-white/5">
                  <span className="truncate">{c.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${c.status === "completed" ? "bg-success/20 text-success" : c.status === "failed" ? "bg-destructive/20 text-destructive" : "bg-info/20 text-info"}`}>
                    {c.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function RepStat({ label, value, sub, icon: Icon, grad }: { label: string; value: string; sub: string; icon: any; grad: string }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-2 text-2xl font-bold">{value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
        </div>
        <div className={`grid h-11 w-11 place-items-center rounded-xl ${grad}`}><Icon className="h-5 w-5 text-white" /></div>
      </div>
    </div>
  );
}
