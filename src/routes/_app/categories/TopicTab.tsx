import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChipSelector } from "./ChipSelector";
import type { Sub } from "./types";

type Props = {
  filteredSubs: Sub[];
  subQuestionCounts: Map<string, number>;
  selectedSub: string;
  selectedCatName: string;
  onPickSub: (id: string) => void;
  onNewSub: () => void;
};

export function TopicTab({
  filteredSubs,
  subQuestionCounts,
  selectedSub,
  selectedCatName,
  onPickSub,
  onNewSub,
}: Props) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4 sm:p-5 space-y-4 min-w-0 overflow-hidden">
      <div className="flex items-start sm:items-center justify-between gap-2 min-w-0">
        <div className="text-sm min-w-0 flex-1 break-anywhere">
          <span className="text-muted-foreground">{selectedCatName} · </span>
          <span className="font-semibold">Choose a topic</span>
        </div>
        <button
          type="button"
          onClick={onNewSub}
          className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-all shrink-0 whitespace-nowrap"
        >
          <Plus size={13} /> New Topic
        </button>
      </div>

      {filteredSubs.length === 0 ? (
        <div className="text-center py-8 space-y-3">
          <p className="text-sm text-muted-foreground">
            No topics in <span className="font-medium text-foreground">{selectedCatName}</span> yet
          </p>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onNewSub}>
            <Plus size={14} /> Add first topic
          </Button>
        </div>
      ) : (
        <ChipSelector
          items={filteredSubs.map((s) => ({
            id: s.id,
            label: s.name,
            count: subQuestionCounts.get(s.id) ?? 0,
          }))}
          selected={selectedSub}
          onSelect={onPickSub}
        />
      )}
    </div>
  );
}
