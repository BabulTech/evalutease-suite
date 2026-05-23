import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import type { AiCriteria } from "./types";

export function AiSetup({
  pendingCount,
  totalCost,
  creditBalance,
  criteria,
  onCriteriaChange,
  onBack,
  onRun,
}: {
  pendingCount: number;
  totalCost: number;
  creditBalance: number;
  criteria: AiCriteria;
  onCriteriaChange: (c: AiCriteria) => void;
  onBack: () => void;
  onRun: () => void;
}) {
  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground">
        <ArrowLeft className="size-3.5" /> Back
      </Button>

      <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-5">
        <div>
          <h2 className="font-semibold text-lg">AI Grading Setup</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Set your marking criteria. AI will grade all {pendingCount} answers using these rules.
          </p>
        </div>

        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Marking Criteria
          </div>
          {(
            [
              {
                key: "concepts",
                label: "Concepts & Key Ideas",
                desc: "Does the answer cover the main concepts?",
              },
              {
                key: "relevance",
                label: "Relevance",
                desc: "Is the answer relevant to the question?",
              },
              { key: "grammar", label: "Grammar", desc: "Is the answer grammatically correct?" },
              { key: "spelling", label: "Spelling", desc: "Are words spelled correctly?" },
            ] as { key: keyof AiCriteria; label: string; desc: string }[]
          ).map(({ key, label, desc }) => (
            <label
              key={key}
              htmlFor={`crit-${key}`}
              className="flex items-start gap-3 cursor-pointer group"
            >
              <Checkbox
                id={`crit-${key}`}
                checked={criteria[key] as boolean}
                onCheckedChange={(v) => onCriteriaChange({ ...criteria, [key]: !!v })}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-medium group-hover:text-primary transition-colors">
                  {label}
                </div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </div>
            </label>
          ))}
          <div className="pt-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
              Additional Instructions (optional)
            </span>
            <Textarea
              placeholder="e.g. Focus on technical accuracy, check for use of proper terminology…"
              value={criteria.custom}
              onChange={(e) => onCriteriaChange({ ...criteria, custom: e.target.value })}
              rows={3}
              className="resize-none text-sm"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/50 divide-y divide-border text-sm">
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-muted-foreground">Answers to grade</span>
            <span className="font-semibold">{pendingCount}</span>
          </div>
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-muted-foreground">Total cost</span>
            <span className="font-semibold text-primary">{totalCost} credits</span>
          </div>
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-muted-foreground">Your balance</span>
            <span
              className={
                creditBalance >= totalCost
                  ? "font-semibold text-success"
                  : "font-semibold text-destructive"
              }
            >
              {creditBalance} credits
            </span>
          </div>
        </div>

        <Button
          onClick={onRun}
          disabled={
            creditBalance < totalCost ||
            pendingCount === 0 ||
            !Object.values(criteria).some(Boolean)
          }
          className="w-full gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
        >
          <Sparkles className="size-4" /> Start AI Grading ({totalCost} credits)
        </Button>
      </div>
    </div>
  );
}
