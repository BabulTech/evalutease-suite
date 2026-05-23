import { useState } from "react";
import { Star, Send, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  sessionId: string;
  participantName?: string;
  participantEmail?: string;
};

// react-doctor-disable-next-line react-doctor/prefer-useReducer
export function FeedbackForm({ sessionId, participantName, participantEmail }: Props) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submitFeedback = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    await supabase.from("quiz_feedback").insert({
      session_id: sessionId,
      participant_name: participantName || "Anonymous",
      participant_email: participantEmail ?? null,
      rating,
      comment: comment.trim() || null,
    });
    setSubmitting(false);
    setSubmitted(true);
  };

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4 text-left">
      {submitted ? (
        <div className="flex flex-col items-center gap-2 py-3 text-center">
          <CheckCircle className="size-8 text-success" />
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
                title={["", "Poor", "Fair", "Good", "Great", "Excellent"][n]}
                aria-label={["", "Poor", "Fair", "Good", "Great", "Excellent"][n]}
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
            <Send className="size-3.5" />
            {submitting ? "Submitting…" : "Submit Feedback"}
          </Button>
        </>
      )}
    </div>
  );
}
