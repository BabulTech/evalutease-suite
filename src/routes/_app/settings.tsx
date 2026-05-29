import { createFileRoute } from "@tanstack/react-router";
import {
  Settings as SettingsIcon,
  Trophy,
  ListChecks,
  User,
  MessageSquare,
  CreditCard,
  Building2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useHost } from "@/contexts/HostContext";
import { ProfileForm } from "./settings/ProfileForm";
import { PushNotificationsToggle } from "@/components/PushNotificationsToggle";
import { BiometricToggle } from "@/components/BiometricToggle";
import { HostSettingsForm } from "./settings/HostSettingsForm";
import { MessagesForm } from "./settings/MessagesForm";
import { PlanSection } from "./settings/PlanSection";

// react-doctor-disable-next-line react-doctor/only-export-components
export const Route = createFileRoute("/_app/settings")({
  validateSearch: (s: Record<string, unknown>) => ({ tab: (s.tab as string) ?? "profile" }),
  component: SettingsPage,
});

// react-doctor-disable-next-line react-doctor/only-export-components
function SettingsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { isHost } = useHost();

  return (
    <div className="mx-auto max-w-5xl space-y-5 md:space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-semibold flex items-center gap-2">
          <SettingsIcon className="size-6 md:h-7 md:w-7 text-primary" /> {t("nav.settings")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{t("settings.desc")}</p>
      </div>

      <Tabs
        value={tab}
        defaultValue="profile"
        onValueChange={(nextTab) => navigate({ search: (prev) => ({ ...prev, tab: nextTab }) })}
      >
        <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="inline-flex min-w-max h-auto gap-1 bg-muted/60 p-1 rounded-xl">
            <TabsTrigger
              value="profile"
              className="min-h-11 min-w-[104px] gap-1.5 rounded-lg px-3 text-xs sm:text-sm"
            >
              <User className="size-4 shrink-0" />{" "}
              <span className="truncate">{t("settings.profile")}</span>
            </TabsTrigger>
            <TabsTrigger
              value="registration"
              className="min-h-11 min-w-[132px] gap-1.5 rounded-lg px-3 text-xs sm:text-sm"
            >
              <ListChecks className="size-4 shrink-0" />{" "}
              <span className="truncate">{t("settings.registration")}</span>
            </TabsTrigger>
            <TabsTrigger
              value="scoring"
              className="min-h-11 min-w-[104px] gap-1.5 rounded-lg px-3 text-xs sm:text-sm"
            >
              <Trophy className="size-4 shrink-0" />{" "}
              <span className="truncate">{t("settings.scoring")}</span>
            </TabsTrigger>
            <TabsTrigger
              value="messages"
              className="min-h-11 min-w-[112px] gap-1.5 rounded-lg px-3 text-xs sm:text-sm"
            >
              <MessageSquare className="size-4 shrink-0" />{" "}
              <span className="truncate">{t("settings.messages")}</span>
            </TabsTrigger>
            <TabsTrigger
              value="plan"
              className="min-h-11 min-w-[112px] gap-1.5 rounded-lg px-3 text-xs sm:text-sm"
            >
              {isHost ? (
                <Building2 className="size-4 shrink-0" />
              ) : (
                <CreditCard className="size-4 shrink-0" />
              )}
              <span className="truncate">{isHost ? "Workspace" : t("settings.plan")}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profile" className="mt-4 space-y-4">
          {user && <ProfileForm userId={user.id} />}
          <PushNotificationsToggle />
          <BiometricToggle />
        </TabsContent>
        <TabsContent value="registration" className="mt-4">
          {user && <HostSettingsForm userId={user.id} section="registration" />}
        </TabsContent>
        <TabsContent value="scoring" className="mt-4">
          {user && <HostSettingsForm userId={user.id} section="scoring" />}
        </TabsContent>
        <TabsContent value="messages" className="mt-4">
          {user && <MessagesForm userId={user.id} />}
        </TabsContent>
        <TabsContent value="plan" className="mt-4">
          {user && <PlanSection userId={user.id} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
