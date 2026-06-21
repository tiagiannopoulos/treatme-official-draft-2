import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { ScanProvider } from "@/lib/scan-store";
import { TopBar } from "@/components/treatme/TopBar";
import { BottomNav } from "@/components/treatme/BottomNav";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6 text-center">
      <div className="max-w-sm">
        <p className="brand-eyebrow">404</p>
        <h1 className="brand-display text-5xl mt-3">page not found.</h1>
        <p className="mt-3 text-ink-mute">that route doesn't exist.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-full bg-ink text-cream h-12 px-6 font-semibold lowercase">go home</Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-6 text-center">
      <div className="max-w-sm">
        <p className="brand-eyebrow">something broke</p>
        <h1 className="brand-display text-3xl mt-3">couldn't get a clear read.</h1>
        <p className="mt-3 text-ink-mute text-sm">try again — it usually works on the second go.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-full bg-ink text-cream h-11 px-5 font-semibold lowercase"
          >try again</button>
          <a href="/" className="rounded-full border border-ink h-11 px-5 grid place-items-center font-semibold lowercase">go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#FCFBF7" },
      { title: "treatme — get treated." },
      { name: "description", content: "skin analysis. treatment discovery. provider matching. the gold standard marketplace for medical aesthetics." },
      { property: "og:title", content: "treatme — get treated." },
      { property: "og:description", content: "skin analysis. treatment discovery. provider matching." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-cream text-ink">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ScanProvider>
        <div className="min-h-screen flex flex-col bg-cream">
          <TopBar />
          <main className="flex-1 pb-28">
            <Outlet />
          </main>
          <BottomNav />
        </div>
        <Toaster position="top-center" />
      </ScanProvider>
    </QueryClientProvider>
  );
}
