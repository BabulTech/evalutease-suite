import { useI18n } from "@/lib/i18n";

export function Logo({ size = "md", customLogoUrl }: { size?: "sm" | "md" | "lg"; customLogoUrl?: string | null }) {
  const { t } = useI18n();
  const dim = size === "lg" ? "h-14 w-14 text-xl" : size === "sm" ? "h-9 w-9 text-sm" : "h-11 w-11 text-base";

  if (customLogoUrl) {
    return (
      <div className="flex items-center gap-3">
        <img
          src={customLogoUrl}
          alt="Logo"
          className={`object-contain rounded-xl ${size === "sm" ? "h-8 max-w-[80px]" : size === "lg" ? "h-12 max-w-[160px]" : "h-10 max-w-[120px]"}`}
        />
        {size !== "sm" && (
          <div className="flex flex-col leading-tight">
            <span className="font-display text-lg font-bold text-foreground">
              Babul<span className="text-primary">.Quiz</span>
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {t("app.tagline")}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className={`${dim} rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center font-display font-bold text-primary shadow-glow`}>
        BQ
      </div>
      {size !== "sm" && (
        <div className="flex flex-col leading-tight">
          <span className="font-display text-lg font-bold text-foreground">
            Babul<span className="text-primary">.Quiz</span>
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {t("app.tagline")}
          </span>
        </div>
      )}
    </div>
  );
}
