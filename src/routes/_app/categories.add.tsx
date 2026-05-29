import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, BookOpen } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useAddQuestion } from "./categories.add/useAddQuestion";
import { DestinationStep } from "./categories.add/DestinationStep";
import { MethodStep, type Method } from "./categories.add/MethodStep";

// react-doctor-disable-next-line react-doctor/only-export-components
export const Route = createFileRoute("/_app/categories/add")({
  validateSearch: (search: Record<string, unknown>) => ({
    categoryId: typeof search.categoryId === "string" ? search.categoryId : "",
    subId: typeof search.subId === "string" ? search.subId : "",
  }),
  component: AddQuestionPage,
});

// react-doctor-disable-next-line react-doctor/only-export-components
function AddQuestionPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { categoryId: initialCategoryId, subId: initialSubId } = Route.useSearch();

  const [method, setMethod] = useState<Method>("manual");

  const {
    cats,
    filteredSubs,
    selectedCat,
    selectedSub,
    saving,
    selectCat,
    setSelectedSub,
    createCat,
    createSub,
    saveDrafts,
  } = useAddQuestion(user, initialCategoryId, initialSubId);

  const ready = !!(selectedCat && selectedSub);

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-10">
      {/* Back */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => navigate({ to: "/categories" })}
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" /> <BookOpen size={12} /> {t("add.backToQuestions")}
        </button>
      </div>

      {/* Title */}
      <div className="min-w-0">
        <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight break-anywhere">
          {t("add.title")}
        </h1>
        <p className="text-muted-foreground mt-1 text-xs sm:text-sm break-anywhere">{t("add.desc")}</p>
      </div>

      <DestinationStep
        cats={cats}
        filteredSubs={filteredSubs}
        selectedCat={selectedCat}
        selectedSub={selectedSub}
        onSelectCat={selectCat}
        onSelectSub={setSelectedSub}
        onCreateCat={createCat}
        onCreateSub={createSub}
      />

      <MethodStep
        ready={ready}
        method={method}
        saving={saving}
        onMethodChange={setMethod}
        onSave={saveDrafts}
      />
    </div>
  );
}
