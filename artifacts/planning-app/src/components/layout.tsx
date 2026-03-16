import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  Truck, 
  CalendarDays, 
  Building2,
  Menu,
  Settings,
  Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface LayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/plans", label: "Planification", icon: CalendarDays },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/employees", label: "Personnel", icon: Users },
  { href: "/pickups", label: "Flotte Véhicules", icon: Truck },
];

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center px-6 border-b border-sidebar-border shadow-sm">
        <div className="flex items-center gap-2 text-primary font-display font-bold text-xl tracking-tight">
          <div className="bg-primary/20 p-1.5 rounded-lg">
            <CalendarDays className="h-6 w-6 text-primary" />
          </div>
          PlanifPro
        </div>
      </div>
      <div className="flex-1 overflow-auto py-6 px-4">
        <nav className="flex flex-col gap-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium
                  ${isActive 
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground hover-elevate"}
                `}
              >
                <item.icon className={`h-5 w-5 ${isActive ? "text-primary-foreground" : ""}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="p-4 border-t border-sidebar-border mt-auto">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent cursor-pointer transition-colors">
          <Settings className="h-5 w-5" />
          <span className="font-medium">Paramètres</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-background font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-72 shrink-0 border-r border-border fixed h-full z-20">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:pl-72 min-h-screen">
        {/* Top Header */}
        <header className="no-print h-16 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 sticky top-0 z-10">
          <div className="flex items-center lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="mr-2">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72 border-none">
                <SidebarContent />
              </SheetContent>
            </Sheet>
            <div className="font-display font-bold text-lg">PlanifPro</div>
          </div>
          
          <div className="flex items-center gap-4 ml-auto">
            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-destructive border-2 border-card"></span>
            </Button>
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-primary to-accent text-primary-foreground flex items-center justify-center font-bold text-sm shadow-sm cursor-pointer hover:shadow-md transition-shadow">
              AD
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
