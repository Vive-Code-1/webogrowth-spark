import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, CheckSquare, Lightbulb, Map, Flame, Settings, LogOut,
  Clock, Wallet, BarChart3,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const main = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Time Tracking", url: "/time-tracking", icon: Clock },
  { title: "Finance", url: "/finance", icon: Wallet },
  { title: "Reports", url: "/reports", icon: BarChart3 },
];
const work = [
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Ideas", url: "/ideas", icon: Lightbulb },
  { title: "Plans", url: "/plans", icon: Map },
  { title: "Challenges", url: "/challenges", icon: Flame },
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

  const renderItem = (it: { title: string; url: string; icon: any }) => (
    <SidebarMenuItem key={it.url}>
      <SidebarMenuButton asChild isActive={pathname === it.url} tooltip={it.title}>
        <Link to={it.url}>
          <it.icon className="h-4 w-4" />
          <span>{it.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl gradient-blue glow-blue">
            <span className="font-display text-base font-black text-white">W</span>
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <div className="font-display text-base font-bold leading-none">WeboGrowth</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Personal HQ</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{main.map(renderItem)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Work</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{work.map(renderItem)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/settings"} tooltip="Settings">
              <Link to="/settings"><Settings className="h-4 w-4" /><span>Settings</span></Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} tooltip="Log out">
              <LogOut className="h-4 w-4" /><span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
