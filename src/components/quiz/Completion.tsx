import { lazy, Suspense, useState } from "react";
import { Trophy, Sparkles, Star, Send, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { SessionPublic } from "./types";

const ShareResultCard = lazy(() =>
  import("@/components/ShareResultCard").then((module) => ({ default: module.ShareResultCard })),
);

type Props = {
  session: SessionPublic;
  score: number;
  total: number;
  speedBonus: number;
  participantName?: string;
  participantEmail?: string;
};

export function Completion({ session, score, total, speedBonus, participantName, participantEmail }: Props) {
  const pct = total === 0 ? 0 : Math.round((score / Math.max(total, 1)) * 100);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submitFeedback = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    await supabase.from("quiz_feedback").insert({
      session_id: session.id,
      participant_name: participantName || "Anonymous",
      participant_email: participantEmail ?? null,
      rating,
      comment: comment.trim() || null,
    });
    setSubmitting(false);
    setSubmitted(true);
  };

  return (
    <div className="rounded-3xl border border-border bg-card/60 backdrop-blur p-8 max-w-md w-full text-center shadow-card space-y-6">
      {/* Score section */}
      <div>
        <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
          <Trophy className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold">Quiz completed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Thanks for playing <span className="font-medium text-foreground">{session.title}</span>. The
          host will announce the final results.
        </p>

        <div className="mt-5 rounded-2xl border border-border bg-card/40 p-5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Your score</div>
          <div className="mt-1 font-display text-5xl font-bold text-primary">
            {score}
            <span className="text-2xl text-muted-foreground"> / {total}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{pct}% correct</div>
          {speedBonus > 0 && (
            <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-success/15 text-success px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              <Sparkles className="h-3 w-3" /> +{speedBonus} speed bonus
            </div>
          )}
        </div>
      </div>

      {/* Share result */}
      <Suspense fallback={null}>
        <ShareResultCard
          mode="participant"
          quizTitle={session.title}
          score={score}
          total={total}
          pct={pct}
          speedBonus={speedBonus}
          participantName={participantName}
        />
      </Suspense>

      {/* Feedback section */}
      <div className="rounded-2xl border border-border bg-card/40 p-4 text-left">
        {submitted ? (
          <div className="flex flex-col items-center gap-2 py-3 text-center">
            <CheckCircle className="h-8 w-8 text-success" />
            <p className="text-sm font-semibold">Thanks for your feedback!</p>
            <p className="text-xs text-muted-foreground">Your review has been sent to the host.</p>
          </div>
        ) : (
          <>
            <div className="text-sm font-semibold mb-1">Rate this quiz</div>
            <p className="text-xs text-muted-foreground mb-3">
              Help the host improve future sessions by sharing your experience.
            </p>

            <div className="flex gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHoverRating(n)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-7 w-7 transition-colors ${
                      n <= (hoverRating || rating)
                        ? "text-warning fill-warning"
                        : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
              {rating > 0 && (
                <span className="ml-2 text-xs text-muted-foreground self-center">
                  {["", "Poor", "Fair", "Good", "Great", "Excellent"][rating]}
                </span>
              )}
            </div>

            <Textarea
              placeholder="Any suggestions or comments for the host? (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className="resize-none text-sm mb-3"
              maxLength={500}
            />

            <Button
              size="sm"
              onClick={() => void submitFeedback()}
              disabled={rating === 0 || submitting}
              className="gap-1.5 w-full bg-gradient-primary text-primary-foreground"
            >
              <Send className="h-3.5 w-3.5" />
              {submitting ? "Submitting…" : "Submit Feedback"}
            </Button>
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        You can close this tab. The host has your final score.
      </p>
    </div>
  );
}
