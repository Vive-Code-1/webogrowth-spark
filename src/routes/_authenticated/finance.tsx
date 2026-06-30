import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Wallet, TrendingUp, TrendingDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "Finance · WeboGrowth" }] }),
  component: Finance,
});

type Txn = {
  id: string; txn_date: string; type: "income" | "expense";
  amount: number; category: string; description: string | null;
};

function monthKey(d: string | Date) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

const CAT_COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#ec4899", "#10b981", "#a78bfa", "#fb7185"];

function Finance() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(monthKey(new Date()));
  const [open, setOpen] = useState(false);

  const { data: txns = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*").order("txn_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Txn[];
    },
  });

  const months = useMemo(() => {
    const set = new Set<string>([monthKey(new Date())]);
    txns.forEach((t) => set.add(monthKey(t.txn_date)));
    return Array.from(set).sort().reverse();
  }, [txns]);

  const filtered = txns.filter((t) => monthKey(t.txn_date) === month);
  const income = filtered.filter((t) => t.type === "income").reduce((a, t) => a + Number(t.amount), 0);
  const expense = filtered.filter((t) => t.type === "expense").reduce((a, t) => a + Number(t.amount), 0);
  const net = income - expense;

  const expByCat = useMemo(() => {
    const m = new Map<string, number>();
    filtered.filter((t) => t.type === "expense").forEach((t) => {
      m.set(t.category, (m.get(t.category) ?? 0) + Number(t.amount));
    });
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transactions"] }); toast.success("Deleted"); },
  });

  return (
    <div className="mx-auto w-full max-w-full min-w-0 space-y-6 overflow-hidden">
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-bold sm:text-4xl">Finance</h1>
          <p className="mt-1 text-muted-foreground">আয় ও ব্যয় এন্ট্রি করুন — মাস শেষে নিজেই দেখবেন কতো সেভ হলো।</p>
        </div>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="glass-card w-full border-0 sm:w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>{months.map((k) => <SelectItem key={k} value={k}>{monthLabel(k)}</SelectItem>)}</SelectContent>
          </Select>
          <AddTxnDialog open={open} setOpen={setOpen} />
        </div>
      </div>

      {/* stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <FinanceStat label="Income" value={fmtMoney(income)} icon={TrendingUp} tone="cool" />
        <FinanceStat label="Expense" value={fmtMoney(expense)} icon={TrendingDown} tone="warm" />
        <FinanceStat label="Net savings" value={fmtMoney(net)} icon={Wallet} tone={net >= 0 ? "primary" : "danger"} />
      </div>

      <div className="grid min-w-0 gap-6 overflow-hidden lg:grid-cols-3">
        {/* chart */}
        <section className="glass-panel min-w-0 overflow-hidden rounded-2xl p-4 sm:p-5 lg:col-span-1">
          <h2 className="mb-3 font-display text-lg font-semibold">Expense by category</h2>
          {expByCat.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No expenses yet this month.</p>
          ) : (
            <div className="h-56 min-w-0 overflow-hidden sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expByCat} dataKey="value" nameKey="name" innerRadius="38%" outerRadius="68%" paddingAngle={3}>
                    {expByCat.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "oklch(0.18 0.04 265)", border: "1px solid oklch(1 0 0 / 0.15)", borderRadius: 8, color: "#fff", padding: "6px 10px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
                    itemStyle={{ color: "#fff", textTransform: "capitalize" }}
                    labelStyle={{ color: "#fff", textTransform: "capitalize" }}
                    formatter={(v: any, name: any) => [fmtMoney(v), String(name).charAt(0).toUpperCase() + String(name).slice(1)]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-3 min-w-0 space-y-1.5">
            {expByCat.map((c, i) => (
              <div key={c.name} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
                  <span className="min-w-0 truncate capitalize">{c.name}</span>
                </div>
                <span className="shrink-0 font-medium">{fmtMoney(c.value)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* list */}
        <section className="glass-panel min-w-0 overflow-hidden rounded-2xl p-4 sm:p-5 lg:col-span-2">
          <h2 className="mb-3 font-display text-lg font-semibold">{monthLabel(month)} — Transactions</h2>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">কোনো এন্ট্রি নেই। উপরে "Add" দিয়ে শুরু করুন।</p>
          ) : (
            <ul className="min-w-0 space-y-2">
              {filtered.map((t) => (
                <li key={t.id} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/5 sm:flex sm:items-center">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${t.type === "income" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
                    {t.type === "income" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{t.description || t.category}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="capitalize">{t.category}</span> · {new Date(t.txn_date).toLocaleDateString("en-GB")}
                    </div>
                  </div>
                  <div className="col-start-2 flex min-w-0 items-center justify-between gap-2 sm:col-start-auto sm:ml-auto sm:shrink-0 sm:justify-end">
                    <div className={`min-w-0 truncate text-sm font-semibold sm:text-base ${t.type === "income" ? "text-success" : "text-destructive"}`}>
                      {t.type === "income" ? "+" : "−"}{fmtMoney(t.amount)}
                    </div>
                    <button
                      onClick={() => remove.mutate(t.id)}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
                      aria-label="Delete"
                      disabled={remove.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function FinanceStat({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: "cool" | "warm" | "primary" | "danger" }) {
  const grad = tone === "cool" ? "gradient-cool" : tone === "warm" ? "gradient-warm" : tone === "danger" ? "bg-destructive" : "gradient-blue";
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-2 text-3xl font-bold">{value}</div>
        </div>
        <div className={`grid h-11 w-11 place-items-center rounded-xl ${grad}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

const CATEGORIES = ["project", "salary", "client", "freelance", "food", "bills", "rent", "transport", "shopping", "other"];

function AddTxnDialog({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("project");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const add = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("not signed in");
      const amt = parseFloat(amount);
      if (!amt || amt <= 0) throw new Error("Amount required");
      const { error } = await supabase.from("transactions").insert({
        user_id: u.user.id, txn_date: date, type, amount: amt, category, description: description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Saved");
      setOpen(false); setAmount(""); setDescription("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gradient-blue text-white glow-blue"><Plus className="mr-1.5 h-4 w-4" /> Add</Button>
      </DialogTrigger>
      <DialogContent className="glass-panel border-0 sm:max-w-md">
        <DialogHeader><DialogTitle>Add transaction</DialogTitle></DialogHeader>
        <Tabs value={type} onValueChange={(v) => setType(v as "income" | "expense")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="income">Income</TabsTrigger>
            <TabsTrigger value="expense">Expense</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>Amount (৳)</Label><Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></div>
          <div className="grid gap-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>Description (optional)</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button className="gradient-blue text-white" disabled={add.isPending} onClick={() => add.mutate()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
