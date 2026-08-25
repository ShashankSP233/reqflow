import { useEffect, useRef } from "react";
import { Shell } from "@/components/layout/Shell";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RoleProvider, useAuth } from "@/context/RoleContext";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import RequisitionsList from "@/pages/RequisitionsList";
import CreateRequisition from "@/pages/CreateRequisition";
import RequisitionDetail from "@/pages/RequisitionDetail";
import Analytics from "@/pages/Analytics";
import SetupCompanies from "@/pages/SetupCompanies";
import SetupUsers from "@/pages/SetupUsers";
import { ApiError } from "@workspace/api-client-react";

// A 401/403/404 is a definitive rejection, not a transient blip — retrying
// it a few times with backoff (React Query's default) just makes the page
// look stuck or frozen for several seconds before it finally gives up.
// Only retry errors that might actually succeed on a second attempt.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 3;
      },
    },
  },
});

function Router() {
  return (
    <Shell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/requisitions" component={RequisitionsList} />
        <Route path="/requisitions/new" component={CreateRequisition} />
        <Route path="/requisitions/:id" component={RequisitionDetail} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/setup/companies" component={SetupCompanies} />
        <Route path="/setup/users" component={SetupUsers} />
        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const hasCheckedOnce = useRef(false);
  const prevUserId = useRef<number | null>(null);

  useEffect(() => {
    if (isLoading) return; // still doing the initial /auth/me check — nothing to compare yet

    if (hasCheckedOnce.current && prevUserId.current !== (user?.id ?? null)) {
      // The logged-in identity just changed (a fresh login, a logout, or one
      // person handing the computer to the next) — always land on a clean
      // screen rather than showing whatever page the previous person
      // happened to be on, since this computer is shared across the team.
      setLocation("/");
    }
    hasCheckedOnce.current = true;
    prevUserId.current = user?.id ?? null;
  }, [isLoading, user?.id, setLocation]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Loading...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RoleProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthGate>
              <Router />
            </AuthGate>
          </WouterRouter>
          <Toaster />
        </RoleProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
