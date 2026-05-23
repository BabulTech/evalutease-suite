import { SIGNUP_STEPS } from "./constants";

export function LoadingOverlay({ loadingStep }: { loadingStep: number }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-5 p-8 rounded-3xl border border-border bg-card/90 shadow-2xl min-w-[280px]">
        <div className="relative size-16">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
          <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-primary/50 animate-spin [animation-duration:0.7s] [animation-direction:reverse]" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-foreground">{SIGNUP_STEPS[loadingStep]}</p>
          <p className="text-xs text-muted-foreground mt-1">Please don't close this window</p>
        </div>
        <div className="flex gap-1.5">
          {SIGNUP_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${i <= loadingStep ? "w-6 bg-primary" : "w-1.5 bg-border"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
