import { createFileRoute } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { HelpCircle } from "lucide-react";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_app/questions")({ component: () => {
  const { t } = useI18n();
  return <Placeholder icon={HelpCircle} title={t("nav.questions")} description="Question bank, AI generation, OCR & document import will live here." />;
}});
