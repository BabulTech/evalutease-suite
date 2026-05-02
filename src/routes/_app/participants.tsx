import { createFileRoute } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { Users } from "lucide-react";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_app/participants")({ component: () => {
  const { t } = useI18n();
  return <Placeholder icon={Users} title={t("nav.participants")} description="Add, import, and group participants for your quizzes." />;
}});
