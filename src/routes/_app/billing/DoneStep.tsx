import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { onDashboard: () => void; onReset: () => void };

export function DoneStep({ onDashboard, onReset }: Props) {
  return (
    <div className="max-w-sm mx-auto">
      <div className="rounded-2xl border border-success/30 bg-success/5 p-10 text-center space-y-4">
        <CheckCircle2 className="size-14 text-success mx-auto" />
        <div>
          <h2 className="font-display text-2xl font-semibold">Payment Submitted!</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Admin will verify within <span className="font-semibold text-foreground">24 hours</span>
            .<br />
            Credits will appear once approved.
          </p>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <Button
            onClick={onDashboard}
            className="h-11 bg-gradient-primary text-primary-foreground shadow-glow"
          >
            Back to Dashboard
          </Button>
          <Button variant="outline" className="h-11" onClick={onReset}>
            Buy More Credits
          </Button>
        </div>
      </div>
    </div>
  );
}
