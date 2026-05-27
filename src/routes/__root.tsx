// react-doctor-disable-next-line react-doctor/tanstack-start-missing-head-content
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { Toaster } from "@/components/ui/sonner";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { RootShell } from "./root/RootShell";
import { NotFoundComponent } from "./root/NotFoundComponent";

import appCss from "../styles.css?url";

// react-doctor-disable-next-line react-doctor/only-export-components
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Jancho | AI-Powered Platform to Evaluate Your Knowledge & Skills" },
      {
        name: "description",
        content:
          "Jancho is an AI-powered smart platform that evaluates your knowledge and skills through live assessments, instant AI grading, and deep analytics. For educators, trainers, HR teams, and beyond.",
      },
      { property: "og:title", content: "Jancho | AI-Powered Platform to Evaluate Your Knowledge & Skills" },
      {
        property: "og:description",
        content:
          "Jancho is an AI-powered smart platform that evaluates your knowledge and skills through live assessments, instant AI grading, and deep analytics. For educators, trainers, HR teams, and beyond.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Jancho | AI-Powered Platform to Evaluate Your Knowledge & Skills" },
      {
        name: "twitter:description",
        content:
          "Jancho is an AI-powered smart platform that evaluates your knowledge and skills through live assessments, instant AI grading, and deep analytics. For educators, trainers, HR teams, and beyond.",
      },
      { property: "og:image", content: "/jancho_logo_512.svg" },
      { name: "twitter:image", content: "/jancho_logo_512.svg" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "icon", type: "image/svg+xml", href: "/jancho_logo_512.svg" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

// react-doctor-disable-next-line react-doctor/only-export-components
function RootComponent() {
  return (
    <I18nProvider>
      <AuthProvider>
        <ProfileProvider>
          <NotificationProvider>
            <Outlet />
            <Toaster />
          </NotificationProvider>
        </ProfileProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
