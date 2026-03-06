import { 
  CreditCard, 
  Database, 
  Zap,
  Settings, 
  Activity,
  FileSearch,
  LogIn,
  LogOut,
  Shield,
  BotMessageSquare,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions, ComponentName } from "@/hooks/usePermissions";
import { useActivityLog } from "@/hooks/useActivityLog";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  componentName?: ComponentName;
  requiresAuth?: boolean;
  adminOnly?: boolean;
}

const mainItems: NavItem[] = [
  { title: "Confluence", url: "/confluence", icon: BotMessageSquare, componentName: "confluence", requiresAuth: true },
  { title: "Activity", url: "/activity", icon: Activity, componentName: "activity", requiresAuth: true },
];

const integrationItems: NavItem[] = [
  { title: "WildDeer", url: "/wilddeer", icon: Database, componentName: "wilddeer", requiresAuth: true },
  { title: "Stripe", url: "/stripe", icon: CreditCard, componentName: "stripe", requiresAuth: true },
  { title: "Credits", url: "/credits", icon: Zap, componentName: "credits", requiresAuth: true },
  { title: "Account Lookup", url: "/account-lookup", icon: FileSearch, componentName: "account-lookup", requiresAuth: true },
];

const settingsItems: NavItem[] = [
  { title: "Settings", url: "/settings", icon: Settings, requiresAuth: true },
  { title: "Admin", url: "/admin", icon: Shield, requiresAuth: true, adminOnly: true },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const { hasAccess } = usePermissions();
  const { logActivity } = useActivityLog();

  const handleLogout = async () => {
    await logActivity({ action: "logout" });
    await signOut();
    navigate("/login");
  };

  const filterItems = (items: NavItem[]) => {
    return items.filter(item => {
      // If requires auth and no user, hide
      if (item.requiresAuth && !user) return false;
      
      // If admin only and not admin, hide
      if (item.adminOnly && !isAdmin) return false;
      
      // Check component permission
      if (item.componentName && !hasAccess(item.componentName)) return false;
      
      return true;
    });
  };

  const filteredMainItems = filterItems(mainItems);
  const filteredIntegrationItems = filterItems(integrationItems);
  const filteredSettingsItems = filterItems(settingsItems);

  return (
    <Sidebar className="border-r-2 border-border">
      <SidebarHeader className="p-4 border-b-2 border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary flex items-center justify-center">
            <Database className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">TrajectData</h1>
            <p className="text-xs text-muted-foreground font-mono">Internal Dashboard</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {user && filteredMainItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="font-mono text-xs uppercase tracking-wider">
              Dashboard
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredMainItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to={item.url} 
                        end={item.url === "/"} 
                        className="flex items-center gap-3 px-3 py-2 hover:bg-accent transition-colors"
                        activeClassName="bg-primary text-primary-foreground hover:bg-primary"
                      >
                        <item.icon className="w-4 h-4" />
                        <span className="font-medium">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {user && filteredIntegrationItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="font-mono text-xs uppercase tracking-wider">
              Integrations
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredIntegrationItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to={item.url} 
                        className="flex items-center gap-3 px-3 py-2 hover:bg-accent transition-colors"
                        activeClassName="bg-primary text-primary-foreground hover:bg-primary"
                      >
                        <item.icon className="w-4 h-4" />
                        <span className="font-medium">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="font-mono text-xs uppercase tracking-wider">
            System
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {user ? (
                <>
                  {filteredSettingsItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink 
                          to={item.url} 
                          className="flex items-center gap-3 px-3 py-2 hover:bg-accent transition-colors"
                          activeClassName="bg-primary text-primary-foreground hover:bg-primary"
                        >
                          <item.icon className="w-4 h-4" />
                          <span className="font-medium">{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-accent transition-colors w-full text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="font-medium">Logout</span>
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              ) : (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to="/login" 
                      className="flex items-center gap-3 px-3 py-2 hover:bg-accent transition-colors"
                      activeClassName="bg-primary text-primary-foreground hover:bg-primary"
                    >
                      <LogIn className="w-4 h-4" />
                      <span className="font-medium">Login</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t-2 border-border">
        {user && (
          <div className="mb-2">
            <p className="text-xs text-muted-foreground font-mono truncate">
              {user.email}
            </p>
          </div>
        )}
        <div className="text-xs text-muted-foreground font-mono">
          © 2026 TrajectData
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
