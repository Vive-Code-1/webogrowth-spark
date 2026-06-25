import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Layout,
});

function HeaderAvatar() {
  const { data } = useQuery({
    queryKey: ["profile-mini"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data: p } = await supabase.from("profiles").select("display_name, avatar_url").eq("id", u.user.id).maybeSingle();
      let signed: string | null = null;
      if (p?.avatar_url) {
        const { data: s } = await supabase.storage.from("avatars").createSignedUrl(p.avatar_url, 3600);
        signed = s?.signedUrl ?? null;
      }
      return { name: p?.display_name ?? u.user.email ?? "User", url: signed };
    },
  });
  const initial = (data?.name ?? "U").trim().charAt(0).toUpperCase();
  return (
    <Link to="/settings" className="ml-auto flex items-center gap-2.5 rounded-full bg-white/5 px-2 py-1 ring-1 ring-white/10 transition hover:bg-white/10">
      <Avatar className="h-8 w-8">
        {data?.url && <AvatarImage src={data.url} alt={data?.name ?? "avatar"} />}
        <AvatarFallback className="gradient-blue text-xs font-bold text-white">{initial}</AvatarFallback>
      </Avatar>
      <div className="hidden pr-1 sm:block">
        <div className="text-xs font-semibold leading-none">{data?.name ?? "User"}</div>
        <div className="mt-0.5 text-[10px] text-muted-foreground">Admin</div>
      </div>
    </Link>
  );
}

function HeaderBreadcrumb() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const seg = pathname.split("/").filter(Boolean).pop() ?? "dashboard";
  const label = seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const today = new Date().toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" });
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
      <Link to="/dashboard" className="hover:text-foreground">Home</Link>
      <span>/</span>
      <span className="truncate text-foreground">{label}</span>
      <span className="mx-1 hidden sm:inline">·</span>
      <CalendarDays className="hidden h-4 w-4 sm:inline" />
      <span className="hidden truncate sm:inline">{today}</span>
    </div>
  );
}

function Layout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/70 px-4 backdrop-blur-md">
            <SidebarTrigger />
            <HeaderBreadcrumb />
            <HeaderAvatar />
          </header>
          <main className="flex-1 p-4 md:p-8"><Outlet /></main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
