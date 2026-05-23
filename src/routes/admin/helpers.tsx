import { Building2, Star, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export const fmtDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export const ago = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
};

export function planBadge(slug: string) {
  const isEnterprise = slug.startsWith("enterprise");
  const isFree = slug.endsWith("starter");
  const cls = isEnterprise
    ? "bg-warning/15 text-warning"
    : isFree
      ? "bg-muted/40 text-muted-foreground"
      : "bg-primary/15 text-primary";
  const label = slug.replace("individual_", "").replace("enterprise_", "Org ").replace("_", " ");
  return (
    <Badge className={`${cls} border-0 text-[10px] capitalize whitespace-nowrap`}>
      {isEnterprise ? (
        <Building2 className="size-3 mr-0.5 inline" />
      ) : isFree ? (
        <Zap className="size-3 mr-0.5 inline" />
      ) : (
        <Star className="size-3 mr-0.5 inline" />
      )}
      {label}
    </Badge>
  );
}

const CLS_SUCCESS = "bg-success/15 text-success";
const CLS_PRIMARY = "bg-primary/15 text-primary";
const CLS_WARNING = "bg-warning/15 text-warning";
const CLS_MUTED = "bg-muted/40 text-muted-foreground";
const CLS_DESTRUCTIVE = "bg-destructive/15 text-destructive";

export function statusBadge(s: string, map?: Record<string, string>) {
  const defaults: Record<string, string> = {
    active: CLS_SUCCESS,
    completed: CLS_SUCCESS,
    trialing: CLS_PRIMARY,
    open: CLS_PRIMARY,
    in_review: CLS_WARNING,
    scheduled: CLS_WARNING,
    canceled: CLS_MUTED,
    expired: CLS_MUTED,
    wont_fix: CLS_MUTED,
    resolved: CLS_SUCCESS,
    past_due: CLS_DESTRUCTIVE,
    draft: CLS_MUTED,
  };
  const cls = (map ?? defaults)[s] ?? CLS_MUTED;
  return <Badge className={`${cls} border-0 text-[10px] capitalize`}>{s.replace("_", " ")}</Badge>;
}
