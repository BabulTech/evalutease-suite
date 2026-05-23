import { Users } from "lucide-react";

type Props = {
  icon: typeof Users;
  label: string;
  value: string | number;
  desc?: string;
  color?: string;
};

export function Metric({ icon: Icon, label, value, desc, color = "text-foreground" }: Props) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4 space-y-2 hover:border-primary/30 hover:shadow-glow transition-all duration-200">
      <div className="flex items-center justify-between">
        <Icon className="size-4 text-primary/70" />
      </div>
      <div className={`font-display text-2xl font-bold ${color}`}>{value}</div>
      <div>
        <div className="text-sm font-medium">{label}</div>
        {desc && (
          <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{desc}</div>
        )}
      </div>
    </div>
  );
}
