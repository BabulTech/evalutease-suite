import { Check, Plus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import type { TypeRow, SubRow } from "./types";

export function GroupSelector({
  types,
  subs,
  typeId,
  subId,
  onTypeChange,
  onSubChange,
  onNewType,
  onNewSub,
}: {
  types: TypeRow[];
  subs: SubRow[];
  typeId: string;
  subId: string;
  onTypeChange: (v: string) => void;
  onSubChange: (v: string) => void;
  onNewType: () => void;
  onNewSub: () => void;
}) {
  const { t } = useI18n();
  const visibleSubs = subs.filter((s) => s.type_id === typeId);
  const selectedType = types.find((ty) => ty.id === typeId);
  const selectedSub = visibleSubs.find((s) => s.id === subId);

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            1
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("ptAdd.step1")}
          </span>
        </div>
        {selectedType && (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            <Check className="size-3" /> {selectedType.name}
            {selectedSub ? ` → ${selectedSub.name}` : ""}
          </span>
        )}
      </div>

      <div>
        <Label className="mb-2 text-xs text-muted-foreground font-medium">
          {t("ptAdd.typeLabel")}
        </Label>
        <div className="flex flex-wrap gap-2">
          {types.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => onTypeChange(type.id === typeId ? "" : type.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${
                typeId === type.id
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {type.name}
            </button>
          ))}
          <button
            type="button"
            onClick={onNewType}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors min-h-[32px]"
          >
            <Plus className="size-3" /> {t("ptAdd.newType")}
          </button>
        </div>
      </div>

      {typeId && (
        <div>
          <Label className="mb-2 text-xs text-muted-foreground font-medium">
            {t("ptAdd.groupLabel")}{" "}
            <span className="font-normal">({t("ptAdd.groupOptional")})</span>
          </Label>
          <div className="flex flex-wrap gap-2">
            {visibleSubs.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => onSubChange(sub.id === subId ? "" : sub.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${
                  subId === sub.id
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {sub.name}
              </button>
            ))}
            <button
              type="button"
              onClick={onNewSub}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors min-h-[32px]"
            >
              <Plus className="size-3" /> {t("ptAdd.newGroup")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
