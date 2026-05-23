import { PauseCircle } from "lucide-react";

export function PauseOverlay() {
  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-3xl bg-background/85 backdrop-blur-sm text-center px-6"
      aria-live="polite"
    >
      <div className="size-14 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
        <PauseCircle className="size-8 text-primary" />
      </div>
      <h3 className="font-display text-xl font-semibold">Quiz paused</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        The teacher has paused this quiz. Hang tight - your timer is frozen and answers are disabled
        until it resumes.
      </p>
    </div>
  );
}
