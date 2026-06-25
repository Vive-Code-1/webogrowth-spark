import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { bnRelative } from "@/lib/format";
import { ListSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Tasks · WeboGrowth" }] }),
  component: Tasks,
});

function Tasks() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"low"|"medium"|"high">("medium");
  const [dueDate, setDueDate] = useState("");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Login required");
      const { error } = await supabase.from("tasks").insert({
        user_id: user.id, title, priority,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Task added"); setTitle(""); setDueDate(""); qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from("tasks").update({
        status: done ? "done" : "pending",
        completed_at: done ? new Date().toISOString() : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("tasks").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
  });

  const prio = { high: "bg-destructive/20 text-destructive", medium: "bg-warning/20 text-warning", low: "bg-info/20 text-info" };
  const prioLabel = { high: "High", medium: "Medium", low: "Low" };

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Tasks</h1><p className="text-muted-foreground mt-1">Manage today's work.</p></div>

      <form onSubmit={(e)=>{e.preventDefault(); if(title.trim()) add.mutate();}} className="glass rounded-2xl p-4 grid gap-3 md:grid-cols-[1fr_140px_180px_auto]">
        <Input placeholder="New task..." value={title} onChange={(e)=>setTitle(e.target.value)} />
        <Select value={priority} onValueChange={(v: any)=>setPriority(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Input type="datetime-local" value={dueDate} onChange={(e)=>setDueDate(e.target.value)} />
        <Button type="submit" className="gradient-primary text-white"><Plus className="h-4 w-4 mr-1"/>Add</Button>
      </form>

      {isLoading ? <ListSkeleton title={false} /> : (
        <div className="space-y-2">
          {tasks.length === 0 && <p className="text-muted-foreground">No tasks yet.</p>}
          {tasks.map((t) => {
            const done = t.status === "done";
            return (
              <div key={t.id} className={`glass rounded-xl p-4 flex items-center gap-3 ${done ? "opacity-60" : ""}`}>
                <button onClick={()=>toggle.mutate({ id: t.id, done: !done })} className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 ${done ? "bg-success border-success" : "border-muted-foreground/40"}`}>
                  {done && <Check className="h-4 w-4 text-background"/>}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`font-medium ${done ? "line-through" : ""}`}>{t.title}</div>
                  {t.due_date && <div className="text-xs text-muted-foreground mt-0.5">{bnRelative(t.due_date)}</div>}
                </div>
                <span className={`text-xs rounded-full px-2 py-0.5 ${prio[t.priority]}`}>{prioLabel[t.priority]}</span>
                <Button variant="ghost" size="icon" onClick={()=>del.mutate(t.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
