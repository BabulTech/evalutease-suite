import { PARTICIPANT_TYPE_ICONS, type IconKey } from "@/components/categories/icons";

type Props = {
  value: IconKey;
  onChange: (key: IconKey) => void;
};

export function IconPicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {PARTICIPANT_TYPE_ICONS.map((ic) => {
        const Icon = ic.icon;
        const active = value === ic.key;
        return (
          <button
            key={ic.key}
            type="button"
            onClick={() => onChange(ic.key)}
            title={ic.label}
            className={`aspect-square rounded-xl border flex items-center justify-center transition-all ${
              active
                ? "border-primary/60 bg-primary/15 shadow-glow text-primary"
                : "border-border bg-card/40 hover:border-primary/30 text-muted-foreground"
            }`}
          >
            <Icon className="size-5" />
          </button>
        );
      })}
    </div>
  );
}
