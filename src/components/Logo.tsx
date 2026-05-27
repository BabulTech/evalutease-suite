import { useI18n } from "@/lib/i18n";

export function Logo({
  size = "md",
  customLogoUrl,
}: {
  size?: "sm" | "md" | "lg";
  customLogoUrl?: string | null;
}) {
  const { t } = useI18n();
  if (customLogoUrl) {
    return (
      <div className="flex items-center gap-3">
        <img
          src={customLogoUrl}
          alt="Logo"
          className={`object-contain ${size === "sm" ? "h-12 max-w-[96px]" : size === "lg" ? "h-16 max-w-[180px]" : "h-14 max-w-[140px]"}`}
        />
        {size !== "sm" && (
          <div className="flex flex-col leading-tight">
            <span className="font-display text-lg font-bold text-foreground">
              Jan<span className="text-primary">cho</span>
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
      <img
        src="/jancho_logo_512.svg"
        alt="Jancho"
        className={`object-contain ${size === "sm" ? "h-12 w-12" : size === "lg" ? "h-18 w-18" : "h-16 w-16"}`}
      />
      {size !== "sm" && (
        <div className="flex flex-col leading-tight">
          <span className="font-display text-lg font-bold text-foreground">
            Jan<span className="text-primary">cho</span>
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {t("app.tagline")}
          </span>
        </div>
      )}
    </div>
  );
}
