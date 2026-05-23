import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Ban,
  CheckCircle,
  Clock,
  HelpCircle,
  MessageSquare,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FEEDBACK_TYPES, PRIORITIES, PRIORITY_CLS } from "./types";
import type { AppFeedbackRow } from "./types";

function statusIcon(s: string) {
  if (s === "open") return <Clock className="size-3.5 text-primary" />;
  if (s === "in_review") return <AlertCircle className="size-3.5 text-warning" />;
  if (s === "resolved") return <CheckCircle className="size-3.5 text-success" />;
  return <Ban className="size-3.5 text-muted-foreground" />;
}

function statusCls(s: string) {
  if (s === "open") return "bg-primary/15 text-primary";
  if (s === "in_review") return "bg-warning/15 text-warning";
  if (s === "resolved") return "bg-success/15 text-success";
  return "bg-muted/40 text-muted-foreground";
}

// react-doctor-disable-next-line react-doctor/prefer-useReducer
export function AppReviewTab({ userId }: { userId: string }) {
  const { t } = useI18n();
  const [submissions, setSubmissions] = useState<AppFeedbackRow[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [type, setType] = useState<string>("improvement");
  const [priority, setPriority] = useState<string>("medium");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadSubmissions = useCallback(async () => {
    setLoadingSubs(true);
    const { data } = await supabase
      .from("app_feedback")
      .select("id,type,title,body,status,priority,admin_reply,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setSubmissions(data ?? []);
    setLoadingSubs(false);
  }, [userId]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  const submit = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error(t("fb.required"));
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("app_feedback").insert({
      user_id: userId,
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
    toast.success(t("rev.submitSuccess"));
    setTitle("");
    setBody("");
    setType("improvement");
    setPriority("medium");
    void loadSubmissions();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Submit form */}
      <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-4 hover:border-primary/30 hover:shadow-glow transition-all duration-300">
        <div>
          <h3 className="font-semibold">{t("rev.shareFeedback")}</h3>
          <p className="text-xs text-muted-foreground mt-1">{t("rev.shareFeedbackDesc")}</p>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs mb-2 block">{t("rev.feedbackType")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {FEEDBACK_TYPES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium min-h-[36px] transition-colors ${
                    type === value
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-card/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  <Icon className="size-3.5 shrink-0" /> {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs mb-2 block">{t("rev.priority")}</Label>
            <div className="flex gap-2 flex-wrap">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium min-h-[28px] capitalize transition-colors ${
                    priority === p
                      ? PRIORITY_CLS[p].active
                      : "border-border bg-card/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <Label className="text-xs mb-1.5 block">{t("rev.feedbackTitle")}</Label>
          <Input
            placeholder="Short summary of your feedback…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            className="text-sm"
          />
        </div>

        <div>
          <Label className="text-xs mb-1.5 block">{t("rev.description")}</Label>
          <Textarea
            placeholder="Describe in detail - steps to reproduce, what you'd like changed, or ideas…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            maxLength={2000}
            className="resize-none text-sm"
          />
          <div className="text-[10px] text-muted-foreground text-right mt-1">
            {body.length}/2000
          </div>
        </div>

        <Button
          onClick={() => void submit()}
          disabled={submitting || !title.trim() || !body.trim()}
          className="w-full bg-gradient-primary text-primary-foreground shadow-glow gap-1.5"
        >
          <Send className="size-3.5" />
          {submitting ? t("rev.submitting") : t("rev.submitToAdmin")}
        </Button>
      </div>

      {/* Past submissions */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm px-1">{t("rev.yourSubmissions")}</h3>
        {loadingSubs ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : submissions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/30 p-8 text-center">
            <MessageSquare className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">{t("rev.noSubmissions")}</p>
          </div>
        ) : (
          <ul className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
            {submissions.map((s) => {
              const TypeDef = FEEDBACK_TYPES.find((ft) => ft.value === s.type);
              const TypeIcon = TypeDef?.icon ?? HelpCircle;
              return (
                <li
                  key={s.id}
                  className="rounded-2xl border border-border bg-card/60 p-4 hover:border-primary/30 hover:shadow-glow transition-all space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <div className="rounded-lg bg-muted/40 p-1.5 mt-0.5 shrink-0">
                      <TypeIcon className="size-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold truncate">{s.title}</span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${statusCls(s.status)}`}
                        >
                          {statusIcon(s.status)} {s.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                        {s.body}
                      </p>
                    </div>
                  </div>
                  {s.admin_reply && (
                    <div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2">
                      <div className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-0.5">
                        {t("rev.adminReply")}
                      </div>
                      <p className="text-xs text-foreground">{s.admin_reply}</p>
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {" · "}
                    <span className="capitalize">
                      {s.priority} priority · {TypeDef?.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
