import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/ideas")({
  head: () => ({ meta: [{ title: "আইডিয়া · WeboGrowth" }] }),
  component: Ideas,
});

function Ideas() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tag, setTag] = useState("general");

  const { data: ideas = [], isLoading } = useQuery({
    queryKey: ["ideas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ideas").select("*").order("created_at", { ascending: false });
      if (error) throw error; return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("লগইন প্রয়োজন");
      const { error } = await supabase.from("ideas").insert({ user_id: user.id, title, content, tag });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("আইডিয়া সেভ হয়েছে"); setTitle(""); setContent(""); qc.invalidateQueries({ queryKey: ["ideas"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("ideas").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ideas"] }),
  });

  const tagColors = ["gradient-primary","gradient-warm","gradient-cool"];

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">আইডিয়া বোর্ড</h1><p className="text-muted-foreground mt-1">প্রতিটি স্পার্ক ধরে রাখুন।</p></div>

      <form onSubmit={(e)=>{e.preventDefault(); if(title.trim()) add.mutate();}} className="glass rounded-2xl p-4 space-y-3">
        <Input placeholder="আইডিয়ার শিরোনাম..." value={title} onChange={(e)=>setTitle(e.target.value)} />
        <Textarea placeholder="বিস্তারিত..." value={content} onChange={(e)=>setContent(e.target.value)} rows={3} />
        <div className="flex gap-3">
          <Input placeholder="ট্যাগ" value={tag} onChange={(e)=>setTag(e.target.value)} className="max-w-[200px]" />
          <Button type="submit" className="gradient-primary text-white"><Plus className="h-4 w-4 mr-1"/>সেভ করুন</Button>
        </div>
      </form>

      {isLoading ? <p className="text-muted-foreground">লোড হচ্ছে...</p> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ideas.length === 0 && <p className="text-muted-foreground">কোনো আইডিয়া নেই।</p>}
          {ideas.map((i, idx) => (
            <div key={i.id} className="glass rounded-2xl p-5 group relative">
              <div className={`mb-3 inline-block rounded-full px-3 py-1 text-xs text-white ${tagColors[idx % 3]}`}>{i.tag}</div>
              <h3 className="font-semibold">{i.title}</h3>
              {i.content && <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{i.content}</p>}
              <button onClick={()=>del.mutate(i.id)} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition"><Trash2 className="h-4 w-4 text-destructive"/></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
