import { ScanLine, Coins } from "lucide-react";

type Props = { creditsBalance: number; creditCost: number };

export function ScanHeader({ creditsBalance, creditCost }: Props) {
  return (
    <>
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <ScanLine className="size-4" /> Scan an image with Claude
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Coins className="size-3.5 text-warning" />
            <span className="text-warning font-semibold">{creditsBalance}</span>
            <span>credits · Costs</span>
            <span className="font-semibold text-foreground">{creditCost} credits</span>
            <span>per scan</span>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Upload a photo or screenshot of a question paper - printed, handwritten, or formatted any
          way you like. Claude will read the page and turn each question it finds into an editable
          MCQ draft. No fixed format required.
        </p>
      </div>

      {creditsBalance < creditCost && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <Coins className="size-4 shrink-0" />
          <span>
            You need <strong>{creditCost} credits</strong> but only have{" "}
            <strong>{creditsBalance}</strong>.{" "}
            <a href="/billing" className="underline font-semibold">
              Buy credits →
            </a>
          </span>
        </div>
      )}
    </>
  );
}
