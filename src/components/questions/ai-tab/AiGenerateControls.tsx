import { Wand2, Globe, Coins } from "lucide-react";
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
import { useI18n } from "@/lib/i18n";
import type { Difficulty } from "../types";

type Props = {
  topic: string;
  setTopic: (v: string) => void;
  count: number;
  setCount: (v: number) => void;
  maxCount: number;
  difficulty: Difficulty;
  setDifficulty: (v: Difficulty) => void;
  lang: "en" | "ur";
  setLang: (v: "en" | "ur") => void;
  generating: boolean;
  disabled?: boolean;
  hasEnoughCredits: boolean;
  isFreeAi: boolean;
  totalCost: number;
  creditsBalance: number;
  onGenerate: () => void;
};

export function AiGenerateControls({
  topic,
  setTopic,
  count,
  setCount,
  maxCount,
  difficulty,
  setDifficulty,
  lang,
  setLang,
  generating,
  disabled,
  hasEnoughCredits,
  isFreeAi,
  totalCost,
  creditsBalance,
  onGenerate,
}: Props) {
  const { t } = useI18n();

  return (
    <>
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto]">
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

        <div>
          <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            {t("q.aiCount")}
          </Label>
          <Input
            type="number"
            min={1}
            max={maxCount}
            value={count}
            className="w-24"
            onChange={(e) => setCount(Math.min(maxCount, Math.max(1, Number(e.target.value) || 1)))}
          />
        </div>

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

        <div>
          <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Globe className="size-3.5" /> {t("q.aiLanguage")}
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

        <div className="flex items-end">
          <Button
            type="button"
            onClick={onGenerate}
            disabled={generating || disabled || !hasEnoughCredits}
            className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
          >
            <Wand2 className="size-4" />
            {generating
              ? t("q.aiGenerating")
              : isFreeAi
                ? `${t("q.aiGenerate")} (Free)`
                : `${t("q.aiGenerate")} (${totalCost} cr)`}
          </Button>
        </div>
      </div>

      {!isFreeAi && creditsBalance < totalCost && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <Coins className="size-4 shrink-0" />
          <span>
            You need <strong>{totalCost} credits</strong> but only have{" "}
            <strong>{creditsBalance}</strong>.{" "}
            <a href="/billing" className="underline font-semibold">
              Buy credits →
            </a>
          </span>
        </div>
      )}

      {lang === "ur" && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-primary">
          ✦ {t("q.aiLanguageUrdu")} - سوالات اردو میں تیار کیے جائیں گے
        </div>
      )}
    </>
  );
}
