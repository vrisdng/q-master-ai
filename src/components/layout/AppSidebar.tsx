import { NavLink } from "react-router-dom";
import { ClipboardList, Home, Settings, UserCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
};

const navItems: NavItem[] = [
  { to: "/", label: "Homepage", icon: Home, end: true },
  { to: "/profile", label: "Profile", icon: UserCircle2 },
  { to: "/tests", label: "Test Arena", icon: ClipboardList },
  { to: "/settings", label: "Settings", icon: Settings },
];

interface AppSidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export const AppSidebar = ({ className, onNavigate }: AppSidebarProps) => (
  <nav
    className={cn(
      "flex h-full w-64 shrink-0 flex-col border-r border-border bg-background/95 px-3 py-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80",
      className,
    )}
    aria-label="Main navigation"
  >
    <div className="mb-8 px-3">
      <p className="text-sm font-semibold text-foreground">Q-Master AI</p>
      <p className="text-xs text-muted-foreground">Navigate your workspace</p>
    </div>
    <div className="flex flex-1 flex-col gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )
            }
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </div>
  </nav>
);

AppSidebar.displayName = "AppSidebar";

