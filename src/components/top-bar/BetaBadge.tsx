import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FlaskConical, MessageSquarePlus, Info } from "lucide-react";

// Beta indicator shown in the top bar (web + mobile). Tapping it explains that
// the app is in beta and links to the App Review tab on the Reviews page, which
// is the single place users submit and track feedback.
export function BetaBadge() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="You're using the beta version — tap for info & feedback"
        aria-label="Beta version information and feedback"
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold bg-amber-400/10 text-amber-500 hover:bg-amber-400/20 transition-colors"
      >
        <FlaskConical size={13} />
        <span>Beta</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-border bg-card shadow-elegant p-4 z-50 space-y-3">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 rounded-lg bg-amber-400/10 p-1.5 text-amber-500">
              <Info size={15} />
            </span>
            <div>
              <p className="text-sm font-semibold">You're on the beta</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Jancho is still in early access. Some features may change and a
                few rough edges are expected. Your feedback helps us improve.
              </p>
            </div>
          </div>
          <Link
            to="/reviews"
            search={{ tab: "appreview" }}
            onClick={() => setOpen(false)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary text-primary-foreground px-3 py-2 text-sm font-semibold shadow-glow hover:opacity-90 transition-opacity"
          >
            <MessageSquarePlus className="size-4" />
            Share feedback
          </Link>
        </div>
      )}
    </div>
  );
}
