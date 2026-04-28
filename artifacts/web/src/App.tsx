import { useEffect, useRef, type ReactElement } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from '@clerk/react';
import { shadcn } from '@clerk/themes';
import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from 'wouter';
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { useGetMyBusiness, getGetMyBusinessQueryKey } from "@workspace/api-client-react";
import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "@/components/ui/toaster";

import Home from "./pages/home";
import SignInPage from "./pages/auth/sign-in";
import SignUpPage from "./pages/auth/sign-up";
import Onboarding from "./pages/onboarding";
import Dashboard from "./pages/dashboard";
import Settings from "./pages/settings";
import Locations from "./pages/locations";
import ItemsPage from "./pages/items";
import InventoryPage from "./pages/inventory";
import OrdersPage from "./pages/orders";
import StubPage from "./pages/stub";
import { AppLayout } from "./components/layout/app-layout";
import NotFound from "./pages/not-found";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(186 80% 28%)",
    colorForeground: "hsl(222 47% 11%)",
    colorMutedForeground: "hsl(215 16% 47%)",
    colorDanger: "hsl(0 84% 60%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInput: "hsl(214 32% 91%)",
    colorInputForeground: "hsl(222 47% 11%)",
    colorNeutral: "hsl(214 32% 91%)",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-2xl font-bold tracking-tight text-foreground",
    headerSubtitle: "text-muted-foreground text-sm",
    socialButtonsBlockButtonText: "text-sm font-medium",
    formFieldLabel: "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
    footerActionLink: "text-primary font-medium hover:text-primary/90",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground text-xs",
    identityPreviewEditButton: "text-primary hover:text-primary/90",
    formFieldSuccessText: "text-sm text-green-600",
    alertText: "text-sm",
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

type LayoutRouteProps = {
  path: string;
  component: () => ReactElement;
};

// Routes wrapper that forces layout
function LayoutRoute({ component: Component, path }: LayoutRouteProps) {
  return (
    <Route path={path}>
      {() => (
        <AppLayout>
          <Component />
        </AppLayout>
      )}
    </Route>
  );
}

// Sync Clerk user profile to local DB on every sign-in session
function UserSyncEffect() {
  const { user, isLoaded, isSignedIn } = useUser();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user || syncedRef.current) return;
    syncedRef.current = true;
    const primaryEmail = user.primaryEmailAddress?.emailAddress;
    if (!primaryEmail) return;
    fetch("/api/users/sync", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: primaryEmail,
        firstName: user.firstName ?? undefined,
        lastName: user.lastName ?? undefined,
        imageUrl: user.imageUrl ?? undefined,
      }),
    }).catch(() => {
      // Best-effort sync — don't block the UI on failure
    });
  }, [isLoaded, isSignedIn, user]);

  return null;
}

// Handle the portal access check
function PortalRouter() {
  const { isLoaded, isSignedIn } = useUser();
  const { data: business, isLoading: isLoadingBusiness, error } = useGetMyBusiness({
    query: {
      enabled: isLoaded && !!isSignedIn,
      retry: false,
      queryKey: getGetMyBusinessQueryKey(),
    }
  });

  if (!isLoaded || (isSignedIn && isLoadingBusiness)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Redirect to="/" />;
  }

  // If user has no business (404), force them to onboarding (unless already there)
  if (error && error.status === 404) {
    return (
      <Switch>
        <Route path="/onboarding" component={Onboarding} />
        <Route path="*">
          <Redirect to="/onboarding" />
        </Route>
      </Switch>
    );
  }

  // User is signed in and has a business
  return (
    <Switch>
      <Route path="/onboarding">
        <Redirect to="/dashboard" />
      </Route>
      <LayoutRoute path="/dashboard" component={Dashboard} />
      <LayoutRoute path="/settings" component={Settings} />
      <LayoutRoute path="/locations" component={Locations} />
      <LayoutRoute path="/orders" component={OrdersPage} />
      <LayoutRoute path="/items" component={ItemsPage} />
      <LayoutRoute path="/inventory" component={InventoryPage} />
      <LayoutRoute path="/employees" component={() => <StubPage title="Employees" description="Manage your staff, roles, and payroll information." />} />
      <LayoutRoute path="/schedule" component={() => <StubPage title="Schedule" description="Create and manage shift schedules." />} />
      <LayoutRoute path="/time-tracking" component={() => <StubPage title="Time Tracking" description="Monitor employee timecards and approvals." />} />
      <LayoutRoute path="/reports" component={() => <StubPage title="Reports" description="View detailed business analytics and insights." />} />
      <Route path="*">
        <NotFound />
      </Route>
    </Switch>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Home />
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: "Welcome back", subtitle: "Sign in to BizCore" } },
        signUp: { start: { title: "Create your account", subtitle: "Get started with BizCore today" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <UserSyncEffect />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="*">
            <PortalRouter />
          </Route>
        </Switch>
        <Toaster />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="bizcore-ui-theme">
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </ThemeProvider>
  );
}

export default App;
