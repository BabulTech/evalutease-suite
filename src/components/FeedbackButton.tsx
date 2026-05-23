import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { FeedbackPanel } from "./feedback-button/FeedbackPanel";

// react-doctor-disable-next-line react-doctor/prefer-useReducer
export function FeedbackButton() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("improvement");
  const [priority, setPriority] = useState("medium");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setTitle("");
    setBody("");
    setType("improvement");
    setPriority("medium");
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
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t("fb.title")}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold shadow-glow hover:scale-105 transition-transform"
      >
        <MessageSquarePlus className="size-4" />
        {t("fb.button")}
      </button>

      {open && (
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
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
