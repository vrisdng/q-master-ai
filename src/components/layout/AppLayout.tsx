import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { cn } from "@/lib/utils";

const AppLayout = () => {
  const { user, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAuthenticated = Boolean(user);
  const shouldShowSidebar = !loading && isAuthenticated;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen w-full">
        {shouldShowSidebar && (
          <div className="hidden md:flex">
            <AppSidebar />
          </div>
        )}

        <div className={cn("flex min-h-screen flex-1 flex-col", shouldShowSidebar ? "bg-muted/10" : "")}>
          {shouldShowSidebar && (
            <header className="flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:hidden">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Menu className="h-5 w-5" aria-hidden="true" />
                    <span className="sr-only">Open navigation</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 border-border p-0">
                  <AppSidebar
                    className="h-full border-r-0 border-t-0 shadow-none"
                    onNavigate={() => setMobileOpen(false)}
                  />
                </SheetContent>
              </Sheet>
              <span className="text-sm font-semibold text-muted-foreground">Navigation</span>
            </header>
          )}

          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
