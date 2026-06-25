import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useRef, useState } from "react";
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setNotif(profile.notifications_enabled);
    setAvatarPath(profile.avatar_url ?? null);
    if (profile.avatar_url) {
      supabase.storage.from("avatars").createSignedUrl(profile.avatar_url, 3600)
        .then(({ data }) => setAvatarUrl(data?.signedUrl ?? null));
    }
  }, [profile]);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Max 5MB");
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { error: pErr } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
      if (pErr) throw pErr;
      const { data: s } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
      setAvatarPath(path);
      setAvatarUrl(s?.signedUrl ?? null);
      qc.invalidateQueries({ queryKey: ["profile-mini"] });
      toast.success("Profile photo updated");
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ display_name: displayName, notifications_enabled: notif }).eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["profile-mini"] });
  };

  const signOut = async () => {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const initial = (displayName || email || "U").trim().charAt(0).toUpperCase();

  return (
    <div className="max-w-2xl space-y-6">
      <div><h1 className="text-3xl font-bold">Settings</h1><p className="text-muted-foreground mt-1">Profile and preferences.</p></div>

      <div className="glass rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 ring-2 ring-primary/40">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="Avatar" />}
            <AvatarFallback className="gradient-blue text-2xl font-bold text-white">{initial}</AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <Label>Profile photo</Label>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? "Uploading..." : avatarPath ? "Change photo" : "Upload photo"}
              </Button>
              {avatarPath && (
                <Button type="button" variant="ghost" onClick={async () => {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) return;
                  await supabase.storage.from("avatars").remove([avatarPath]);
                  await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
                  setAvatarPath(null); setAvatarUrl(null);
                  qc.invalidateQueries({ queryKey: ["profile-mini"] });
                  toast.success("Photo removed");
                }}>Remove</Button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
            <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB</p>
          </div>
        </div>

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
