import { X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";

const TYPES = [
  { value: "bug", label: "🐛 Bug report" },
  { value: "feature", label: "💡 Feature request" },
  { value: "improvement", label: "✨ Improvement idea" },
  { value: "other", label: "💬 Other" },
];
const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

type Props = {
  type: string;
  priority: string;
  title: string;
  body: string;
  submitting: boolean;
  onTypeChange: (v: string) => void;
  onPriorityChange: (v: string) => void;
  onTitleChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
};

export function FeedbackPanel({
  type,
  priority,
  title,
  body,
  submitting,
  onTypeChange,
  onPriorityChange,
  onTitleChange,
  onBodyChange,
  onSubmit,
  onClose,
}: Props) {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card shadow-elegant p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display font-semibold text-base">{t("fb.title")}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{t("fb.desc")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("fb.close")}
            title={t("fb.close")}
            className="rounded-xl p-1.5 hover:bg-muted/40 transition-colors"
          >
            <X className="size-4 text-muted-foreground" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1 block">{t("fb.type")}</Label>
            <Select value={type} onValueChange={onTypeChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">{t("fb.priority")}</Label>
            <Select value={priority} onValueChange={onPriorityChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs mb-1 block">{t("fb.titleLabel")}</Label>
          <Input
            placeholder="Brief summary…"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="text-sm"
            maxLength={120}
          />
        </div>

        <div>
          <Label className="text-xs mb-1 block">{t("fb.description")}</Label>
          <Textarea
            placeholder="Describe the issue, idea, or improvement in detail…"
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            rows={4}
            className="resize-none text-sm"
            maxLength={2000}
          />
          <div className="text-[10px] text-muted-foreground text-right mt-1">
            {body.length}/2000
          </div>
        </div>

        <Button
          onClick={onSubmit}
          disabled={submitting || !title.trim() || !body.trim()}
          className="w-full bg-gradient-primary text-primary-foreground shadow-glow gap-1.5"
        >
          <Send className="size-3.5" />
          {submitting ? t("fb.sending") : t("fb.sendToAdmin")}
        </Button>
      </div>
    </div>
  );
}
