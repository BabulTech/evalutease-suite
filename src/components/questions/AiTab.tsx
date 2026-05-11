import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Wand2, Globe } from "lucide-react";
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
import { useI18n } from "@/lib/i18n";

const MAX_AI_COUNT = 20;

type Props = {
  disabled?: boolean;
  onSave: (drafts: DraftQuestion[]) => Promise<void>;
  saving: boolean;
};

export function AiTab({ disabled, onSave, saving }: Props) {
  const { t } = useI18n();
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [lang, setLang] = useState<"en" | "ur">("en");
  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    if (!topic.trim()) {
      toast.error(t("q.aiTopicError"));
      return;
    }
    if (count < 1 || count > MAX_AI_COUNT) {
      toast.error(t("q.aiCountError"));
      return;
    }
    setGenerating(true);
    try {
      const out = await generateQuestions({ data: { topic, count, difficulty, language: lang } });
      if (out.length === 0) {
        toast.error(t("q.aiNoQuestions"));
        return;
      }
      setDrafts(out);
      toast.success(`${out.length} ${t("q.aiGenSuccess")}`);
    } catch (err) {
      const msg = (err as Error)?.message ?? "AI generation failed";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 font-semibold text-primary">
          <Sparkles className="h-4 w-4" /> {t("q.aiTitle")}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t("q.aiDesc")}</p>
      </div>

      {/* Controls */}
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto]">
        {/* Topic */}
        <div>
          <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            {t("q.aiTopic")}
          </Label>
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t("q.aiTopicPlaceholder")}
          />
        </div>

        {/* Count */}
        <div>
          <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            {t("q.aiCount")}
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

        {/* Difficulty */}
        <div>
          <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            {t("q.difficulty")}
          </Label>
          <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">{t("q.easy")}</SelectItem>
              <SelectItem value="medium">{t("q.medium")}</SelectItem>
              <SelectItem value="hard">{t("q.hard")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Language */}
        <div>
          <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Globe className="h-3.5 w-3.5" /> {t("q.aiLanguage")}
          </Label>
          <Select value={lang} onValueChange={(v) => setLang(v as "en" | "ur")}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{t("q.aiLanguageEnglish")}</SelectItem>
              <SelectItem value="ur">{t("q.aiLanguageUrdu")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Generate button */}
        <div className="flex items-end">
          <Button
            type="button"
            onClick={generate}
            disabled={generating || disabled}
            className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
          >
            <Wand2 className="h-4 w-4" />
            {generating ? t("q.aiGenerating") : t("q.aiGenerate")}
          </Button>
        </div>
      </div>

      {/* Language badge */}
      {lang === "ur" && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-primary">
          ✦ {t("q.aiLanguageUrdu")} - سوالات اردو میں تیار کیے جائیں گے
        </div>
      )}

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
