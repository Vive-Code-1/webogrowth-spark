import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Dashboard01Icon, Time04Icon, Wallet01Icon, Analytics01Icon,
  TaskDone01Icon, Bulb01Icon, Maps01Icon, Fire03Icon,
  Settings01Icon, Logout01Icon,
} from "@hugeicons/core-free-icons";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const main = [
  { title: "Dashboard", url: "/dashboard", icon: Dashboard01Icon },
  { title: "Time Tracking", url: "/time-tracking", icon: Time04Icon },
  { title: "Finance", url: "/finance", icon: Wallet01Icon },
  { title: "Reports", url: "/reports", icon: Analytics01Icon },
];
const work = [
  { title: "Tasks", url: "/tasks", icon: TaskDone01Icon },
  { title: "Ideas", url: "/ideas", icon: Bulb01Icon },
  { title: "Plans", url: "/plans", icon: Maps01Icon },
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

  const renderItem = (it: { title: string; url: string; icon: any }) => {
    const active = pathname === it.url;
    return (
      <SidebarMenuItem key={it.url}>
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip={it.title}
          className={active ? "blue-pill text-white hover:text-white" : "hover:bg-white/5"}
        >
          <Link to={it.url}>
            <HugeiconsIcon icon={it.icon} size={20} strokeWidth={1.5} />
            <span>{it.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0 p-3">
      <div className="glass-panel flex h-full flex-col rounded-3xl">
        <SidebarHeader>
          <div className="flex items-center gap-2.5 px-2 py-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl blue-pill">
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
              <SidebarMenuButton
                asChild
                isActive={pathname === "/settings"}
                tooltip="Settings"
                className={pathname === "/settings" ? "blue-pill text-white hover:text-white" : "hover:bg-white/5"}
              >
                <Link to="/settings">
                  <HugeiconsIcon icon={Settings01Icon} size={20} strokeWidth={1.5} />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={signOut} tooltip="Log out" className="hover:bg-white/5">
                <HugeiconsIcon icon={Logout01Icon} size={20} strokeWidth={1.5} />
                <span>Log out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </div>
    </Sidebar>
  );
}
