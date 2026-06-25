import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings · WeboGrowth" }] }),
  component: Settings,
});

function Settings() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [notif, setNotif] = useState(true);
  const [email, setEmail] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      setEmail(user.email ?? "");
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (profile) { setDisplayName(profile.display_name ?? ""); setNotif(profile.notifications_enabled); }
  }, [profile]);

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ display_name: displayName, notifications_enabled: notif }).eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["profile"] });
  };

  const signOut = async () => {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div><h1 className="text-3xl font-bold">Settings</h1><p className="text-muted-foreground mt-1">Profile and preferences.</p></div>

      <div className="glass rounded-2xl p-5 space-y-4">
        <div><Label>Email</Label><Input value={email} disabled /></div>
        <div><Label>Name</Label><Input value={displayName} onChange={(e)=>setDisplayName(e.target.value)} /></div>
        <div className="flex items-center justify-between">
          <div><Label>Notifications</Label><p className="text-xs text-muted-foreground">Challenge deadline reminders</p></div>
          <Switch checked={notif} onCheckedChange={setNotif} />
        </div>
        <Button onClick={save} className="gradient-primary text-white">Save</Button>
      </div>

      <div className="glass rounded-2xl p-5">
        <Button variant="destructive" onClick={signOut}>Log out</Button>
      </div>
    </div>
  );
}
