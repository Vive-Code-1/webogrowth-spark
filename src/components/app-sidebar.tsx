import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSquare01Icon, Time04Icon, Wallet01Icon, Analytics01Icon,
  TaskDone01Icon, BulbIcon, MapsIcon, Fire03Icon,
  Settings01Icon, Logout01Icon, ShieldUserIcon,
} from "@hugeicons/core-free-icons";
import { useIsAdmin } from "@/hooks/use-is-admin";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: DashboardSquare01Icon },
  { title: "Time Tracking", url: "/time-tracking", icon: Time04Icon },
  { title: "Finance", url: "/finance", icon: Wallet01Icon },
  { title: "Reports", url: "/reports", icon: Analytics01Icon },
  { title: "Tasks", url: "/tasks", icon: TaskDone01Icon },
  { title: "Ideas", url: "/ideas", icon: BulbIcon },
  { title: "Plans", url: "/plans", icon: MapsIcon },
  { title: "Challenges", url: "/challenges", icon: Fire03Icon },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const Row = ({ it, active }: { it: { title: string; url: string; icon: any }; active: boolean }) => (
    <Link
      to={it.url}
      className={`group relative flex items-center gap-3 rounded-2xl px-2 py-2 transition group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0 ${
        active ? "text-white" : "text-muted-foreground hover:text-white"
      }`}
    >
      {/* icon badge */}
      <span
        className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full transition group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 ${
          active
            ? "blue-pill shadow-[0_0_24px_-4px_rgba(80,140,255,0.7)]"
            : "bg-[#0d1530] ring-1 ring-white/5 group-hover:ring-white/15"
        }`}
      >
        <HugeiconsIcon icon={it.icon} size={18} strokeWidth={1.8} className={active ? "text-white" : "text-white/80"} />
      </span>
      <span className={`text-sm font-medium group-data-[collapsible=icon]:hidden ${active ? "text-white" : ""}`}>
        {it.title}
      </span>
    </Link>
  );

  return (
    <Sidebar collapsible="icon" className="border-r-0 p-3 group-data-[collapsible=icon]:p-1.5">
      <div className="glass-panel relative flex h-full flex-col overflow-hidden rounded-[28px] group-data-[collapsible=icon]:rounded-2xl">
        {/* subtle ambient glow */}
        <div className="pointer-events-none absolute left-2 top-12 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-info/10 blur-3xl" />

        <SidebarHeader className="relative">
          <div className="flex items-center gap-2.5 px-2 py-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8">
              <svg viewBox="0 0 32 32" className="h-7 w-7 group-data-[collapsible=icon]:h-6 group-data-[collapsible=icon]:w-6" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="wglogo" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#6ab1ff" />
                    <stop offset="100%" stopColor="#3b6fe8" />
                  </linearGradient>
                </defs>
                <path d="M6 6 L14 22 L16 16 L18 22 L26 6" stroke="url(#wglogo)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="16" cy="16" r="14" stroke="url(#wglogo)" strokeOpacity="0.25" strokeWidth="1" />
              </svg>
            </div>
            <div className="group-data-[collapsible=icon]:hidden">
              <div className="font-display text-base font-bold leading-none tracking-tight">WeboGrowth</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Personal HQ</div>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="relative">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1.5">
                {items.map((it) => {
                  const active = pathname === it.url;
                  return (
                    <SidebarMenuItem key={it.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={it.title}
                        className="h-auto p-0 hover:bg-transparent data-[active=true]:bg-transparent group-data-[collapsible=icon]:!size-auto group-data-[collapsible=icon]:!p-0"
                      >
                        <Row it={it} active={active} />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="relative">
          {/* soft divider gradient */}
          <div className="mx-2 mb-2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <SidebarMenu className="gap-1.5">
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/settings"}
                tooltip="Settings"
                className="h-auto p-0 hover:bg-transparent data-[active=true]:bg-transparent group-data-[collapsible=icon]:!size-auto group-data-[collapsible=icon]:!p-0"
              >
                <Row it={{ title: "Settings", url: "/settings", icon: Settings01Icon }} active={pathname === "/settings"} />
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={signOut}
                tooltip="Log out"
                className="group h-auto gap-3 rounded-2xl p-2 px-2 text-muted-foreground hover:bg-transparent hover:text-white group-data-[collapsible=icon]:!size-auto group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#0d1530] ring-1 ring-white/5 group-hover:ring-white/15 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8">
                  <HugeiconsIcon icon={Logout01Icon} size={18} strokeWidth={1.8} className="text-white/80" />
                </span>
                <span className="text-sm font-medium group-data-[collapsible=icon]:hidden">Log out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </div>
    </Sidebar>
  );
}
