import { ScanLine, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { RefObject } from "react";

type Props = {
  hint: string;
  onHintChange: (v: string) => void;
  fileRef: RefObject<HTMLInputElement | null>;
  onExtract: () => void;
  extracting: boolean;
  canExtract: boolean;
  creditCost: number;
};

export function ScanControls({
  hint,
  onHintChange,
  fileRef,
  onExtract,
  extracting,
  canExtract,
  creditCost,
}: Props) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        Notes for Claude (optional)
      </Label>
      <Textarea
        value={hint}
        onChange={(e) => onHintChange(e.target.value)}
        placeholder="Anything Claude should know - e.g. 'class 9-A roll-call sheet, names in column 2', 'ignore signatures'…"
        className="min-h-[160px] text-sm"
      />
      <div className="flex items-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => fileRef.current?.click()}
          className="gap-2"
        >
          <Upload className="size-4" /> Image
        </Button>
        <Button
          type="button"
          onClick={onExtract}
          disabled={extracting || !canExtract}
          className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow flex-1"
        >
          <ScanLine className="size-4" />
          {extracting ? "Reading…" : `Extract (${creditCost} cr)`}
        </Button>
      </div>
    </div>
  );
}
