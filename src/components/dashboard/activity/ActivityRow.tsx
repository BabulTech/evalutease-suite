import { Link } from "@tanstack/react-router";
import type { RecentActivityRow } from "./types";
import { iconFor, linkFor, formatRelative } from "./utils";

type Props = {
  row: RecentActivityRow;
};

export function ActivityRow({ row }: Props) {
  const { Icon, tone } = iconFor(row);
  const href = linkFor(row);
  const isRisky = row.risk_score >= 40;

  const inner = (
    <div className="px-4 py-3 flex items-start gap-3 hover:bg-muted/30 transition-colors">
      <div
        className={`mt-0.5 size-7 shrink-0 rounded-lg bg-muted/40 flex items-center justify-center ${tone}`}
      >
        <Icon className="size-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${isRisky ? "font-semibold" : ""}`}>{row.message}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          <span className="uppercase tracking-wider">{row.module}</span> ·{" "}
          {formatRelative(row.created_at)}
        </p>
      </div>
    </div>
  );

  return href ? (
    <Link to={href} className="block">
      {inner}
    </Link>
  ) : (
    <div>{inner}</div>
  );
}
