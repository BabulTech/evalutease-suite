import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n";
import type { DifficultyCustom } from "./types";
import { QUIZ_TYPES } from "./types";

export function QuizConfigStep({
  quizType,
  setQuizType,
  diffCustom,
  setDiffCustom,
  errors,
  setErrors,
}: {
  quizType: string;
  setQuizType: (v: string) => void;
  diffCustom: DifficultyCustom;
  setDiffCustom: (fn: (p: DifficultyCustom) => DifficultyCustom) => void;
  errors: { quizType?: string };
  setErrors: (
    fn: (p: Record<string, string | undefined>) => Record<string, string | undefined>,
  ) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="rounded-2xl border border-border bg-muted/10 p-4 space-y-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <span className="size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
          2
        </span>
        {t("newSess.step2")}
      </div>

      <div>
        <Label className="mb-2 text-xs text-muted-foreground font-medium">
          {t("newSess.quizType")} <span className="text-destructive">*</span>
        </Label>
        <p className="text-[11px] text-muted-foreground mb-2">{t("newSess.quizTypeHint")}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {QUIZ_TYPES.map((qt) => (
            <button
              key={qt.value}
              type="button"
              onClick={() => {
                setQuizType(qt.value === quizType ? "" : qt.value);
                setErrors((p) => ({ ...p, quizType: undefined }));
              }}
              className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all min-h-[72px] ${
                quizType === qt.value
                  ? "border-primary bg-primary/10 text-primary shadow-glow"
                  : "border-border bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              } ${errors.quizType ? "ring-1 ring-destructive" : ""}`}
            >
              <span className="text-xs font-semibold leading-tight">{qt.label}</span>
              <span className="text-[10px] leading-tight opacity-70">{qt.desc}</span>
            </button>
          ))}
        </div>
        {errors.quizType && <p className="mt-1 text-xs text-destructive">{errors.quizType}</p>}
      </div>

      <div className="rounded-xl border border-border bg-card/40 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{t("newSess.customDifficulty")}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {t("newSess.customDifficultyDesc")}
            </div>
          </div>
          <Switch
            checked={diffCustom.enabled}
            onCheckedChange={(v) => setDiffCustom((p) => ({ ...p, enabled: v }))}
          />
        </div>
        {diffCustom.enabled && (
          <div className="grid grid-cols-3 gap-3 pt-1 border-t border-border">
            {(["easy", "medium", "hard"] as const).map((level) => {
              const colors = {
                easy: "text-success",
                medium: "text-primary",
                hard: "text-destructive",
              };
              return (
                <div key={level}>
                  <label className={`text-xs font-semibold capitalize ${colors[level]} mb-1 block`}>
                    {level === "easy" ? "🟢" : level === "medium" ? "🟡" : "🔴"} {level}
                  </label>
                  <p className="text-[10px] text-muted-foreground mb-1">
                    {t("newSess.numberOfQuestionsLabel")}
                  </p>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={diffCustom[level]}
                    onChange={(e) =>
                      setDiffCustom((p) => ({ ...p, [level]: Math.max(0, Number(e.target.value)) }))
                    }
                    className="h-8 text-sm"
                  />
                </div>
              );
            })}
            <div className="col-span-3 text-xs text-muted-foreground">
              {t("newSess.diffTotal").replace(
                "{n}",
                String(diffCustom.easy + diffCustom.medium + diffCustom.hard),
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
