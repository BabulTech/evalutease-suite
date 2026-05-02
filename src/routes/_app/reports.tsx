import { createFileRoute } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { BarChart3 } from "lucide-react";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_app/reports")({ component: () => {
  const { t } = useI18n();
  return <Placeholder icon={BarChart3} title={t("nav.reports")} description="Leaderboards, score breakdowns, and exportable reports." />;
}});
