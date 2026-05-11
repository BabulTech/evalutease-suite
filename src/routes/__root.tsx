import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { Toaster } from "@/components/ui/sonner";
import { ProfileProvider } from "@/contexts/ProfileContext";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90 transition"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Babul.Quiz — Premium Live Quiz Platform" },
      { name: "description", content: "Create, run, and analyze live quizzes for students, teams, and events. Live mode and QR/link sessions, multilingual." },
      { property: "og:title", content: "Babul.Quiz — Premium Live Quiz Platform" },
      { property: "og:description", content: "Create, run, and analyze live quizzes for students, teams, and events. Live mode and QR/link sessions, multilingual." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Babul.Quiz — Premium Live Quiz Platform" },
      { name: "twitter:description", content: "Create, run, and analyze live quizzes for students, teams, and events. Live mode and QR/link sessions, multilingual." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/193ece12-b840-4daa-99c5-09247ead6a06/id-preview-8b6aa23c--670faacf-1228-4bc2-9900-19f5bae1658a.lovable.app-1777735469352.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/193ece12-b840-4daa-99c5-09247ead6a06/id-preview-8b6aa23c--670faacf-1228-4bc2-9900-19f5bae1658a.lovable.app-1777735469352.png" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <I18nProvider>
      <AuthProvider>
        <ProfileProvider>
          <Outlet />
          <Toaster position="top-right" />
        </ProfileProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
