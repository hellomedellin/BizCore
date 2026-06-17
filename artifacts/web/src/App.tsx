import { Switch, Route, Redirect } from "wouter";
import { SignIn, SignUp, useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { useAuthToken } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { EmployeePortalLayout } from "@/components/layout/EmployeePortalLayout";

// Dashboard pages
import { OnboardingPage } from "@/pages/OnboardingPage";
import { DashboardHomePage } from "@/pages/DashboardHomePage";
import { MenuPage } from "@/pages/MenuPage";
import { IngredientsPage } from "@/pages/IngredientsPage";
import { StockPage } from "@/pages/StockPage";
import { SalesPage } from "@/pages/SalesPage";
import { EmployeesPage } from "@/pages/EmployeesPage";
import { TimeTrackingPage } from "@/pages/TimeTrackingPage";
import { SchedulingPage } from "@/pages/SchedulingPage";
import { PurchasesPage } from "@/pages/PurchasesPage";
import { SuppliersPage } from "@/pages/SuppliersPage";
import { CustomersPage } from "@/pages/CustomersPage";
import { ConsumptionProfilesPage } from "@/pages/ConsumptionProfilesPage";
import { SettingsPage } from "@/pages/SettingsPage";

// Employee portal pages
import { MeHomePage } from "@/pages/me/MeHomePage";
import { MeTimeOffPage } from "@/pages/me/MeTimeOffPage";
import { MeSchedulePage } from "@/pages/me/MeSchedulePage";

export default function App() {
  useAuthToken();
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Switch>
          <Route path="/sign-up" component={() => <SignUp routing="hash" />} />
          <Route component={() => <SignIn routing="hash" />} />
        </Switch>
      </div>
    );
  }

  return (
    <Switch>
      {/* Employee portal */}
      <Route path="/me">
        <EmployeePortalLayout>
          <MeHomePage />
        </EmployeePortalLayout>
      </Route>
      <Route path="/me/time-off">
        <EmployeePortalLayout>
          <MeTimeOffPage />
        </EmployeePortalLayout>
      </Route>
      <Route path="/me/schedule">
        <EmployeePortalLayout>
          <MeSchedulePage />
        </EmployeePortalLayout>
      </Route>

      {/* Onboarding */}
      <Route path="/onboarding" component={OnboardingPage} />

      {/* Admin dashboard */}
      <Route path="/dashboard">
        <DashboardLayout>
          <DashboardHomePage />
        </DashboardLayout>
      </Route>
      <Route path="/dashboard/menu">
        <DashboardLayout>
          <MenuPage />
        </DashboardLayout>
      </Route>
      <Route path="/dashboard/ingredients">
        <DashboardLayout>
          <IngredientsPage />
        </DashboardLayout>
      </Route>
      <Route path="/dashboard/stock">
        <DashboardLayout>
          <StockPage />
        </DashboardLayout>
      </Route>
      <Route path="/dashboard/sales">
        <DashboardLayout>
          <SalesPage />
        </DashboardLayout>
      </Route>
      <Route path="/dashboard/employees">
        <DashboardLayout>
          <EmployeesPage />
        </DashboardLayout>
      </Route>
      <Route path="/dashboard/time-tracking">
        <DashboardLayout>
          <TimeTrackingPage />
        </DashboardLayout>
      </Route>
      <Route path="/dashboard/scheduling">
        <DashboardLayout>
          <SchedulingPage />
        </DashboardLayout>
      </Route>
      <Route path="/dashboard/purchasing">
        <DashboardLayout>
          <PurchasesPage />
        </DashboardLayout>
      </Route>
      <Route path="/dashboard/suppliers">
        <DashboardLayout>
          <SuppliersPage />
        </DashboardLayout>
      </Route>
      <Route path="/dashboard/customers">
        <DashboardLayout>
          <CustomersPage />
        </DashboardLayout>
      </Route>
      <Route path="/dashboard/consumption-profiles">
        <DashboardLayout>
          <ConsumptionProfilesPage />
        </DashboardLayout>
      </Route>
      <Route path="/dashboard/settings">
        <DashboardLayout>
          <SettingsPage />
        </DashboardLayout>
      </Route>

      {/* Default redirect — route new users without a business through onboarding */}
      <Route>
        <PostAuthRedirect />
      </Route>
    </Switch>
  );
}

// Decide where a freshly-authenticated user lands: the dashboard if they already
// have a business, otherwise the onboarding wizard to create their first one.
function PostAuthRedirect() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["businesses", "me"],
    queryFn: () => api.get("/businesses/me").then((r) => r.data),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
      </div>
    );
  }

  return <Redirect to={isError || !data ? "/onboarding" : "/dashboard"} />;
}
