import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuestionList } from "@/components/questions/QuestionList";
import { PaginationControls } from "@/components/PaginationControls";
import { useI18n } from "@/lib/i18n";
import type { DraftQuestion, Question } from "@/components/questions/types";
import { QUESTION_PAGE_SIZE } from "./useQuestionsPage";

type Props = {
  questions: Question[];
  loadingQs: boolean;
  questionTotal: number;
  questionPage: number;
  search: string;
  usageCounts: Map<string, number>;
  lastUsed: Map<string, string>;
  selectedCatName: string;
  selectedSubName: string;
  onSearch: (v: string) => void;
  onPageChange: (p: number) => void;
  onUpdate: (id: string, draft: DraftQuestion) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddQuestion: () => void;
};

export function QuestionsTab({
  questions,
  loadingQs,
  questionTotal,
  questionPage,
  search,
  usageCounts,
  lastUsed,
  selectedCatName,
  selectedSubName,
  onSearch,
  onPageChange,
  onUpdate,
  onDelete,
  onAddQuestion,
}: Props) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground break-anywhere">
        {selectedCatName} <span className="px-1">›</span>
        <span className="text-foreground font-semibold">{selectedSubName}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3">
        <div className="relative flex-1 w-full sm:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t("cat.searchQuestions")}
            className="pl-9 h-11"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearch("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <Button
          onClick={onAddQuestion}
          className="h-11 gap-2 bg-gradient-primary text-primary-foreground shadow-glow shrink-0 w-full sm:w-auto"
        >
          <Plus className="size-4" /> {t("cat.addQuestion")}
        </Button>
      </div>

      {questionTotal > 0 && (
        <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl border border-border bg-card/40 px-4 py-3">
            <div className="font-display text-xl font-bold">{questionTotal}</div>
            <div className="text-xs text-muted-foreground">{t("cat.totalQuestions")}</div>
          </div>
          <div className="rounded-xl border border-border bg-card/40 px-4 py-3">
            <div className="font-display text-xl font-bold">
              {Array.from(usageCounts.entries())
                .filter(([id]) => questions.some((q) => q.id === id))
                .reduce((s, [, v]) => s + v, 0)}
            </div>
            <div className="text-xs text-muted-foreground">{t("cat.timesUsed")}</div>
          </div>
          <div className="rounded-xl border border-border bg-card/40 px-4 py-3">
            <div className="font-display text-xl font-bold">
              {questions.filter((q) => !usageCounts.has(q.id)).length}
            </div>
            <div className="text-xs text-muted-foreground">{t("cat.neverUsed")}</div>
          </div>
        </div>
      )}

      <QuestionList
        questions={questions}
        loading={loadingQs}
        onUpdate={onUpdate}
        onDelete={onDelete}
        usageCounts={usageCounts}
        lastUsed={lastUsed}
      />
      <PaginationControls
        page={questionPage}
        pageSize={QUESTION_PAGE_SIZE}
        total={questionTotal}
        label="questions"
        onPageChange={onPageChange}
      />
    </div>
  );
}
