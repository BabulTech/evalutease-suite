import { useState } from "react";
import { ChevronDown } from "lucide-react";

type Props = { label: string; icon: React.ElementType; children: React.ReactNode };

export function Collapse({ label, icon: Icon, children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold hover:bg-muted/20 transition-colors min-h-[52px]"
        aria-expanded={open ? "true" : "false"}
      >
        <span className="flex items-center gap-2">
          <Icon className="size-4 text-primary/70" />
          {label}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="px-5 pb-5 pt-1 border-t border-border/50">{children}</div>}
    </div>
  );
}
