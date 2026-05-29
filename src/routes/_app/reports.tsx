import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { BarChart3, Download, FileText, Filter, RotateCcw, Trophy } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { usePlan } from "@/contexts/PlanContext";
import { useI18n } from "@/lib/i18n";
import { downloadQuizReportCsv } from "@/lib/quiz-reports";
import { Button } from "@/components/ui/button";
import { useReportsData } from "./reports/useReportsData";
import { FilterSidebar } from "./reports/FilterSidebar";
import { AttemptsTable } from "./reports/AttemptsTable";
import { StudentReportsView } from "./reports/StudentReportsView";
import { SectionLabel } from "./reports/ReportUi";

// react-doctor-disable-next-line react-doctor/only-export-components
export const Route = createFileRoute("/_app/reports")({ component: ReportsPage });

// react-doctor-disable-next-line react-doctor/only-export-components
const LazyQuizReportVisualization = lazy(
  () => import("@/components/reports/QuizReportVisualization"),
);

// react-doctor-disable-next-line react-doctor/only-export-components
function ReportsPage() {
  const { user } = useAuth();
  const { plan, credits, reload: reloadPlan } = usePlan();
  const { t } = useI18n();

  const {
    sessions,
    loading,
    reportMode,
    setReportMode,
    studentMode,
    setStudentMode,
    selectedId,
    setSelectedId,
    selected,
    query,
    setQuery,
    studentQuery,
    setStudentQuery,
    statusFilter,
    setStatusFilter,
    dateRange,
    setDateRange,
    subjectFilter,
    setSubjectFilter,
    subjectOptions,
    passMark,
    setPassMark,
    sort,
    setSort,
    quizListPage,
    setQuizListPage,
    sessionTotal,
    attemptsLoading,
    filteredSessions,
    filteredRows,
    baseRows,
    studentAttemptRows,
    studentSummaryRows,
    stats,
    teacherName,
    schoolName,
    resetFilters,
    filterSummary,
    deductExportCredit,
    selectedAttempts,
  } = useReportsData(user, plan, credits, reloadPlan);

  const exportCsv = async () => {
    if (!selected) return;
    if (!(await deductExportCredit())) return;
    downloadQuizReportCsv(
      {
        title: selected.title,
        categoryLabel: [selected.categoryName, selected.subcategoryName]
          .filter(Boolean)
          .join(" → "),
        teacherName,
        schoolName,
        subjectLabel:
          selected.subject ||
          [selected.categoryName, selected.subcategoryName].filter(Boolean).join(" -> ") ||
          "Not specified",
        topicLabel: selected.topic ?? "",
        createdAt: selected.created_at,
        questionCount: selectedAttempts[0]?.totalQuestions ?? 0,
        attempts: selectedAttempts,
      },
      { rows: filteredRows, filterSummary, watermark: plan?.file_export_watermark !== false },
    );
  };

  return (
    <div className="space-y-4">
      {/* Hero header */}
      <div className="rounded-2xl border border-border bg-card/60 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 min-w-0 print:hidden">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="size-10 sm:size-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-glow shrink-0">
            <BarChart3 className="size-5 sm:size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-lg sm:text-xl md:text-2xl font-semibold tracking-tight truncate">
              {t("rep.title")}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">{t("rep.desc")}</p>
          </div>
        </div>
        {selected && reportMode === "quiz" && (
          <div className="flex gap-2 shrink-0 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={async () => {
                if (await deductExportCredit()) window.print();
              }}
              className="gap-1.5 h-10 flex-1 sm:flex-none"
            >
              <FileText className="size-4" /> PDF
              {plan?.credit_cost_export ? ` (${plan.credit_cost_export} cr)` : ""}
            </Button>
            <Button
              onClick={() => void exportCsv()}
              className="gap-1.5 h-10 bg-gradient-primary text-primary-foreground shadow-glow flex-1 sm:flex-none"
            >
              <Download className="size-4" />
              <span className="truncate">Excel ({filteredRows.length})</span>
              {plan?.credit_cost_export ? ` · ${plan.credit_cost_export} cr` : ""}
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground animate-pulse">
          {t("common.loading")}
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
          <Trophy className="mx-auto size-10 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">{t("rep.empty")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("rep.emptyHint")}</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr] min-w-0">
          <FilterSidebar
            reportMode={reportMode}
            setReportMode={setReportMode}
            studentMode={studentMode}
            setStudentMode={setStudentMode}
            query={query}
            setQuery={setQuery}
            studentQuery={studentQuery}
            setStudentQuery={setStudentQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            dateRange={dateRange}
            setDateRange={setDateRange}
            subjectFilter={subjectFilter}
            setSubjectFilter={setSubjectFilter}
            subjectOptions={subjectOptions}
            passMark={passMark}
            setPassMark={setPassMark}
            sort={sort}
            setSort={setSort}
            quizListPage={quizListPage}
            setQuizListPage={setQuizListPage}
            sessionTotal={sessionTotal}
            filteredSessions={filteredSessions}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            resetFilters={resetFilters}
          />

          {reportMode === "student" ? (
            <StudentReportsView
              attemptRows={studentAttemptRows}
              summaryRows={studentSummaryRows}
              mode={studentMode}
              passMark={passMark}
            />
          ) : selected ? (
            <main className="space-y-6 min-w-0 overflow-hidden" id="report-print-area">
              {attemptsLoading && (
                <div className="rounded-2xl border border-border bg-card/40 p-4 text-sm text-muted-foreground">
                  {t("rep.loadingAttempts")}
                </div>
              )}
              <Suspense
                fallback={
                  <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
                    {t("rep.loadingViz")}
                  </div>
                }
              >
                <LazyQuizReportVisualization
                  session={selected}
                  top={filteredRows[0] ?? baseRows[0]}
                  filteredRows={filteredRows}
                  stats={stats}
                  passMark={passMark}
                  teacherName={teacherName}
                  schoolName={schoolName}
                />
              </Suspense>
              <SectionLabel title={t("rep.fullResultsTable")} desc={t("rep.fullResultsDesc")} />
              <AttemptsTable rows={filteredRows} passMark={passMark} />
            </main>
          ) : (
            <main className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
              <Filter className="mx-auto size-10 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-medium">{t("rep.noQuizzesMatch")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("rep.loosenFilters")}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={resetFilters}>
                <RotateCcw className="size-3.5 mr-1" /> {t("rep.resetFilters")}
              </Button>
            </main>
          )}
        </div>
      )}
    </div>
  );
}
