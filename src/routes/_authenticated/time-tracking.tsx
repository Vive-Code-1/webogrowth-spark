import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Clock, Play, Square, Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fmtMins, diffMinutes } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/time-tracking")({
  head: () => ({ meta: [{ title: "Time Tracking · WeboGrowth" }] }),
  component: TimeTracking,
});

type Session = {
  id: string;
  work_date: string;
  start_time: string;
  end_time: string | null;
  dashboard_minutes: number;
  total_minutes: number;
  td_account: string | null;
  project_name: string | null;
  project_url: string | null;
  notes: string | null;
  is_running: boolean;
};

function monthKey(d: string | Date) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

function TimeTracking() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<string>(monthKey(new Date()));
  const [tick, setTick] = useState(0);

  // re-render every second when there's a running session
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: sessions = [] } = useQuery({
    queryKey: ["work_sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_sessions").select("*")
        .order("start_time", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Session[];
    },
  });

  const months = useMemo(() => {
    const set = new Set<string>([monthKey(new Date())]);
    sessions.forEach((s) => set.add(monthKey(s.start_time)));
    return Array.from(set).sort().reverse();
  }, [sessions]);

  const filtered = sessions.filter((s) => monthKey(s.start_time) === month);
  const running = sessions.find((s) => s.is_running);

  const totalMonthMins = filtered.reduce((a, s) => {
    if (s.is_running) return a + Math.max(0, diffMinutes(s.start_time, new Date()) - s.dashboard_minutes);
    return a + s.total_minutes;
  }, 0);

  const startTimer = useMutation({
    mutationFn: async (vars: { project_name: string; td_account: string; project_url?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("not signed in");
      const { error } = await supabase.from("work_sessions").insert({
        user_id: u.user.id,
        start_time: new Date().toISOString(),
        is_running: true,
        project_name: vars.project_name || null,
        td_account: vars.td_account || null,
        project_url: vars.project_url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["work_sessions"] }); toast.success("Timer started ▶"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const stopTimer = useMutation({
    mutationFn: async (s: Session) => {
      const end = new Date();
      const total = Math.max(0, diffMinutes(s.start_time, end) - s.dashboard_minutes);
      const { error } = await supabase.from("work_sessions").update({
        end_time: end.toISOString(), is_running: false, total_minutes: total,
      }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["work_sessions"] }); toast.success("Session saved ✓"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const removeSession = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("work_sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["work_sessions"] }); toast.success("Deleted"); },
  });

  return (
    <div className="space-y-6">
      {/* hero */}
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">Time Tracking</h1>
          <p className="mt-1 text-muted-foreground">আপনার প্রতিটি কাজের সেশন এখানে রেকর্ড থাকবে — Live timer বা ম্যানুয়াল entry।</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[180px] glass-card border-0"><SelectValue /></SelectTrigger>
            <SelectContent>{months.map((k) => <SelectItem key={k} value={k}>{monthLabel(k)}</SelectItem>)}</SelectContent>
          </Select>
          <AddSessionDialog open={open} setOpen={setOpen} />
        </div>
      </div>

      {/* live timer */}
      <LiveTimerCard
        running={running}
        onStart={(p) => startTimer.mutate(p)}
        onStop={(s) => stopTimer.mutate(s)}
        starting={startTimer.isPending}
        stopping={stopTimer.isPending}
      />

      {/* month summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Sessions this month" value={String(filtered.length)} hint={monthLabel(month)} />
        <StatCard label="Total work" value={fmtMins(totalMonthMins)} hint="excl. dashboard time" tone="cool" />
        <StatCard
          label="Avg / session"
          value={filtered.length ? fmtMins(Math.round(totalMonthMins / filtered.length)) : "—"}
          hint="this month"
          tone="warm"
        />
      </div>

      {/* table */}
      <section className="glass-panel overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between p-5">
          <h2 className="font-display text-lg font-semibold">{monthLabel(month)} — Sessions</h2>
          <span className="text-xs text-muted-foreground">{filtered.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-gradient-to-r from-emerald-500/80 to-emerald-400/80 text-emerald-950">
              <tr>
                {["Date", "Start", "End", "Total", "Dashboard", "Net Work", "Account", "Project", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-muted-foreground">No sessions in this month. Start the timer above ↑</td></tr>
              )}
              {filtered.map((s) => {
                const totalMins = s.is_running
                  ? diffMinutes(s.start_time, new Date())
                  : s.end_time ? diffMinutes(s.start_time, s.end_time) : 0;
                const netMins = Math.max(0, totalMins - s.dashboard_minutes);
                return (
                  <tr key={s.id} className="border-t border-border/40 hover:bg-white/[0.03]">
                    <td className="px-3 py-2.5">{new Date(s.start_time).toLocaleDateString("en-GB")}</td>
                    <td className="px-3 py-2.5">{new Date(s.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-3 py-2.5">{s.end_time ? new Date(s.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : s.is_running ? <span className="inline-flex items-center gap-1 text-success"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> live</span> : "—"}</td>
                    <td className="px-3 py-2.5 font-medium">{fmtMins(totalMins)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{fmtMins(s.dashboard_minutes)}</td>
                    <td className="px-3 py-2.5 font-semibold text-info">{fmtMins(netMins)}</td>
                    <td className="px-3 py-2.5">{s.td_account ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      {s.project_url ? (
                        <a href={s.project_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          {s.project_name ?? s.project_url} <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : s.project_name ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button onClick={() => removeSession.mutate(s.id)} className="text-muted-foreground hover:text-destructive" aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <span className="hidden">{tick}</span>
    </div>
  );
}

function StatCard({ label, value, hint, tone = "primary" }: { label: string; value: string; hint?: string; tone?: "primary" | "cool" | "warm" }) {
  const grad = tone === "cool" ? "gradient-cool" : tone === "warm" ? "gradient-warm" : "gradient-blue";
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className={`h-2 w-10 rounded-full ${grad}`} />
      </div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function LiveTimerCard({
  running, onStart, onStop, starting, stopping,
}: {
  running: Session | undefined;
  onStart: (p: { project_name: string; td_account: string; project_url?: string }) => void;
  onStop: (s: Session) => void;
  starting: boolean; stopping: boolean;
}) {
  const [project, setProject] = useState("");
  const [account, setAccount] = useState("");
  const [url, setUrl] = useState("");

  const elapsed = running ? diffMinutes(running.start_time, new Date()) : 0;

  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex items-center gap-4">
          <div className={`grid h-14 w-14 place-items-center rounded-2xl ${running ? "gradient-cool" : "gradient-blue"} ${running ? "" : "glow-blue"}`}>
            <Clock className={`h-7 w-7 text-white ${running ? "animate-pulse" : ""}`} />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {running ? "Live session" : "Ready to start"}
            </div>
            <div className="font-display text-3xl font-bold">
              {running ? fmtMins(elapsed) : "00h 00m"}
            </div>
            {running && (
              <div className="mt-1 text-xs text-muted-foreground">
                {running.project_name ?? "Untitled"} • started {new Date(running.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
          </div>
        </div>

        {running ? (
          <Button size="lg" className="gradient-warm text-white" disabled={stopping} onClick={() => onStop(running)}>
            <Square className="mr-2 h-4 w-4" /> Stop & Save
          </Button>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1">
              <Label className="text-xs">Project</Label>
              <Input value={project} onChange={(e) => setProject(e.target.value)} placeholder="Buffet Tout" className="h-9 w-40" />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">TD Account</Label>
              <Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="Roadcoderr Diu" className="h-9 w-40" />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">URL (optional)</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="h-9 w-52" />
            </div>
            <Button className="gradient-blue text-white glow-blue" disabled={starting} onClick={() => onStart({ project_name: project, td_account: account, project_url: url })}>
              <Play className="mr-2 h-4 w-4" /> Start Timer
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function AddSessionDialog({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("11:00");
  const [dashMin, setDashMin] = useState("0");
  const [project, setProject] = useState("");
  const [account, setAccount] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("not signed in");
      const s = new Date(`${date}T${start}`);
      const e = new Date(`${date}T${end}`);
      if (e <= s) e.setDate(e.getDate() + 1); // overnight
      const dash = Math.max(0, parseInt(dashMin || "0", 10) || 0);
      const total = Math.max(0, diffMinutes(s, e) - dash);
      const { error } = await supabase.from("work_sessions").insert({
        user_id: u.user.id,
        start_time: s.toISOString(),
        end_time: e.toISOString(),
        dashboard_minutes: dash,
        total_minutes: total,
        project_name: project || null,
        td_account: account || null,
        project_url: url || null,
        notes: notes || null,
        is_running: false,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["work_sessions"] }); toast.success("Session added"); setOpen(false); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gradient-blue text-white glow-blue"><Plus className="mr-1.5 h-4 w-4" /> Add Session</Button>
      </DialogTrigger>
      <DialogContent className="glass-panel border-0 sm:max-w-lg">
        <DialogHeader><DialogTitle>Add work session</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>Dashboard (min)</Label><Input type="number" min={0} value={dashMin} onChange={(e) => setDashMin(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>Start time</Label><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>End time</Label><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          <div className="grid gap-1.5 sm:col-span-2"><Label>Project name</Label><Input value={project} onChange={(e) => setProject(e.target.value)} placeholder="Buffet Tout" /></div>
          <div className="grid gap-1.5"><Label>TD Account</Label><Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="Roadcoderr Diu" /></div>
          <div className="grid gap-1.5"><Label>URL</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></div>
          <div className="grid gap-1.5 sm:col-span-2"><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button className="gradient-blue text-white" disabled={add.isPending} onClick={() => add.mutate()}>Save session</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
