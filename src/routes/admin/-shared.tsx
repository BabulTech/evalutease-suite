import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  color = "text-primary",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  trend?: number;
  color?: string;
}) {
  return (
    <div className="min-h-[112px] rounded-xl md:rounded-2xl border border-border bg-card/60 p-4 md:p-5 hover:shadow-glow hover:border-primary/40 md:hover:scale-[1.02] transition-all duration-300 cursor-default">
      <div className="flex items-start justify-between">
        <div className="rounded-lg md:rounded-xl p-2 bg-primary/10">
          <Icon className={`size-4 md:h-5 md:w-5 ${color}`} />
        </div>
        {trend !== undefined && (
          <span
            className={`flex items-center gap-0.5 text-xs font-semibold ${trend >= 0 ? "text-success" : "text-destructive"}`}
          >
            {trend >= 0 ? (
              <ArrowUpRight className="size-3.5" />
            ) : (
              <ArrowDownRight className="size-3.5" />
            )}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <div className="font-display text-xl md:text-2xl font-bold leading-tight break-words">
          {value}
        </div>
        <div className="text-[11px] md:text-xs text-muted-foreground mt-1 leading-snug">
          {label}
        </div>
        {sub && <div className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export function SkeletonRows({ cols, n = 5 }: { cols: number; n?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => i).map((i) => (
        // react-doctor-disable-next-line react-doctor/control-has-associated-label
        <tr key={i} aria-label={`skeleton row ${i + 1}`}>
          {/* react-doctor-disable-next-line react-doctor/control-has-associated-label */}
          <td colSpan={cols} className="px-4 py-3">
            <div className="h-4 bg-muted/30 rounded animate-pulse" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function TableShell({ children, footer }: { children: React.ReactNode; footer?: string }) {
  return (
    <div className="rounded-xl md:rounded-2xl border border-border bg-card/60 overflow-hidden">
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[720px] text-sm">{children}</table>
      </div>
      {footer && (
        <div className="px-4 py-2.5 border-t border-border/40 bg-muted/10 text-xs text-muted-foreground">
          {footer}
        </div>
      )}
    </div>
  );
}

export function THead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="border-b border-border bg-muted/20 text-[11px] uppercase tracking-wider text-muted-foreground">
        {cols.map((c) => (
          <th key={c} className={`px-4 py-3 ${c === "" ? "" : "text-left"}`}>
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-2">
      <h2 className="font-display text-lg md:text-xl font-semibold leading-tight">{title}</h2>
      <p className="text-xs md:text-sm text-muted-foreground mt-1 leading-relaxed">{sub}</p>
    </div>
  );
}
