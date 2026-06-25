import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus, Trash2, Flame, Bell } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { bnRelative, urgencyLevel } from "@/lib/format";
import { ListSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/_authenticated/challenges")({
  head: () => ({ meta: [{ title: "Challenges · WeboGrowth" }] }),
  component: Challenges,
});

const urgencyClass: Record<string, string> = {
  calm: "from-info/20 to-info/5 text-info",
  warn: "from-warning/30 to-warning/5 text-warning",
  urgent: "from-pink/30 to-pink/5 text-pink",
  critical: "from-destructive/40 to-destructive/10 text-destructive animate-pulse",
};

function Challenges() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) { setNotifPerm("unsupported"); return; }
    setNotifPerm(Notification.permission);
  }, []);

  const askNotif = async () => {
    if (!("Notification" in window)) return;
    const p = await Notification.requestPermission();
    setNotifPerm(p);
    if (p === "granted") toast.success("Notifications enabled");
  };

  const { data: challenges = [], isLoading } = useQuery({
    queryKey: ["challenges"],
    queryFn: async () => {
      const { data, error } = await supabase.from("challenges").select("*").order("deadline", { ascending: true });
      if (error) throw error; return data;
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (notifPerm !== "granted") return;
    const fire = () => {
      challenges.forEach((c) => {
        if (c.status !== "active") return;
        const hours = (new Date(c.deadline).getTime() - Date.now()) / 3600000;
        if (hours > 0 && hours < 24) {
          try { new Notification(`⚡ ${c.title}`, { body: bnRelative(c.deadline), tag: c.id }); } catch {}
        }
      });
    };
    fire();
    const u = urgencyLevel(challenges[0]?.deadline ?? new Date());
    const intervalMs = u === "critical" ? 5*60*1000 : u === "urgent" ? 15*60*1000 : 60*60*1000;
    const id = setInterval(fire, intervalMs);
    return () => clearInterval(id);
  }, [challenges, notifPerm]);

  const add = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Login required");
      const { error } = await supabase.from("challenges").insert({
        user_id: user.id, title, description,
        deadline: new Date(deadline).toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Challenge added 🔥"); setTitle(""); setDescription(""); setDeadline(""); qc.invalidateQueries({ queryKey: ["challenges"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const complete = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("challenges").update({ status: "completed" }).eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("🎉 Nice work!"); qc.invalidateQueries({ queryKey: ["challenges"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("challenges").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["challenges"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Flame className="text-pink"/>Challenges</h1>
          <p className="text-muted-foreground mt-1">Race the deadline, get reminders.</p>
        </div>
        {notifPerm !== "granted" && notifPerm !== "unsupported" && (
          <Button onClick={askNotif} variant="outline"><Bell className="h-4 w-4 mr-1"/>Enable reminders</Button>
        )}
      </div>

      <form onSubmit={(e)=>{e.preventDefault(); if(title.trim() && deadline) add.mutate();}} className="glass rounded-2xl p-4 space-y-3">
        <Input placeholder="Challenge name..." value={title} onChange={(e)=>setTitle(e.target.value)} />
        <Textarea placeholder="Details..." value={description} onChange={(e)=>setDescription(e.target.value)} rows={2} />
        <div className="flex flex-wrap gap-3">
          <Input type="datetime-local" required value={deadline} onChange={(e)=>setDeadline(e.target.value)} className="max-w-[240px]" />
          <Button type="submit" className="gradient-warm text-white"><Plus className="h-4 w-4 mr-1"/>Add challenge</Button>
        </div>
      </form>

      {isLoading ? <ListSkeleton title={false} rows={4} /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {challenges.length === 0 && <p className="text-muted-foreground">No challenges yet.</p>}
          {challenges.map((c) => {
            const u = urgencyLevel(c.deadline);
            const done = c.status === "completed";
            return (
              <div key={c.id} className={`glass rounded-2xl p-5 bg-gradient-to-br ${urgencyClass[u]} ${done ? "opacity-50" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground text-lg">{c.title}</h3>
                  <button onClick={()=>del.mutate(c.id)}><Trash2 className="h-4 w-4 text-destructive"/></button>
                </div>
                {c.description && <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-lg font-bold">{bnRelative(c.deadline)}</span>
                  {!done && <Button size="sm" onClick={()=>complete.mutate(c.id)} className="gradient-cool text-white">Done</Button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
