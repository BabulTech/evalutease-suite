import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, FolderOpen, HelpCircle, Plus, ChevronUp, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { QuestionList } from "@/components/questions/QuestionList";
import { PaginationControls } from "@/components/PaginationControls";
import {
  useSubCategoryQuestions,
  QUESTION_PAGE_SIZE,
} from "./categories.$categoryId.$subId/useSubCategoryQuestions";
import { AddQuestionsPanel } from "./categories.$categoryId.$subId/AddQuestionsPanel";

// react-doctor-disable-next-line react-doctor/only-export-components
export const Route = createFileRoute("/_app/categories/$categoryId/$subId")({
  component: SubCategoryQuestionsPage,
});

// react-doctor-disable-next-line react-doctor/only-export-components
function SubCategoryQuestionsPage() {
  const { categoryId, subId } = Route.useParams();
  const { user } = useAuth();
  const { t } = useI18n();

  const [tab, setTab] = useState("manual");
  const [page, setPage] = useState(0);
  const [addOpen, setAddOpen] = useState(false);

  const {
    category,
    sub,
    questions,
    loadingQs,
    saving,
    questionTotal,
    saveDrafts,
    updateQuestion,
    deleteQuestion,
  } = useSubCategoryQuestions(user, categoryId, subId, page, () => setAddOpen(false));

  const diffBreakdown = {
    easy: questions.filter((q) => q.difficulty === "easy").length,
    medium: questions.filter((q) => q.difficulty === "medium").length,
    hard: questions.filter((q) => q.difficulty === "hard").length,
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
        <Link
          to="/categories"
          className="hover:text-foreground transition-colors flex items-center gap-1"
        >
          <BookOpen size={12} /> {t("q.allCategories")}
        </Link>
        <ChevronLeft className="size-3 rotate-180 shrink-0" />
        <Link
          to="/categories/$categoryId"
          params={{ categoryId }}
          className="hover:text-foreground transition-colors"
        >
          {category?.name ?? t("q.category")}
        </Link>
        <ChevronLeft className="size-3 rotate-180 shrink-0" />
        <span className="text-foreground font-medium">{sub?.name ?? t("q.topic")}</span>
      </nav>

      {/* Hero header */}
      <div className="rounded-2xl border border-border bg-card/60 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <FolderOpen className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight truncate">
              {sub?.name ?? t("q.topic")}
            </h1>
            {sub?.description && (
              <p className="text-muted-foreground text-sm mt-0.5 line-clamp-1">{sub.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-3 py-1.5">
            <HelpCircle size={13} className="text-primary" />
            <span className="text-sm font-bold">{questionTotal}</span>
            <span className="text-xs text-muted-foreground">
              {questionTotal === 1 ? "question" : "questions"}
            </span>
          </div>
          {questionTotal > 0 && (
            <div className="hidden sm:flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-1.5">
              {diffBreakdown.easy > 0 && (
                <span className="text-xs font-semibold text-success">{diffBreakdown.easy}E</span>
              )}
              {diffBreakdown.medium > 0 && (
                <span className="text-xs font-semibold text-primary">{diffBreakdown.medium}M</span>
              )}
              {diffBreakdown.hard > 0 && (
                <span className="text-xs font-semibold text-destructive">
                  {diffBreakdown.hard}H
                </span>
              )}
            </div>
          )}
          <Button
            type="button"
            onClick={() => setAddOpen((v) => !v)}
            className="h-10 gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
          >
            {addOpen ? <ChevronUp size={15} /> : <Plus size={15} />}
            {addOpen ? "Hide" : "Add Questions"}
          </Button>
        </div>
      </div>

      {/* Add Questions Panel */}
      {addOpen && (
        <AddQuestionsPanel tab={tab} onTabChange={setTab} saving={saving} onSave={saveDrafts} />
      )}

      {/* Questions list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("q.questionsInTopic")}
          </h2>
          {questionTotal > QUESTION_PAGE_SIZE && (
            <span className="text-xs text-muted-foreground">
              Page {page + 1} of {Math.ceil(questionTotal / QUESTION_PAGE_SIZE)}
            </span>
          )}
        </div>

        <QuestionList
          questions={questions}
          loading={loadingQs}
          onUpdate={updateQuestion}
          onDelete={deleteQuestion}
        />

        <PaginationControls
          page={page}
          pageSize={QUESTION_PAGE_SIZE}
          total={questionTotal}
          label="questions"
          onPageChange={(p) => {
            setPage(p);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      </div>
    </div>
  );
}
