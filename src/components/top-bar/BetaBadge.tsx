import { useEffect, useRef, useState } from "react";
import { FlaskConical, MessageSquarePlus, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { FeedbackPanel } from "@/components/feedback-button/FeedbackPanel";

// Beta indicator shown in the top bar (web + mobile). Tapping it explains that
// the app is in beta and offers a shortcut to send feedback. The feedback form
// reuses the shared FeedbackPanel so there is a single source of truth.
// react-doctor-disable-next-line react-doctor/prefer-useReducer
export function BetaBadge() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [fbOpen, setFbOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const [type, setType] = useState("improvement");
  const [priority, setPriority] = useState("medium");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const reset = () => {
    setTitle("");
    setBody("");
    setType("improvement");
    setPriority("medium");
  };

  const openFeedback = () => {
    setOpen(false);
    setFbOpen(true);
  };

  const submit = async () => {
    if (!user) return;
    if (!title.trim() || !body.trim()) {
      toast.error(t("fb.required"));
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("app_feedback").insert({
      user_id: user.id,
      type,
      priority,
      title: title.trim(),
      body: body.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("fb.sent"));
    reset();
    setFbOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="You're using the beta version — tap for info & feedback"
        aria-label="Beta version information and feedback"
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold bg-amber-400/10 text-amber-500 hover:bg-amber-400/20 transition-colors"
      >
        <FlaskConical size={13} />
        <span>Beta</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-border bg-card shadow-elegant p-4 z-50 space-y-3">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 rounded-lg bg-amber-400/10 p-1.5 text-amber-500">
              <Info size={15} />
            </span>
            <div>
              <p className="text-sm font-semibold">You're on the beta</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Jancho is still in early access. Some features may change and a
                few rough edges are expected. Your feedback helps us improve.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openFeedback}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary text-primary-foreground px-3 py-2 text-sm font-semibold shadow-glow hover:opacity-90 transition-opacity"
          >
            <MessageSquarePlus className="size-4" />
            {t("fb.button")}
          </button>
        </div>
      )}

      {fbOpen && (
        <FeedbackPanel
          type={type}
          priority={priority}
          title={title}
          body={body}
          submitting={submitting}
          onTypeChange={setType}
          onPriorityChange={setPriority}
          onTitleChange={setTitle}
          onBodyChange={setBody}
          onSubmit={() => void submit()}
          onClose={() => setFbOpen(false)}
        />
      )}
    </div>
  );
}
