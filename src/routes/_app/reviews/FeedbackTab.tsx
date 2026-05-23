import { MessageSquare, Star } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { FeedbackRow } from "./types";

export function FeedbackTab({ feedbacks }: { feedbacks: FeedbackRow[] }) {
  const { t } = useI18n();
  if (feedbacks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
        <MessageSquare className="mx-auto size-10 text-muted-foreground/60" />
        <p className="mt-3 text-sm font-medium">{t("rev.noFeedback")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("rev.noFeedbackHint")}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {feedbacks.map((f) => (
        <li
          key={f.id}
          className="rounded-2xl border border-border bg-card/60 p-4 hover:border-primary/30 hover:shadow-glow transition-all"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{f.participant_name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {f.session_title}
                {f.participant_email && ` · ${f.participant_email}`}
              </div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`h-3.5 w-3.5 ${n <= f.rating ? "text-warning fill-warning" : "text-muted-foreground"}`}
                />
              ))}
              <span className="ml-1.5 text-xs text-muted-foreground">{f.rating}/5</span>
            </div>
          </div>
          {f.comment && (
            <p className="mt-2 text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
              "{f.comment}"
            </p>
          )}
          <div className="mt-2 text-[10px] text-muted-foreground">
            {new Date(f.submitted_at).toLocaleString()}
          </div>
        </li>
      ))}
    </ul>
  );
}
