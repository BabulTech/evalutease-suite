import { iconForAction, formatRelative } from "./utils";
import type { SessionActivityRow } from "../SessionActivityPanel";

type Props = { row: SessionActivityRow };

export function ActivityRow({ row }: Props) {
  const { Icon, tone } = iconForAction(row.action_type);
  const isRisky = row.risk_score >= 40;
  return (
    <div className="px-4 py-3 flex items-start gap-3">
      <div
        className={`mt-0.5 size-7 shrink-0 rounded-lg bg-muted/40 flex items-center justify-center ${tone}`}
      >
        <Icon className="size-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${isRisky ? "font-semibold" : ""}`}>{row.message}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {row.actor_name ?? "Unknown"} · {formatRelative(row.created_at)}
        </p>
      </div>
    </div>
  );
}
