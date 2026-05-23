import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Calendar, ChevronLeft, Globe, Lock, QrCode, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n";
import { useNewSession } from "./sessions.new/useNewSession";
import { CategoryStep } from "./sessions.new/CategoryStep";
import { QuizConfigStep } from "./sessions.new/QuizConfigStep";
import { ScheduleSection } from "./sessions.new/ScheduleSection";
import { SubtypeCombobox } from "./sessions.new/SubtypeCombobox";

// react-doctor-disable-next-line react-doctor/only-export-components
export const Route = createFileRoute("/_app/sessions/new")({ component: NewSessionPage });

// react-doctor-disable-next-line react-doctor/only-export-components
function NewSessionPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const {
    categories,
    subcategories,
    types,
    subtypes,
    loading,
    isLocked,
    plan,
    planLoading,
    title,
    setTitle,
    categoryId,
    setCategoryId,
    subcategoryId,
    setSubcategoryId,
    subQuestionCount,
    useAllQuestions,
    setUseAllQuestions,
    numQuestions,
    setNumQuestions,
    pickStrategy,
    setPickStrategy,
    quizType,
    setQuizType,
    diffCustom,
    setDiffCustom,
    isPublic,
    selectedSubtypeIds,
    showResultsAfterQuiz,
    setShowResultsAfterQuiz,
    scheduleEnabled,
    setScheduleEnabled,
    scheduledAtLocal,
    setScheduledAtLocal,
    busy,
    errors,
    setErrors,
    categoryNameById: _categoryNameById,
    typeNameById,
    selectedSubcategoryLabel,
    noSubcategories,
    toggleSubtype,
    submit,
    handlePublicChange,
  } = useNewSession();

  if (!planLoading && isLocked("quizzes_per_day")) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-5">
        <div className="mx-auto size-16 rounded-2xl bg-destructive/15 flex items-center justify-center">
          <Lock className="size-8 text-destructive" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold">{t("newSess.limitTitle")}</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Your <span className="font-semibold text-foreground">{plan?.name ?? "Free"}</span>{" "}
            {t("newSess.limitDesc").replace("{n}", String(plan?.quizzes_per_day ?? 3))}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Link
            to="/settings"
            search={{ tab: "plan" }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-primary text-primary-foreground shadow-glow px-4 py-2 font-semibold text-sm hover:opacity-90"
          >
            <Zap className="size-4" /> {t("newSess.upgradePlan")}
          </Link>
          <Button variant="ghost" onClick={() => void navigate({ to: "/sessions" })}>
            {t("newSess.backToSessions")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link
          to="/sessions"
          className="hover:text-foreground transition-colors flex items-center gap-1"
        >
          <QrCode size={12} /> {t("newSess.allSessions")}
        </Link>
        <ChevronLeft className="size-3 rotate-180 shrink-0" />
        <span className="text-foreground font-medium">{t("newSess.title")}</span>
      </nav>

      <div className="rounded-2xl border border-border bg-card/60 p-5 flex items-center gap-4">
        <div className="size-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-glow shrink-0">
          <QrCode className="size-6" />
        </div>
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight">
            {t("newSess.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("newSess.desc")}</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          Loading…
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card/60 p-5 md:p-6 space-y-5">
          <div>
            <Label className="mb-1.5">
              {t("newSess.titleLabel")} <span className="text-destructive">*</span>
            </Label>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setErrors((p) => ({ ...p, title: undefined }));
              }}
              placeholder={t("newSess.titlePlaceholder")}
              maxLength={200}
              className={errors.title ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title}</p>}
          </div>

          <CategoryStep
            categories={categories}
            subcategories={subcategories}
            categoryId={categoryId}
            setCategoryId={setCategoryId}
            subcategoryId={subcategoryId}
            setSubcategoryId={setSubcategoryId}
            selectedSubcategoryLabel={selectedSubcategoryLabel}
            subQuestionCount={subQuestionCount}
            quizType={quizType}
            useAllQuestions={useAllQuestions}
            setUseAllQuestions={setUseAllQuestions}
            numQuestions={numQuestions}
            setNumQuestions={setNumQuestions}
            pickStrategy={pickStrategy}
            setPickStrategy={setPickStrategy}
            errors={errors}
            setErrors={setErrors}
          />

          <QuizConfigStep
            quizType={quizType}
            setQuizType={setQuizType}
            diffCustom={diffCustom}
            setDiffCustom={setDiffCustom}
            errors={errors}
            setErrors={setErrors}
          />

          <div className="rounded-2xl border border-border bg-card/40 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="show-results-switch" className="text-sm font-semibold">
                  Announce Results After Quiz
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {showResultsAfterQuiz
                    ? "Participants will see their score and percentage when the quiz ends."
                    : "Participants will NOT see their score. The host announces results manually."}
                </p>
              </div>
              <Switch
                id="show-results-switch"
                checked={showResultsAfterQuiz}
                onCheckedChange={setShowResultsAfterQuiz}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {isPublic ? (
                  <Globe className="size-4 text-primary" />
                ) : (
                  <Lock className="size-4 text-warning" />
                )}
                <div>
                  <Label htmlFor="public-switch" className="text-sm font-semibold">
                    {t("newSess.public")}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("newSess.publicDesc")}</p>
                </div>
              </div>
              <Switch
                id="public-switch"
                checked={isPublic}
                onCheckedChange={(v) => {
                  handlePublicChange(v);
                  setErrors((p) => ({ ...p, subtypes: undefined }));
                }}
              />
            </div>

            {!isPublic && (
              <div className="pt-3 border-t border-border space-y-2">
                <Label>{t("newSess.selectSubTypes")}</Label>
                <SubtypeCombobox
                  types={types}
                  subtypes={subtypes}
                  selectedIds={selectedSubtypeIds}
                  onToggle={toggleSubtype}
                  typeNameById={typeNameById}
                  hasError={!!errors.subtypes}
                />
                {errors.subtypes && <p className="text-xs text-destructive">{errors.subtypes}</p>}
                {selectedSubtypeIds.size > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {Array.from(selectedSubtypeIds).map((id) => {
                      const s = subtypes.find((x) => x.id === id);
                      if (!s) return null;
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-2 py-0.5 text-xs"
                        >
                          {typeNameById.get(s.type_id) ?? "?"} → {s.name}
                          <button
                            type="button"
                            onClick={() => toggleSubtype(id)}
                            className="hover:bg-primary/20 rounded-full p-0.5"
                            aria-label={`Remove ${s.name}`}
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                {!errors.subtypes && (
                  <p className="text-xs text-muted-foreground">{t("newSess.subtypesNote")}</p>
                )}
              </div>
            )}
          </div>

          <ScheduleSection
            scheduleEnabled={scheduleEnabled}
            setScheduleEnabled={setScheduleEnabled}
            scheduledAtLocal={scheduledAtLocal}
            setScheduledAtLocal={setScheduledAtLocal}
            errors={errors}
            setErrors={setErrors}
          />

          <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-border">
            <Button
              onClick={() => void submit(scheduleEnabled ? "schedule" : "open")}
              disabled={busy || noSubcategories}
              className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow"
            >
              {scheduleEnabled ? <Calendar className="size-4" /> : <Zap className="size-4" />}
              {busy
                ? t("newSess.saving")
                : scheduleEnabled
                  ? t("newSess.schedule")
                  : t("newSess.saveOpenLobby")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
