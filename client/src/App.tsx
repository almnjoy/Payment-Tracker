import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";

import ClientDashboard from "@/pages/client/Dashboard";
import ClientPayments from "@/pages/client/Payments";
import ClientDocuments from "@/pages/client/Documents";
import ClientProfile from "@/pages/client/Profile";

import AdminDashboard from "@/pages/admin/Dashboard";
import AdminClients from "@/pages/admin/Clients";
import ClientDetail from "@/pages/admin/ClientDetail";
import AdminDocuments from "@/pages/admin/Documents";
import AdminInvoices from "@/pages/admin/Invoices";
import AdminSettings from "@/pages/admin/Settings";
import AccountSummaries from "@/pages/admin/AccountSummaries";
import SpendingHabits from "@/pages/admin/SpendingHabits";
import FinanceTracker from "@/pages/admin/FinanceTracker";

function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/forgot-password" component={LoginPage} /> {/* Placeholder */}
      
      {/* Client Routes */}
      <Route path="/client/dashboard" component={ClientDashboard} />
      <Route path="/client/payments" component={ClientPayments} />
      <Route path="/client/documents" component={ClientDocuments} />
      <Route path="/client/profile" component={ClientProfile} />
      
      {/* Admin Routes */}
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/clients" component={AdminClients} />
      <Route path="/admin/clients/:id" component={ClientDetail} />
      <Route path="/admin/documents" component={AdminDocuments} />
      <Route path="/admin/invoices" component={AdminInvoices} />
      <Route path="/admin/settings" component={AdminSettings} />
      
      {/* New Admin Finance Routes */}
      <Route path="/admin/accounts" component={AccountSummaries} />
      <Route path="/admin/spending" component={SpendingHabits} />
      <Route path="/admin/finance" component={FinanceTracker} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
