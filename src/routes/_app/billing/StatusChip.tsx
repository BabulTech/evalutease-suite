import { CheckCircle2, XCircle, Clock } from "lucide-react";

export function StatusChip({ status }: { status: string }) {
  const cls =
    status === "approved"
      ? "bg-success/15 text-success"
      : status === "rejected"
        ? "bg-destructive/15 text-destructive"
        : "bg-warning/15 text-warning";
  const icon =
    status === "approved" ? (
      <CheckCircle2 className="size-3" />
    ) : status === "rejected" ? (
      <XCircle className="size-3" />
    ) : (
      <Clock className="size-3" />
    );
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${cls}`}
    >
      {icon} {status}
    </span>
  );
}
