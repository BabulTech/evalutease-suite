import type { RecentActivityRow } from "./types";
import { MODULE_FILTERS } from "./types";

type ChipProps = {
  value: string;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
};

function ModuleFilterChip({ value, label, count, active, onClick }: ChipProps) {
  const disabled = value !== "all" && count === 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-all ${
        active
          ? "bg-primary text-primary-foreground"
          : disabled
            ? "text-muted-foreground/40 cursor-not-allowed"
            : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {label}
      {count > 0 && (
        <span
          className={`text-[10px] rounded-full px-1.5 ${active ? "bg-primary-foreground/20" : "bg-background/60"}`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

type Props = {
  rows: RecentActivityRow[];
  activeFilter: string;
  onFilterChange: (value: string) => void;
};

export function ModuleFilterBar({ rows, activeFilter, onFilterChange }: Props) {
  const moduleCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.module] = (acc[r.module] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="px-3 py-2 border-b border-border bg-card/30 flex flex-wrap gap-1.5">
      {MODULE_FILTERS.map((m) => (
        <ModuleFilterChip
          key={m.value}
          value={m.value}
          label={m.label}
          count={m.value === "all" ? rows.length : (moduleCounts[m.value] ?? 0)}
          active={activeFilter === m.value}
          onClick={() => onFilterChange(m.value)}
        />
      ))}
    </div>
  );
}
