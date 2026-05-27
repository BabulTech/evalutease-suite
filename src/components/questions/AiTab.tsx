import { useState, useEffect } from "react";
import { toast } from "sonner";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { DraftReview } from "./DraftReview";
import { generateQuestions } from "./ai.server";
import { type DraftQuestion, type Difficulty } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { usePlan } from "@/contexts/PlanContext";
import { QuestionKindPicker, type GenKind } from "./ai-tab/QuestionKindPicker";
import { AiTabHeader } from "./ai-tab/AiTabHeader";
import { TrialNotice } from "./ai-tab/TrialNotice";
import { AiGenerateControls } from "./ai-tab/AiGenerateControls";
import { AiUpgradeGate } from "./ai-tab/AiUpgradeGate";

const MAX_AI_COUNT_DEFAULT = 20;
const MAX_AI_COUNT_FREE = 10;

type Props = {
  disabled?: boolean;
  onSave: (drafts: DraftQuestion[]) => Promise<void>;
  saving: boolean;
};

// react-doctor-disable-next-line react-doctor/prefer-useReducer
export function AiTab({ disabled, onSave, saving }: Props) {
  const { t } = useI18n();
  const { plan, credits, reload, isAiAllowed, loading: planLoading } = usePlan();
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [lang, setLang] = useState<"en" | "ur">("en");
  const [kind, setKind] = useState<GenKind>("mcq");
  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
  const [generating, setGenerating] = useState(false);

  const isFreeAi = plan?.slug === "enterprise_free";
  const MAX_AI_COUNT = isFreeAi ? MAX_AI_COUNT_FREE : MAX_AI_COUNT_DEFAULT;
  const freeAiLimit = plan?.trial_ai_calls ?? 10;

  const [freeAiUsed, setFreeAiUsed] = useState<number | null>(null);
  useEffect(() => {
    if (!isFreeAi) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("trial_ai_usage")
      .select("used_calls")
      .maybeSingle()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: any) => setFreeAiUsed(data?.used_calls ?? 0));
  }, [isFreeAi]);
  const freeAiRemaining = freeAiLimit - (freeAiUsed ?? 0);

  const creditCost =
    kind === "true_false"
      ? (plan?.credit_cost_ai_tf_10q ?? 2)
      : kind === "short_answer"
        ? (plan?.credit_cost_ai_short_10q ?? 3)
        : kind === "long_answer"
          ? (plan?.credit_cost_ai_long_10q ?? 5)
          : kind === "mix"
            ? (plan?.credit_cost_ai_mix_10q ?? 4)
            : (plan?.credit_cost_ai_10q ?? 3);
  const totalCost = Math.max(1, Math.ceil(count * (creditCost / 10)));
  const hasEnoughCredits = isFreeAi ? freeAiRemaining > 0 : credits.balance >= totalCost;

  const generate = async () => {
    if (!topic.trim()) {
      toast.error(t("q.aiTopicError"));
      return;
    }
    if (count < 1 || count > MAX_AI_COUNT) {
      toast.error(t("q.aiCountError"));
      return;
    }
    if (isFreeAi && freeAiRemaining <= 0) {
      toast.error(
        "Your 10 complimentary AI calls have been used. Upgrade to Enterprise Pro for full AI access.",
      );
      return;
    }
    if (!isFreeAi && credits.balance < totalCost) {
      toast.error(
        `Not enough credits. Need ${totalCost}, you have ${credits.balance}. Buy more credits in Billing.`,
      );
      return;
    }
    setGenerating(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Please sign in again to use AI features.");
        return;
      }
      const out = await generateQuestions({
        data: { topic, count, difficulty, language: lang, kind, _token: session.access_token },
      });
      if (out.length === 0) {
        toast.error(t("q.aiNoQuestions"));
        return;
      }
      setDrafts(out);
      if (isFreeAi) {
        setFreeAiUsed((prev) => (prev !== null ? prev + 1 : 1));
        window.dispatchEvent(new CustomEvent("free-ai-consumed"));
      } else {
        reload();
      }
      toast.success(
        isFreeAi
          ? `${out.length} ${t("q.aiGenSuccess")} · 1 free AI call used (${freeAiRemaining - 1} left)`
          : `${out.length} ${t("q.aiGenSuccess")} · ${totalCost} credits used`,
      );
    } catch (err) {
      toast.error((err as Error)?.message ?? "AI generation failed");
    } finally {
      setGenerating(false);
    }
  };

  if (planLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card/30 p-8 text-center">
        <div className="mx-auto size-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <p className="mt-3 text-sm text-muted-foreground">Loading AI features…</p>
      </div>
    );
  }

  if (!isAiAllowed) return <AiUpgradeGate />;
  // Lock the AI tab once free-plan users exhaust their lifetime allowance
  if (isFreeAi && freeAiUsed !== null && freeAiUsed >= freeAiLimit) {
    return <AiUpgradeGate />;
  }

  return (
    <>
      <LoadingOverlay visible={generating} variant="ai" />
      <div className="space-y-5">
        <AiTabHeader
          isFreeAi={isFreeAi}
          freeAiUsed={freeAiUsed}
          freeAiRemaining={freeAiRemaining}
          freeAiLimit={freeAiLimit}
          creditsBalance={credits.balance}
          count={count}
          totalCost={totalCost}
        />
        {isFreeAi && (
          <TrialNotice
            freeAiRemaining={freeAiRemaining}
            freeAiLimit={freeAiLimit}
            maxCount={MAX_AI_COUNT_FREE}
          />
        )}
        <QuestionKindPicker kind={kind} onChange={setKind} />
        <AiGenerateControls
          topic={topic}
          setTopic={setTopic}
          count={count}
          setCount={setCount}
          maxCount={MAX_AI_COUNT}
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          lang={lang}
          setLang={setLang}
          generating={generating}
          disabled={disabled}
          hasEnoughCredits={hasEnoughCredits}
          isFreeAi={isFreeAi}
          totalCost={totalCost}
          creditsBalance={credits.balance}
          onGenerate={generate}
        />
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
    </>
  );
}
