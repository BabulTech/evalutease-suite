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
      { title: "Babul.Quiz - Premium Live Quiz Platform" },
      {
        name: "description",
        content:
          "Create, run, and analyze live quizzes for students, teams, and events. Live mode and QR/link sessions, multilingual.",
      },
      { property: "og:title", content: "Babul.Quiz - Premium Live Quiz Platform" },
      {
        property: "og:description",
        content:
          "Create, run, and analyze live quizzes for students, teams, and events. Live mode and QR/link sessions, multilingual.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Babul.Quiz - Premium Live Quiz Platform" },
      {
        name: "twitter:description",
        content:
          "Create, run, and analyze live quizzes for students, teams, and events. Live mode and QR/link sessions, multilingual.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/193ece12-b840-4daa-99c5-09247ead6a06/id-preview-8b6aa23c--670faacf-1228-4bc2-9900-19f5bae1658a.lovable.app-1777735469352.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/193ece12-b840-4daa-99c5-09247ead6a06/id-preview-8b6aa23c--670faacf-1228-4bc2-9900-19f5bae1658a.lovable.app-1777735469352.png",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
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
