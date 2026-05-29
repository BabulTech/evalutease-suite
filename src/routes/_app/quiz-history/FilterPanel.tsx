import { Filter, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QUIZ_TYPE_LABELS } from "./types";

type Props = {
  filterTitle: string;
  setFilterTitle: (v: string) => void;
  filterType: string;
  setFilterType: (v: string) => void;
  filterDateFrom: string;
  setFilterDateFrom: (v: string) => void;
  filterDateTo: string;
  setFilterDateTo: (v: string) => void;
  showFilters: boolean;
  setShowFilters: (v: boolean) => void;
  hasFilters: boolean;
  clearFilters: () => void;
  sessions: { length: number };
  sessionTotal: number;
};

export function FilterPanel({
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
  hasFilters,
  clearFilters,
  sessions,
  sessionTotal,
}: Props) {
  const { t } = useI18n();

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 print:hidden">
        <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder={t("hist.searchTitle")}
            value={filterTitle}
            onChange={(e) => setFilterTitle(e.target.value)}
            className="pl-9 h-9"
          />
          {filterTitle && (
            <button
              type="button"
              onClick={() => setFilterTitle("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-9"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="size-3.5" /> {t("hist.filters")}
          {hasFilters && (
            <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              !
            </span>
          )}
        </Button>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs" onClick={clearFilters}>
            <X className="size-3" /> {t("hist.clearAll")}
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-4 print:hidden">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-2">
              {t("hist.quizType")}
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFilterType("")}
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${
                  !filterType
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {t("hist.allTypes")}
              </button>
              {Object.entries(QUIZ_TYPE_LABELS).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setFilterType(val === filterType ? "" : val)}
                  className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${
                    filterType === val
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                {t("hist.fromDate")}
              </label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                {t("hist.toDate")}
              </label>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          {hasFilters && (
            <p className="text-xs text-muted-foreground">
              {t("hist.showing")} {sessions.length} {t("common.of")} {sessionTotal}{" "}
              {t("hist.sessions")}
            </p>
          )}
        </div>
      )}
    </>
  );
}
