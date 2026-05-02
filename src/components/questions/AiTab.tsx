import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DraftReview } from "./DraftReview";
import { generateQuestions } from "./ai.server";
import { type DraftQuestion, type Difficulty } from "./types";

const MAX_AI_COUNT = 20;

type Props = {
  disabled?: boolean;
  onSave: (drafts: DraftQuestion[]) => Promise<void>;
  saving: boolean;
};

export function AiTab({ disabled, onSave, saving }: Props) {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    if (!topic.trim()) {
      toast.error("Enter a topic to generate questions about");
      return;
    }
    if (count < 1 || count > MAX_AI_COUNT) {
      toast.error(`Pick a count between 1 and ${MAX_AI_COUNT}`);
      return;
    }
    setGenerating(true);
    try {
      const out = await generateQuestions({ data: { topic, count, difficulty } });
      if (out.length === 0) {
        toast.error("Claude returned no questions. Try a more specific topic.");
        return;
      }
      setDrafts(out);
      toast.success(
        `Generated ${out.length} question${out.length === 1 ? "" : "s"} — review and edit before saving`,
      );
    } catch (err) {
      const msg = (err as Error)?.message ?? "AI generation failed";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 font-semibold text-primary">
          <Sparkles className="h-4 w-4" /> AI-assisted draft generator
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Generates MCQ drafts using Claude (server-side). The generated questions appear below for
          you to review and edit before saving. Requires{" "}
          <span className="font-mono">ANTHROPIC_API_KEY</span> on the server.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
        <div>
          <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            Topic
          </Label>
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Photosynthesis, Mughal Empire, Trigonometry…"
          />
        </div>
        <div>
          <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            Count
          </Label>
          <Input
            type="number"
            min={1}
            max={MAX_AI_COUNT}
            value={count}
            onChange={(e) =>
              setCount(Math.min(MAX_AI_COUNT, Math.max(1, Number(e.target.value) || 1)))
            }
            className="w-24"
          />
        </div>
        <div>
          <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            Difficulty
          </Label>
          <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            onClick={generate}
            disabled={generating || disabled}
            className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
          >
            <Wand2 className="h-4 w-4" />
            {generating ? "Generating…" : "Generate"}
          </Button>
        </div>
      </div>

      <DraftReview
        drafts={drafts}
        setDrafts={setDrafts}
        source="ai"
        saving={saving || !!disabled}
        onSave={async (d) => {
          await onSave(d);
          setDrafts([]);
          setTopic("");
        }}
        onClear={() => setDrafts([])}
      />
    </div>
  );
}
