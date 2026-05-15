import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Wand2, Globe, Coins, Zap } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { ListChecks, ToggleLeft, Shuffle, PenLine, FileText } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { usePlan } from "@/contexts/PlanContext";

const MAX_AI_COUNT = 20;

type Props = {
  disabled?: boolean;
  onSave: (drafts: DraftQuestion[]) => Promise<void>;
  saving: boolean;
};

type GenKind = "mcq" | "true_false" | "short_answer" | "long_answer" | "mix";

export function AiTab({ disabled, onSave, saving }: Props) {
  const { t } = useI18n();
  const { plan, credits, reload, isAiAllowed } = usePlan();
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [lang, setLang] = useState<"en" | "ur">("en");
  const [kind, setKind] = useState<GenKind>("mcq");
  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
  const [generating, setGenerating] = useState(false);

  // Credits cost: 1 credit per 10 questions (rounded up)
  const creditCost = plan?.credit_cost_ai_10q ?? 3;
  // credit_cost_ai_10q = credits per 10 questions → scale per actual count
  const ratePerQuestion = creditCost / 10;
  const totalCost = Math.max(1, Math.ceil(count * ratePerQuestion));

  const generate = async () => {
    if (!topic.trim()) {
      toast.error(t("q.aiTopicError"));
      return;
    }
    if (count < 1 || count > MAX_AI_COUNT) {
      toast.error(t("q.aiCountError"));
      return;
    }

    // Pre-flight balance check (UI only — server deducts authoritatively)
    if (credits.balance < totalCost) {
      toast.error(`Not enough credits. Need ${totalCost}, you have ${credits.balance}. Buy more credits in Billing.`);
      return;
    }

    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Please sign in again to use AI features.");
        return;
      }
      const out = await generateQuestions({ data: { topic, count, difficulty, language: lang, kind, _token: session.access_token } });
      if (out.length === 0) {
        toast.error(t("q.aiNoQuestions"));
        return;
      }
      setDrafts(out);
      reload(); // Refresh credit balance shown in UI
      toast.success(`${out.length} ${t("q.aiGenSuccess")} · ${totalCost} credits used`);
    } catch (err) {
      const msg = (err as Error)?.message ?? "AI generation failed";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  // AI not enabled on this plan — show upgrade gate
  if (!isAiAllowed) {
    return (
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-8 text-center space-y-4">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <div>
          <div className="font-display font-bold text-lg">AI Features Require a Paid Plan</div>
          <div className="text-sm text-muted-foreground mt-1">
            Upgrade to Individual Pro or higher to generate questions with AI.
          </div>
        </div>
        <a href="/billing" className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold shadow-glow hover:opacity-90 transition-opacity">
          <Zap className="h-4 w-4" /> Upgrade to Pro
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <Sparkles className="h-4 w-4" /> {t("q.aiTitle")}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Coins className="h-3.5 w-3.5 text-warning" />
            <span className="text-warning font-semibold">{credits.balance}</span>
            <span>credits · {count} questions =</span>
            <span className="font-semibold text-foreground">{totalCost} credits</span>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t("q.aiDesc")}</p>
      </div>

      {/* Type picker */}
      <div>
        <Label className="mb-2 text-xs uppercase tracking-wider text-muted-foreground block">
          Question Type
        </Label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {[
            { value: "mcq" as const, label: "Multiple Choice", Icon: ListChecks, desc: "4 options, 1 correct" },
            { value: "true_false" as const, label: "True / False", Icon: ToggleLeft, desc: "Statement is T or F" },
            { value: "short_answer" as const, label: "Short Answer", Icon: PenLine, desc: "Type a brief reply" },
            { value: "long_answer" as const, label: "Long Answer", Icon: FileText, desc: "Essay question" },
            { value: "mix" as const, label: "Mix (Random)", Icon: Shuffle, desc: "Claude varies types" },
          ].map(({ value, label, Icon, desc }) => {
            const active = kind === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                className={`rounded-2xl border p-3 text-left transition-all ${
                  active
                    ? "border-primary bg-primary/10 shadow-glow"
                    : "border-border bg-card/40 hover:border-primary/50 cursor-pointer"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-semibold ${active ? "text-primary" : ""}`}>
                    {label}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{desc}</p>
              </button>
            );
          })}
        </div>
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
            disabled={generating || disabled || credits.balance < totalCost}
            className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
          >
            <Wand2 className="h-4 w-4" />
            {generating ? t("q.aiGenerating") : `${t("q.aiGenerate")} (${totalCost} cr)`}
          </Button>
        </div>
      </div>

      {/* Insufficient credits warning */}
      {credits.balance < totalCost && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <Coins className="h-4 w-4 shrink-0" />
          <span>You need <strong>{totalCost} credits</strong> but only have <strong>{credits.balance}</strong>. <a href="/billing" className="underline font-semibold">Buy credits →</a></span>
        </div>
      )}

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
