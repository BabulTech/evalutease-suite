import type { LucideIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function Placeholder({
  icon: Icon, title, description,
}: { icon: LucideIcon; title: string; description: string }) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground mt-1">{description}</p>
      </div>
      <div className="rounded-2xl border border-border border-dashed bg-card/40 p-12 text-center">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 shadow-glow">
          <Icon className="h-7 w-7 text-primary" />
        </div>
        <h3 className="font-display text-xl font-semibold">{t("common.comingSoon")}</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          This area is wired to the backend. The full UI is coming in the next pass - your existing engine will plug in here.
        </p>
      </div>
    </div>
  );
}
