import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Users, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/_admin/admin")({
  head: () => ({ meta: [{ title: "Admin · WeboGrowth Planner" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [{ count: users }, { count: admins }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin"),
      ]);
      return { users: users ?? 0, admins: admins ?? 0 };
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl gradient-blue glow-primary">
          <ShieldCheck className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Admin Console</h1>
          <p className="text-sm text-muted-foreground">শুধুমাত্র অ্যাডমিনদের জন্য সুরক্ষিত এরিয়া।</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div className="text-sm text-muted-foreground">Total users</div>
          </div>
          <div className="mt-2 text-3xl font-bold">{stats?.users ?? "—"}</div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <Crown className="h-5 w-5 text-warning" />
            <div className="text-sm text-muted-foreground">Admins</div>
          </div>
          <div className="mt-2 text-3xl font-bold">{stats?.admins ?? "—"}</div>
        </div>
      </div>
    </div>
  );
}
