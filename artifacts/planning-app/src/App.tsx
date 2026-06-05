import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Dashboard from "./pages/dashboard";
import ClientsPage from "./pages/clients";
import EmployeesPage from "./pages/employees";
import PickupsPage from "./pages/pickups";
import PlansPage from "./pages/plans";
import PlanDetailPage from "./pages/plan-detail";
import EmployeeDetailPage from "./pages/employee-detail";
import PickupDetailPage from "./pages/pickup-detail";
import InterventionsPage from "./pages/interventions";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/clients" component={ClientsPage} />
      <Route path="/employees" component={EmployeesPage} />
      <Route path="/pickups" component={PickupsPage} />
      <Route path="/plans" component={PlansPage} />
      <Route path="/plans/:id" component={PlanDetailPage} />
      <Route path="/personnel/:id" component={EmployeeDetailPage} />
      <Route path="/vehicules/:id" component={PickupDetailPage} />
      <Route path="/interventions" component={InterventionsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
