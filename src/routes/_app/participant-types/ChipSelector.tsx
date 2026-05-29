import { Check } from "lucide-react";

export function ChipSelector({
  items,
  selected,
  onSelect,
  allLabel,
}: {
  items: { id: string; label: string; count?: number }[];
  selected: string;
  onSelect: (id: string) => void;
  allLabel?: string;
}) {
  const allItem = {
    id: "__all__",
    label: allLabel ?? "All",
    count: items.reduce((s, i) => s + (i.count ?? 0), 0),
  };
  const opts = [allItem, ...items];
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          title={item.label}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium min-h-[40px] transition-all max-w-full ${
            selected === item.id
              ? "bg-primary text-primary-foreground border-primary shadow-glow"
              : "bg-card/60 border-border text-foreground hover:border-primary/50 hover:bg-primary/5"
          }`}
        >
          {selected === item.id && <Check size={12} className="shrink-0" />}
          <span className="truncate max-w-[200px] sm:max-w-none">{item.label}</span>
          {item.count !== undefined && (
            <span
              className={`text-[11px] rounded-full px-1.5 py-0.5 font-semibold shrink-0 ${
                selected === item.id
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {item.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
