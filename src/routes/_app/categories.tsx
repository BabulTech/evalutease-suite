import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { useMetaLoader, useQuestionsPage } from "./categories/useQuestionsPage";
import { QuickCreateDialog } from "./categories/QuickCreateDialog";
import { StepTabBar } from "./categories/StepTabBar";
import { CategoryTab } from "./categories/CategoryTab";
import { TopicTab } from "./categories/TopicTab";
import { QuestionsTab } from "./categories/QuestionsTab";

// react-doctor-disable-next-line react-doctor/only-export-components
export const Route = createFileRoute("/_app/categories")({ component: CategoriesRoot });

// react-doctor-disable-next-line react-doctor/only-export-components
function CategoriesRoot() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onIndex = pathname === "/categories" || pathname === "/categories/";
  if (!onIndex) return <Outlet />;
  return <QuestionsPage />;
}

// react-doctor-disable-next-line react-doctor/prefer-useReducer
// react-doctor-disable-next-line react-doctor/only-export-components
function QuestionsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [selectedCat, setSelectedCat] = useState("");
  const [selectedSub, setSelectedSub] = useState("");
  const [search, setSearch] = useState("");
  const [questionPage, setQuestionPage] = useState(0);
  const [activeTab, setActiveTab] = useState<1 | 2 | 3>(1);
  const [catDialog, setCatDialog] = useState(false);
  const [subDialog, setSubDialog] = useState(false);

  const {
    cats,
    setCats,
    subs,
    setSubs,
    subQuestionCounts,
    setSubQuestionCounts,
    catQuestionCounts,
    totalQuestions,
  } = useMetaLoader(user);

  const {
    questions,
    questionTotal,
    loadingQs,
    usageCounts,
    lastUsed,
    updateQuestion,
    deleteQuestion,
  } = useQuestionsPage(user, selectedSub, questionPage, search);

  const filteredSubs = useMemo(
    () => subs.filter((s) => s.category_id === selectedCat),
    [subs, selectedCat],
  );
  const selectedCatName = cats.find((c) => c.id === selectedCat)?.name ?? "";
  const selectedSubName = subs.find((s) => s.id === selectedSub)?.name ?? "";

  const handlePickCat = (id: string) => {
    setSelectedCat(id);
    setSelectedSub("");
    setQuestionPage(0);
    setActiveTab(2);
  };
  const handlePickSub = (id: string) => {
    setSelectedSub(id);
    setQuestionPage(0);
    setActiveTab(3);
  };
  const handleSearch = (v: string) => {
    setSearch(v);
    setQuestionPage(0);
  };

  const canAddQuestion = !!(selectedCat && selectedSub);
  const openAddQuestion = () => {
    if (!canAddQuestion) {
      toast.info("Select a category and topic first, or create them below.");
      return;
    }
    navigate({ to: "/categories/add", search: { categoryId: selectedCat, subId: selectedSub } });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
        <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2 min-w-0">
          <BookOpen className="size-5 sm:size-6 text-primary shrink-0" />
          <span className="truncate">{t("cat.manageQuestions")}</span>
        </h1>
        {canAddQuestion && (
          <Button
            onClick={openAddQuestion}
            className="h-11 gap-2 bg-gradient-primary text-primary-foreground shadow-glow cursor-pointer w-full sm:w-auto shrink-0"
          >
            <Plus className="size-4" /> {t("cat.addQuestion")}
          </Button>
        )}
      </div>

      <StepTabBar
        activeTab={activeTab}
        selectedCatName={selectedCatName}
        selectedSubName={selectedSubName}
        selectedCat={selectedCat}
        selectedSub={selectedSub}
        questionTotal={questionTotal}
        onTabChange={setActiveTab}
      />

      {activeTab === 1 && (
        <CategoryTab
          cats={cats}
          catQuestionCounts={catQuestionCounts}
          selectedCat={selectedCat}
          totalQuestions={totalQuestions}
          catCount={cats.length}
          onPickCat={handlePickCat}
          onNewCat={() => setCatDialog(true)}
        />
      )}

      {activeTab === 2 && selectedCat && (
        <TopicTab
          filteredSubs={filteredSubs}
          subQuestionCounts={subQuestionCounts}
          selectedSub={selectedSub}
          selectedCatName={selectedCatName}
          onPickSub={handlePickSub}
          onNewSub={() => setSubDialog(true)}
        />
      )}

      {activeTab === 3 && selectedSub && (
        <QuestionsTab
          questions={questions}
          loadingQs={loadingQs}
          questionTotal={questionTotal}
          questionPage={questionPage}
          search={search}
          usageCounts={usageCounts}
          lastUsed={lastUsed}
          selectedCatName={selectedCatName}
          selectedSubName={selectedSubName}
          onSearch={handleSearch}
          onPageChange={setQuestionPage}
          onUpdate={updateQuestion}
          onDelete={(id) =>
            deleteQuestion(id, (subId) => {
              setSubQuestionCounts((prev) => {
                const next = new Map(prev);
                next.set(subId, Math.max(0, (next.get(subId) ?? 1) - 1));
                return next;
              });
            })
          }
          onAddQuestion={openAddQuestion}
        />
      )}

      <QuickCreateDialog
        open={catDialog}
        onClose={() => setCatDialog(false)}
        mode="category"
        onCreated={(id, name) => {
          setCats((prev) => [...prev, { id, name, icon: null }]);
          handlePickCat(id);
        }}
      />
      <QuickCreateDialog
        open={subDialog}
        onClose={() => setSubDialog(false)}
        mode="subcategory"
        categoryId={selectedCat}
        onCreated={(id, name) => {
          setSubs((prev) => [...prev, { id, category_id: selectedCat, name, description: null }]);
          handlePickSub(id);
        }}
      />
    </div>
  );
}
