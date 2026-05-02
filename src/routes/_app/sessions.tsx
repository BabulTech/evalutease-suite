import { createFileRoute } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { PlayCircle } from "lucide-react";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_app/sessions")({ component: () => {
  const { t } = useI18n();
  return <Placeholder icon={PlayCircle} title={t("nav.sessions")} description="Multi-step quiz session wizard with QR / link mode coming next." />;
}});
