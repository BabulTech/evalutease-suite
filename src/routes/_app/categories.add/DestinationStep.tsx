import { useState } from "react";
import { Check, ChevronRight, FolderPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { ChipSelector } from "./ChipSelector";
import { QuickCreateDialog } from "./QuickCreateDialog";
import type { Cat, Sub } from "./useAddQuestion";

type Props = {
  cats: Cat[];
  filteredSubs: Sub[];
  selectedCat: string;
  selectedSub: string;
  onSelectCat: (id: string) => void;
  onSelectSub: (id: string) => void;
  onCreateCat: (name: string) => Promise<void>;
  onCreateSub: (name: string) => Promise<void>;
};

export function DestinationStep({
  cats,
  filteredSubs,
  selectedCat,
  selectedSub,
  onSelectCat,
  onSelectSub,
  onCreateCat,
  onCreateSub,
}: Props) {
  const { t } = useI18n();
  const [catDialog, setCatDialog] = useState(false);
  const [subDialog, setSubDialog] = useState(false);

  const selectedCatName = cats.find((c) => c.id === selectedCat)?.name ?? "";
  const selectedSubName = filteredSubs.find((s) => s.id === selectedSub)?.name ?? "";
  const ready = !!(selectedCat && selectedSub);

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
          1
        </div>
        <span className="text-sm font-semibold">Where should this question be saved?</span>
      </div>

      {/* Category chips */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t("cat.category")}
          </span>
          <button
            type="button"
            onClick={() => setCatDialog(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-all"
          >
            <FolderPlus size={12} /> New
          </button>
        </div>
        {cats.length === 0 ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-xs text-muted-foreground">No categories yet.</p>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-8"
              onClick={() => setCatDialog(true)}
            >
              <FolderPlus size={13} /> Create first category
            </Button>
          </div>
        ) : (
          <ChipSelector
            items={cats.map((c) => ({ id: c.id, label: c.name }))}
            selected={selectedCat}
            onSelect={onSelectCat}
          />
        )}
      </div>

      {/* Topic chips */}
      {selectedCat && (
        <div className="space-y-2 pt-2 border-t border-border/50">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("cat.topic")}{" "}
              <span className="text-muted-foreground/60">in {selectedCatName}</span>
            </span>
            <button
              type="button"
              onClick={() => setSubDialog(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-all"
            >
              <Plus size={12} /> New
            </button>
          </div>
          {filteredSubs.length === 0 ? (
            <div className="text-center py-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                No topics in <span className="font-medium text-foreground">{selectedCatName}</span>.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-8"
                onClick={() => setSubDialog(true)}
              >
                <Plus size={13} /> Add first topic
              </Button>
            </div>
          ) : (
            <ChipSelector
              items={filteredSubs.map((s) => ({ id: s.id, label: s.name }))}
              selected={selectedSub}
              onSelect={onSelectSub}
            />
          )}
        </div>
      )}

      {/* Destination confirmation pill */}
      {ready && (
        <div className="flex items-center gap-2 rounded-xl border border-success/25 bg-success/8 px-3 py-2.5">
          <Check size={14} className="text-success shrink-0" />
          <span className="text-xs text-muted-foreground">Saving to</span>
          <span className="text-xs font-semibold text-foreground">{selectedCatName}</span>
          <ChevronRight size={12} className="text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold text-primary">{selectedSubName}</span>
        </div>
      )}

      <QuickCreateDialog
        open={catDialog}
        onClose={() => setCatDialog(false)}
        title={t("cat.newCategory")}
        placeholder={t("cat.namePlaceholder")}
        onConfirm={onCreateCat}
      />
      <QuickCreateDialog
        open={subDialog}
        onClose={() => setSubDialog(false)}
        title={t("cat.newTopic")}
        placeholder={t("cat.namePlaceholder")}
        onConfirm={onCreateSub}
      />
    </div>
  );
}
