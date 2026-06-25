import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { bnDate } from "@/lib/format";
import { ListSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/_authenticated/plans")({
  head: () => ({ meta: [{ title: "Plans · WeboGrowth" }] }),
  component: Plans,
});

function Plans() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").order("created_at", { ascending: false });
      if (error) throw error; return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Login required");
      const { error } = await supabase.from("plans").insert({
        user_id: user.id, title, description,
        target_date: targetDate || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Plan added"); setTitle(""); setDescription(""); setTargetDate(""); qc.invalidateQueries({ queryKey: ["plans"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateProgress = useMutation({
    mutationFn: async ({ id, progress }: { id: string; progress: number }) => {
      const { error } = await supabase.from("plans").update({ progress, status: progress >= 100 ? "completed" : "active" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["plans"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("plans").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plans"] }),
  });

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Plans</h1><p className="text-muted-foreground mt-1">Set goals and track progress.</p></div>

      <form onSubmit={(e)=>{e.preventDefault(); if(title.trim()) add.mutate();}} className="glass rounded-2xl p-4 space-y-3">
        <Input placeholder="Plan title..." value={title} onChange={(e)=>setTitle(e.target.value)} />
        <Textarea placeholder="Details..." value={description} onChange={(e)=>setDescription(e.target.value)} rows={2} />
        <div className="flex gap-3">
          <Input type="date" value={targetDate} onChange={(e)=>setTargetDate(e.target.value)} className="max-w-[200px]" />
          <Button type="submit" className="gradient-primary text-white"><Plus className="h-4 w-4 mr-1"/>Add</Button>
        </div>
      </form>

      {isLoading ? <ListSkeleton title={false} /> : (
        <div className="space-y-4">
          {plans.length === 0 && <p className="text-muted-foreground">No plans yet.</p>}
          {plans.map((p) => (
            <div key={p.id} className="glass rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold">{p.title}</h3>
                  {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}
                  {p.target_date && <p className="mt-1 text-xs text-muted-foreground">Target: {bnDate(p.target_date)}</p>}
                </div>
                <Button variant="ghost" size="icon" onClick={()=>del.mutate(p.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-2"><span>Progress</span><span className="font-semibold text-gradient">{p.progress}%</span></div>
                <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
                  <div className="h-full gradient-primary transition-all" style={{ width: `${p.progress}%` }}/>
                </div>
                <Slider value={[p.progress]} max={100} step={5} onValueChange={(v)=>updateProgress.mutate({ id: p.id, progress: v[0] })} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
