import { Plus } from "lucide-react";

type Props = {
  items: { id: string; label: string; count?: number }[];
  selected: string;
  onSelect: (id: string) => void;
  onAdd?: () => void;
  addLabel?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function ChipSelector({
  items,
  selected,
  onSelect,
  onAdd,
  addLabel,
  placeholder,
  disabled = false,
}: Props) {
  if (disabled) return null;
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {items.length === 0 && placeholder && (
        <span className="text-sm text-muted-foreground italic">{placeholder}</span>
      )}
      {items.map((item) => (
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
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary min-h-[40px] transition-all"
        >
          <Plus size={14} /> {addLabel ?? "Add"}
        </button>
      )}
    </div>
  );
}
