import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  Users,
  BarChart3,
  FolderOpen,
  LogOut,
  Ship,
  Printer,
} from "lucide-react";
import { cn } from "@/lib/format";
import { useRole, useAuth, ROLE_LABELS } from "@/context/RoleContext";

export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useRole();
  const { logout } = useAuth();

  const allNavItems = [
    {
      href: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
      roles: [
        "site_user",
        "checker",
        "approver",
        "purchase_head",
        "purchase_member",
      ],
    },
    {
      href: "/requisitions",
      label: "Requisitions",
      icon: FileText,
      roles: [
        "site_user",
        "checker",
        "approver",
        "purchase_head",
        "purchase_member",
      ],
    },
    {
      href: "/requisitions/print",
      label: "Print Requisitions",
      icon: Printer,
      roles: ["purchase_member"],
    },
    {
      href: "/analytics",
      label: "Analytics",
      icon: BarChart3,
      roles: ["approver", "purchase_head"],
    },
    {
      href: "/setup/companies",
      label: "Sites, Projects & Assets",
      icon: Ship,
      roles: ["purchase_head", "approver"],
    },
    {
      href: "/setup/users",
      label: "Users",
      icon: Users,
      roles: ["purchase_head"],
    },
  ];

  const navItems = allNavItems.filter((n) =>
    n.roles.includes(user.role)
  );

  return (
    <div className="flex h-screen bg-muted/30">
      <aside className="w-64 border-r bg-sidebar flex-shrink-0 hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2 text-sidebar-primary">
            <div className="bg-sidebar-primary text-sidebar-primary-foreground p-1.5 rounded-md">
              <FolderOpen className="w-5 h-5" />
            </div>

            <div>
              <p className="font-bold text-base tracking-tight leading-none">
                ReqFlow
              </p>

              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
                Procurement System
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          {user.role === "site_user" && (
            <div className="mb-4">
              <Link
                href="/requisitions/new"
                className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors py-2.5 rounded-md font-medium text-sm"
                data-testid="button-new-requisition-nav"
              >
                <PlusCircle className="w-4 h-4" />
                New Requisition
              </Link>
            </div>
          )}

          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? location === "/"
                  : location.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                  data-testid={`nav-${item.label
                    .toLowerCase()
                    .replace(/\s/g, "-")}`}
                >
                  <item.icon
                    className={cn(
                      "w-4 h-4 flex-shrink-0",
                      isActive
                        ? "text-sidebar-primary"
                        : "text-sidebar-foreground/50"
                    )}
                  />

                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p
                className="font-medium text-sm truncate"
                data-testid="text-current-user-name"
              >
                {user.name}
              </p>

              <p className="text-xs text-muted-foreground truncate">
                {ROLE_LABELS[user.role]}
                {user.site_name ? ` · ${user.site_name}` : ""}
              </p>
            </div>

            <button
              onClick={() => logout()}
              className="flex-shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
              data-testid="button-logout"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 flex items-center justify-between px-4 border-b bg-background md:hidden">
          <div className="flex items-center gap-2 text-primary font-bold">
            <FolderOpen className="w-5 h-5" />
            <span>ReqFlow</span>
          </div>
        </header>

        <div className="flex-1 overflow-auto bg-background">
          {children}
        </div>
      </main>
    </div>
  );
}