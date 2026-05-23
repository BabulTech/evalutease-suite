import { ScanLine, Zap } from "lucide-react";

export function UpgradePrompt() {
  return (
    <div className="py-10 text-center space-y-4">
      <div className="mx-auto size-14 rounded-2xl bg-primary/15 flex items-center justify-center">
        <ScanLine className="size-7 text-primary" />
      </div>
      <div>
        <div className="font-display font-bold text-lg">AI Scan Requires a Paid Plan</div>
        <div className="text-sm text-muted-foreground mt-1">
          Upgrade to Individual Pro or higher to scan rosters with AI.
        </div>
      </div>
      <a
        href="/billing"
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold shadow-glow hover:opacity-90 transition-opacity"
      >
        <Zap className="size-4" /> Upgrade to Pro
      </a>
    </div>
  );
}
