import { Check } from "lucide-react";

type Props = {
  items: { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
};

export function ChipSelector({ items, selected, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium min-h-[40px] transition-all ${
            selected === item.id
              ? "bg-primary text-primary-foreground border-primary shadow-glow"
              : "bg-card/60 border-border text-foreground hover:border-primary/50 hover:bg-primary/5"
          }`}
        >
          {selected === item.id && <Check size={12} />}
          {item.label}
        </button>
      ))}
    </div>
  );
}
