import {
  ArrowDownAZ,
  BarChart3,
  CalendarRange,
  Filter,
  Flame,
  ListFilter,
  RotateCcw,
  Search,
  Target,
  UserRound,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginationControls } from "@/components/PaginationControls";
import { DATE_RANGE_KEYS, SORT_KEYS, REPORT_PAGE_SIZE } from "./types";
import type {
  ReportMode,
  StudentMode,
  DateRange,
  StatusFilter,
  SortOption,
  ReportSession,
} from "./types";
import { categoryLabel } from "./helpers";
import { FilterField } from "./ReportUi";

type Props = {
  reportMode: ReportMode;
  setReportMode: (v: ReportMode) => void;
  studentMode: StudentMode;
  setStudentMode: (v: StudentMode) => void;
  query: string;
  setQuery: (v: string) => void;
  studentQuery: string;
  setStudentQuery: (v: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (v: StatusFilter) => void;
  dateRange: DateRange;
  setDateRange: (v: DateRange) => void;
  subjectFilter: string;
  setSubjectFilter: (v: string) => void;
  subjectOptions: string[];
  passMark: number;
  setPassMark: (v: number) => void;
  sort: SortOption;
  setSort: (v: SortOption) => void;
  quizListPage: number;
  setQuizListPage: (v: number) => void;
  sessionTotal: number;
  filteredSessions: ReportSession[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  resetFilters: () => void;
};

export function FilterSidebar({
  reportMode,
  setReportMode,
  studentMode,
  setStudentMode,
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
  filteredSessions,
  selectedId,
  setSelectedId,
  resetFilters,
}: Props) {
  const { t } = useI18n();

  return (
    <aside className="space-y-3 print:hidden min-w-0">
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={reportMode === "quiz" ? "default" : "outline"}
          onClick={() => setReportMode("quiz")}
          className={
            reportMode === "quiz" ? "bg-gradient-primary text-primary-foreground shadow-glow" : ""
          }
        >
          <BarChart3 className="mr-1.5 size-4" /> {t("rep.quiz")}
        </Button>
        <Button
          type="button"
          variant={reportMode === "student" ? "default" : "outline"}
          onClick={() => setReportMode("student")}
          className={
            reportMode === "student"
              ? "bg-gradient-primary text-primary-foreground shadow-glow"
              : ""
          }
        >
          <UserRound className="mr-1.5 size-4" /> {t("rep.student")}
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card/40 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Filter className="size-3.5" /> {t("rep.filters")}
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="text-[11px] inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3" /> {t("rep.reset")}
          </button>
        </div>

        <FilterField icon={Search} label={t("rep.searchQuizzes")} hint={t("rep.searchQuizzesHint")}>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("rep.searchQuizzesPlaceholder")}
            className="h-9"
          />
        </FilterField>

        <FilterField icon={CalendarRange} label={t("rep.dateRange")} hint={t("rep.dateRangeHint")}>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(DATE_RANGE_KEYS) as DateRange[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDateRange(value)}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium min-h-[28px] transition-colors ${
                  dateRange === value
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {t(DATE_RANGE_KEYS[value])}
              </button>
            ))}
          </div>
        </FilterField>

        <FilterField icon={ListFilter} label={t("rep.subjectFilter")} hint={t("rep.subjectHint")}>
          <div className="flex flex-wrap gap-1.5">
            {(["all", ...subjectOptions.slice(0, 6)] as string[]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setSubjectFilter(opt)}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium min-h-[28px] transition-colors max-w-[120px] truncate ${
                  subjectFilter === opt
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {opt === "all" ? t("rep.allSubjects") : opt}
              </button>
            ))}
            {subjectOptions.length > 6 && (
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger className="h-7 w-auto px-2 text-xs rounded-full border-dashed">
                  <SelectValue placeholder="More…" />
                </SelectTrigger>
                <SelectContent>
                  {subjectOptions.slice(6).map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </FilterField>

        <FilterField
          icon={Target}
          label={`${t("rep.passMark")} - ${passMark}%`}
          hint={t("rep.passMarkHint")}
        >
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={passMark}
              aria-label={`${t("rep.passMark")} ${passMark}%`}
              title={`${t("rep.passMark")} ${passMark}%`}
              onChange={(e) => setPassMark(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="text-xs font-bold text-primary w-9 text-right">{passMark}%</span>
          </div>
        </FilterField>

        <FilterField
          icon={Search}
          label={reportMode === "quiz" ? t("rep.findParticipant") : t("rep.searchStudent")}
          hint={reportMode === "quiz" ? t("rep.findParticipantHint") : t("rep.searchStudentHint")}
        >
          <Input
            value={studentQuery}
            onChange={(e) => setStudentQuery(e.target.value)}
            placeholder={
              reportMode === "quiz"
                ? t("rep.findParticipantPlaceholder")
                : t("rep.searchStudentPlaceholder")
            }
            className="h-9"
          />
        </FilterField>

        <FilterField
          icon={Flame}
          label={t("rep.submissionStatus")}
          hint={t("rep.submissionStatusHint")}
        >
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { val: "all", key: "rep.all" },
                { val: "completed", key: "rep.submittedStatus" },
                { val: "pending", key: "rep.leftEarly" },
              ] as const
            ).map(({ val, key }) => (
              <Button
                key={val}
                type="button"
                size="sm"
                variant={statusFilter === val ? "default" : "outline"}
                onClick={() => setStatusFilter(val)}
                className={
                  statusFilter === val ? "bg-primary text-primary-foreground text-xs" : "text-xs"
                }
              >
                {t(key)}
              </Button>
            ))}
          </div>
        </FilterField>

        <FilterField icon={ArrowDownAZ} label={t("rep.sortBy")} hint={t("rep.sortByHint")}>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(SORT_KEYS) as SortOption[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSort(value)}
                className={`inline-flex items-center justify-center rounded-lg border px-2 py-1.5 text-[11px] font-medium min-h-[30px] transition-colors text-center ${
                  sort === value
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {t(SORT_KEYS[value])}
              </button>
            ))}
          </div>
        </FilterField>

        {reportMode === "student" && (
          <FilterField icon={UserRound} label={t("rep.studentView")}>
            <div className="grid grid-cols-2 gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={studentMode === "attempts" ? "default" : "outline"}
                onClick={() => setStudentMode("attempts")}
                className={studentMode === "attempts" ? "bg-primary text-primary-foreground" : ""}
              >
                {t("rep.perAttempt")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={studentMode === "students" ? "default" : "outline"}
                onClick={() => setStudentMode("students")}
                className={studentMode === "students" ? "bg-primary text-primary-foreground" : ""}
              >
                {t("rep.perStudent")}
              </Button>
            </div>
          </FilterField>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
        <div className="px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/50">
          {filteredSessions.length}{" "}
          {filteredSessions.length === 1 ? t("rep.quizCount") : t("rep.quizzesCount")}
        </div>
        {filteredSessions.length === 0 ? (
          <div className="px-4 py-6 text-xs text-muted-foreground text-center">
            {t("rep.noQuizzesMatch")}
          </div>
        ) : (
          filteredSessions.map((s) => {
            const active = selectedId === s.id;
            return (
              <button
                type="button"
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`block w-full px-4 py-3 text-left border-b border-border/60 last:border-b-0 hover:bg-muted/30 ${active ? "bg-primary/10" : ""}`}
              >
                <div className="font-semibold truncate">{s.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground truncate">
                  {categoryLabel(s) || t("hist.uncategorised")}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {new Date(s.created_at).toLocaleDateString()}
                </div>
              </button>
            );
          })
        )}
        <PaginationControls
          page={quizListPage}
          pageSize={REPORT_PAGE_SIZE}
          total={subjectFilter !== "all" ? filteredSessions.length : sessionTotal}
          label="quizzes"
          onPageChange={setQuizListPage}
        />
      </div>
    </aside>
  );
}
