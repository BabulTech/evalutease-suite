import { Check, Layers } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import type { CategoryRow, SubcategoryRow, PickStrategy } from "./types";
import { PICK_STRATEGY_DEFS, QUIZ_TYPES } from "./types";

export function CategoryStep({
  categories,
  subcategories,
  categoryId,
  setCategoryId,
  subcategoryId,
  setSubcategoryId,
  selectedSubcategoryLabel,
  subQuestionCount,
  quizType,
  useAllQuestions,
  setUseAllQuestions,
  numQuestions,
  setNumQuestions,
  pickStrategy,
  setPickStrategy,
  errors,
  setErrors,
}: {
  categories: CategoryRow[];
  subcategories: SubcategoryRow[];
  categoryId: string;
  setCategoryId: (id: string) => void;
  subcategoryId: string;
  setSubcategoryId: (id: string) => void;
  selectedSubcategoryLabel: string;
  subQuestionCount: number | null;
  quizType: string;
  useAllQuestions: boolean;
  setUseAllQuestions: (v: boolean) => void;
  numQuestions: number;
  setNumQuestions: (n: number) => void;
  pickStrategy: PickStrategy;
  setPickStrategy: (s: PickStrategy) => void;
  errors: { category?: string };
  setErrors: (
    fn: (p: Record<string, string | undefined>) => Record<string, string | undefined>,
  ) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="rounded-2xl border border-border bg-muted/10 p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <span className="size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
            1
          </span>
          {t("newSess.step1")}
        </div>
        {subcategoryId && (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            <Check className="size-3" /> {selectedSubcategoryLabel}
          </span>
        )}
      </div>

      <div>
        <Label className="mb-2 text-xs text-muted-foreground font-medium">
          {t("newSess.category")} <span className="text-destructive">*</span>
        </Label>
        <p className="text-[11px] text-muted-foreground mb-2">{t("newSess.categoryHint")}</p>
        <div
          className={`flex flex-wrap gap-2 ${errors.category && !categoryId ? "ring-1 ring-destructive rounded-lg p-2" : ""}`}
        >
          {categories.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No categories yet,{" "}
              <Link to="/categories" className="text-primary underline">
                create one first
              </Link>
              .
            </p>
          ) : (
            categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCategoryId(c.id === categoryId ? "" : c.id);
                  setSubcategoryId("");
                  setErrors((p) => ({ ...p, category: undefined }));
                }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px] max-w-full ${
                  categoryId === c.id
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                <span className="truncate">{c.name}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {categoryId && (
        <div>
          <Label className="mb-2 text-xs text-muted-foreground font-medium">
            {t("newSess.subCategory")} <span className="text-destructive">*</span>
          </Label>
          <p className="text-[11px] text-muted-foreground mb-2">{t("newSess.subCategoryHint")}</p>
          <div
            className={`flex flex-wrap gap-2 ${errors.category && categoryId && !subcategoryId ? "ring-1 ring-destructive rounded-lg p-2" : ""}`}
          >
            {subcategories.filter((s) => s.category_id === categoryId).length === 0 ? (
              <p className="text-xs text-muted-foreground">No topics in this category yet.</p>
            ) : (
              subcategories.flatMap((s) =>
                s.category_id !== categoryId
                  ? []
                  : [
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSubcategoryId(s.id === subcategoryId ? "" : s.id);
                          setErrors((p) => ({ ...p, category: undefined }));
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px] max-w-full ${
                          subcategoryId === s.id
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border bg-card/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                        }`}
                      >
                        <span className="truncate">{s.name}</span>
                      </button>,
                    ],
              )
            )}
          </div>
        </div>
      )}

      {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}

      {subcategoryId && subQuestionCount !== null && (
        <div className="rounded-xl border border-border bg-card/40 p-4 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Layers className="size-4 text-primary shrink-0" />
            <span className="text-sm font-semibold">
              {subQuestionCount}{" "}
              {subQuestionCount !== 1 ? t("newSess.questions") : t("newSess.question")}{" "}
              {t("newSess.available")}
            </span>
            {quizType && quizType !== "mixed" && (
              <span className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">
                {QUIZ_TYPES.find((q) => q.value === quizType)?.label ?? quizType} only
              </span>
            )}
            {subQuestionCount === 0 && (
              <span className="text-xs text-destructive">{t("newSess.addQuestionsFirst")}</span>
            )}
          </div>

          {subQuestionCount > 0 && (
            <>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setUseAllQuestions(true)}
                  className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors text-left ${
                    useAllQuestions
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-card/30 text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  <div className="font-semibold">{t("newSess.allQuestions")}</div>
                  <div className="text-[11px] mt-0.5 opacity-80">
                    {t("newSess.allQuestionsDesc").replace("{n}", String(subQuestionCount))}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUseAllQuestions(false);
                    if (numQuestions === 0 || numQuestions > subQuestionCount)
                      setNumQuestions(Math.min(10, subQuestionCount));
                  }}
                  className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors text-left ${
                    !useAllQuestions
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-card/30 text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  <div className="font-semibold">{t("newSess.pickNumber")}</div>
                  <div className="text-[11px] mt-0.5 opacity-80">{t("newSess.pickNumberDesc")}</div>
                </button>
              </div>

              {!useAllQuestions && (
                <div className="space-y-3 pt-1 border-t border-border">
                  <div>
                    <Label className="mb-1.5 text-sm">
                      {t("newSess.numberOfQuestions")}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        ({t("newSess.maxN").replace("{n}", String(subQuestionCount))})
                      </span>
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={subQuestionCount}
                        value={numQuestions}
                        onChange={(e) =>
                          setNumQuestions(
                            Math.max(1, Math.min(subQuestionCount, Number(e.target.value) || 1)),
                          )
                        }
                        className="w-28"
                      />
                      <span className="text-xs text-muted-foreground">
                        {t("newSess.ofNSelected").replace("{n}", String(subQuestionCount))}
                      </span>
                    </div>
                  </div>

                  {numQuestions < subQuestionCount && (
                    <div>
                      <Label className="mb-2 text-sm">{t("newSess.howToPick")}</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {PICK_STRATEGY_DEFS.map((s) => {
                          const Icon = s.icon;
                          return (
                            <button
                              key={s.value}
                              type="button"
                              onClick={() => setPickStrategy(s.value)}
                              className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                                pickStrategy === s.value
                                  ? "border-primary/50 bg-primary/10"
                                  : "border-border bg-card/30 hover:border-primary/30"
                              }`}
                            >
                              <Icon
                                className={`h-4 w-4 mt-0.5 shrink-0 ${pickStrategy === s.value ? "text-primary" : "text-muted-foreground"}`}
                              />
                              <div>
                                <div
                                  className={`text-xs font-semibold ${pickStrategy === s.value ? "text-primary" : ""}`}
                                >
                                  {t(s.labelKey)}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {t(s.descKey)}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
