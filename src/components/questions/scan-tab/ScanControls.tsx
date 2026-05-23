import { Upload, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RefObject } from "react";
import type { Difficulty } from "../types";

type Props = {
  hint: string;
  setHint: (v: string) => void;
  difficulty: Difficulty;
  setDifficulty: (v: Difficulty) => void;
  fileRef: RefObject<HTMLInputElement | null>;
  extracting: boolean;
  disabled?: boolean;
  hasImage: boolean;
  hasEnoughCredits: boolean;
  creditCost: number;
  onExtract: () => void;
};

export function ScanControls({
  hint,
  setHint,
  difficulty,
  setDifficulty,
  fileRef,
  extracting,
  disabled,
  hasImage,
  hasEnoughCredits,
  creditCost,
  onExtract,
}: Props) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        Notes for Claude (optional)
      </Label>
      <Textarea
        value={hint}
        onChange={(e) => setHint(e.target.value)}
        placeholder={
          "Anything Claude should know about the page - e.g. 'class 10 physics, Urdu medium', 'second column only', 'correct answers are circled'…"
        }
        className="min-h-[160px] text-sm"
      />
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            Default difficulty
          </Label>
          <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
            disabled={extracting || disabled || !hasImage || !hasEnoughCredits}
            className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow flex-1"
          >
            <ScanLine className="size-4" />
            {extracting ? "Reading…" : `Extract (${creditCost} cr)`}
          </Button>
        </div>
      </div>
    </div>
  );
}
