import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Archive, Filter, Printer } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { usePlan } from "@/contexts/PlanContext";
import { Button } from "@/components/ui/button";
import { PaginationControls } from "@/components/PaginationControls";
import { useQuizHistory } from "./quiz-history/useQuizHistory";
import { FilterPanel } from "./quiz-history/FilterPanel";
import { SessionCard } from "./quiz-history/SessionCard";
import { HISTORY_PAGE_SIZE } from "./quiz-history/types";
import { printAll } from "./quiz-history/printAll";

// react-doctor-disable-next-line react-doctor/only-export-components
export const Route = createFileRoute("/_app/quiz-history")({
  component: QuizHistoryPage,
});

// react-doctor-disable-next-line react-doctor/only-export-components
const LazyHistoryTrendCharts = lazy(() => import("@/components/history/HistoryTrendCharts"));

// react-doctor-disable-next-line react-doctor/only-export-components
function QuizHistoryPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { plan } = usePlan();

  const {
    sessions,
    sessionTotal,
    loading,
    openIds,
    profile,
    filterTitle,
    setFilterTitle,
    filterType,
    setFilterType,
    filterDateFrom,
    setFilterDateFrom,
    filterDateTo,
    setFilterDateTo,
    showFilters,
    setShowFilters,
    page,
    setPage,
    attemptPages,
    setAttemptPages,
    expandedAttempts,
    expandingIds,
    attemptAnswerStats,
    sessionMaxPts,
    downloadOpenId,
    setDownloadOpenId,
    downloadRef,
    hasFilters,
    clearFilters,
    trendData,
    totalParticipants,
    overallAvg,
    toggle,
  } = useQuizHistory(user);

  const avgColor =
    overallAvg >= 70 ? "text-success" : overallAvg >= 40 ? "text-warning" : "text-destructive";

  return (
    <div className="space-y-4">
      {/* Hero header */}
      <div className="rounded-2xl border border-border bg-card/60 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 min-w-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="size-10 sm:size-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-glow shrink-0">
            <Archive className="size-5 sm:size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-lg sm:text-xl md:text-2xl font-semibold tracking-tight truncate">
              {t("hist.title")}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">{t("hist.desc")}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 print:hidden shrink-0 w-full sm:w-auto"
          onClick={() => printAll(sessions, expandedAttempts, sessionMaxPts, profile, user?.email)}
        >
          <Printer className="size-3.5" /> {t("hist.printAll")}
        </Button>
      </div>

      {/* Stats strip */}
      {sessionTotal > 0 && (
        <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-2xl border border-border bg-card/50 p-4 text-center">
            <div className="font-display text-2xl font-bold text-primary">{sessionTotal}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
              Quizzes
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card/50 p-4 text-center">
            <div className="font-display text-2xl font-bold text-foreground">
              {totalParticipants}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
              Submissions
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card/50 p-4 text-center">
            <div className={`font-display text-2xl font-bold ${avgColor}`}>{overallAvg}%</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
              Avg Score
            </div>
          </div>
        </div>
      )}

      <FilterPanel
        filterTitle={filterTitle}
        setFilterTitle={setFilterTitle}
        filterType={filterType}
        setFilterType={setFilterType}
        filterDateFrom={filterDateFrom}
        setFilterDateFrom={setFilterDateFrom}
        filterDateTo={filterDateTo}
        setFilterDateTo={setFilterDateTo}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        hasFilters={hasFilters}
        clearFilters={clearFilters}
        sessions={sessions}
        sessionTotal={sessionTotal}
      />

      {/* Trend charts */}
      {sessions.length > 0 && (
        <Suspense
          fallback={
            <div className="rounded-2xl border border-border bg-card/40 p-4 text-xs text-muted-foreground">
              Loading charts…
            </div>
          }
        >
          <LazyHistoryTrendCharts trends={trendData} />
        </Suspense>
      )}

      {/* Session list */}
      {loading ? (
        <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground animate-pulse">
          {t("common.loading")}
        </div>
      ) : sessions.length === 0 && !hasFilters ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-12 text-center space-y-3">
          <Archive className="mx-auto size-10 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-semibold">{t("hist.empty")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("hist.emptyHint")}</p>
          </div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-12 text-center space-y-3">
          <Filter className="mx-auto size-10 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-semibold">{t("hist.noMatch")}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            {t("hist.clearFilters")}
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => (
            <SessionCard
              key={s.id}
              s={s}
              isOpen={openIds.has(s.id)}
              toggle={toggle}
              expandedAttempts={expandedAttempts}
              expandingIds={expandingIds}
              attemptAnswerStats={attemptAnswerStats}
              sessionMaxPts={sessionMaxPts}
              attemptPages={attemptPages}
              setAttemptPages={setAttemptPages}
              downloadOpenId={downloadOpenId}
              setDownloadOpenId={setDownloadOpenId}
              downloadRef={downloadRef}
              profile={profile}
              userEmail={user?.email}
              plan={plan}
            />
          ))}
          <PaginationControls
            page={page}
            pageSize={HISTORY_PAGE_SIZE}
            total={sessionTotal}
            label="sessions"
            onPageChange={setPage}
          />
        </ul>
      )}
    </div>
  );
}
