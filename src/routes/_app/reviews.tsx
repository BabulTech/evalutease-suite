import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Star,
  MessageSquare,
  TrendingUp,
  Users,
  BarChart3,
  CheckCircle2,
  XCircle,
  Trophy,
  Send,
  Bug,
  Lightbulb,
  HelpCircle,
  Clock,
  CheckCircle,
  AlertCircle,
  Ban,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_app/reviews")({
  component: ReviewsPage,
});

type FeedbackRow = {
  id: string;
  session_id: string;
  session_title: string;
  participant_name: string;
  participant_email: string | null;
  rating: number;
  comment: string | null;
  submitted_at: string;
};

type SessionStat = {
  id: string;
  title: string;
  created_at: string;
  participant_count: number;
  avg_pct: number;
  highest_pct: number;
  lowest_pct: number;
  total_correct: number;
  total_wrong: number;
  total_unattempted: number;
  avg_rating: number | null;
  review_count: number;
};

function ReviewsPage() {
  const { user } = useAuth();
  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"feedback" | "performance" | "appreview">("feedback");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: sessions, error: sessErr } = await supabase
      .from("quiz_sessions")
      .select("id, title, created_at")
      .eq("owner_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(50);

    if (sessErr) { toast.error(sessErr.message); setLoading(false); return; }

    const sessionList = sessions ?? [];
    if (sessionList.length === 0) {
      setFeedbacks([]); setSessionStats([]); setLoading(false); return;
    }

    const sessionIds = sessionList.map((s) => s.id);
    const titleById = new Map(sessionList.map((s) => [s.id, s.title]));

    const [feedbackRes, attemptsRes] = await Promise.all([
      supabase
        .from("quiz_feedback")
        .select("id, session_id, participant_name, participant_email, rating, comment, submitted_at")
        .in("session_id", sessionIds)
        .order("submitted_at", { ascending: false }),
      supabase
        .from("quiz_attempts")
        .select("id, session_id, score, total_questions, completed")
        .in("session_id", sessionIds)
        .eq("completed", true),
    ]);

    // Fetch quiz_answers keyed by attempt_id
    const completedAttempts = (attemptsRes.data ?? []);
    const attemptIds = completedAttempts.map((a) => a.id);

    const { data: answerRows } = attemptIds.length > 0
      ? await supabase
          .from("quiz_answers")
          .select("attempt_id, is_correct")
          .in("attempt_id", attemptIds)
      : { data: [] };

    if (feedbackRes.error) toast.error(feedbackRes.error.message);

    // Build enriched feedback
    const enriched: FeedbackRow[] = (feedbackRes.data ?? []).map((f) => ({
      ...f,
      session_title: titleById.get(f.session_id) ?? "Unknown quiz",
    }));
    setFeedbacks(enriched);

    // Per-session answer counts
    const answersByAttempt = new Map<string, { correct: number; wrong: number }>();
    for (const a of answerRows ?? []) {
      const prev = answersByAttempt.get(a.attempt_id) ?? { correct: 0, wrong: 0 };
      if (a.is_correct === true) prev.correct++;
      else if (a.is_correct === false) prev.wrong++;
      answersByAttempt.set(a.attempt_id, prev);
    }

    // Per-session feedback rating
    const ratingsBySession = new Map<string, number[]>();
    for (const f of feedbackRes.data ?? []) {
      const arr = ratingsBySession.get(f.session_id) ?? [];
      arr.push(f.rating);
      ratingsBySession.set(f.session_id, arr);
    }

    // Aggregate per session
    const statsBySession = new Map<
      string,
      { pcts: number[]; correct: number; wrong: number; unattempted: number }
    >();
    for (const a of completedAttempts) {
      const prev = statsBySession.get(a.session_id) ?? { pcts: [], correct: 0, wrong: 0, unattempted: 0 };
      const pct = a.total_questions > 0 ? Math.round((a.score / a.total_questions) * 100) : 0;
      const ans = answersByAttempt.get(a.id) ?? { correct: 0, wrong: 0 };
      const unattempted = Math.max(0, a.total_questions - (ans.correct + ans.wrong));
      prev.pcts.push(pct);
      prev.correct += ans.correct;
      prev.wrong += ans.wrong;
      prev.unattempted += unattempted;
      statsBySession.set(a.session_id, prev);
    }

    const computed: SessionStat[] = sessionList.map((s) => {
      const st = statsBySession.get(s.id);
      const ratings = ratingsBySession.get(s.id) ?? [];
      const pcts = st?.pcts ?? [];
      return {
        id: s.id,
        title: s.title,
        created_at: s.created_at,
        participant_count: pcts.length,
        avg_pct: pcts.length > 0 ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0,
        highest_pct: pcts.length > 0 ? Math.max(...pcts) : 0,
        lowest_pct: pcts.length > 0 ? Math.min(...pcts) : 0,
        total_correct: st?.correct ?? 0,
        total_wrong: st?.wrong ?? 0,
        total_unattempted: st?.unattempted ?? 0,
        avg_rating: ratings.length > 0
          ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
          : null,
        review_count: ratings.length,
      };
    });

    setSessionStats(computed);
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const totalReviews = feedbacks.length;
  const avgRating = totalReviews > 0
    ? (feedbacks.reduce((acc, f) => acc + f.rating, 0) / totalReviews).toFixed(1)
    : null;
  const quizzesWithFeedback = new Set(feedbacks.map((f) => f.session_id)).size;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-2">
          <Star className="h-7 w-7 text-warning" /> Reviews
        </h1>
        <p className="text-muted-foreground mt-1">
          Participant feedback and real quiz performance data from your completed sessions.
        </p>
      </div>

      {/* Summary cards — all real data */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="group rounded-2xl border border-border bg-card/60 p-5 hover:border-primary/40 hover:shadow-glow transition-all duration-300">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            <MessageSquare className="h-3.5 w-3.5" /> Total Reviews
          </div>
          <div className="font-display text-3xl font-bold">{totalReviews}</div>
        </div>
        <div className="group rounded-2xl border border-border bg-card/60 p-5 hover:border-primary/40 hover:shadow-glow transition-all duration-300">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            <Star className="h-3.5 w-3.5 text-warning" /> Avg Rating
          </div>
          <div className="font-display text-3xl font-bold text-warning">
            {avgRating ?? "—"}
            {avgRating && <span className="text-lg text-muted-foreground">/5</span>}
          </div>
        </div>
        <div className="group rounded-2xl border border-border bg-card/60 p-5 hover:border-primary/40 hover:shadow-glow transition-all duration-300">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            <Users className="h-3.5 w-3.5" /> Quizzes Reviewed
          </div>
          <div className="font-display text-3xl font-bold">{quizzesWithFeedback}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/40 w-fit flex-wrap">
        {([
          { key: "feedback",    label: "Participant Feedback" },
          { key: "performance", label: "Quiz Performance" },
          { key: "appreview",   label: "App Review" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === key
                ? "bg-card shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && activeTab !== "appreview" ? (
        <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          Loading…
        </div>
      ) : activeTab === "feedback" ? (
        <FeedbackTab feedbacks={feedbacks} />
      ) : activeTab === "performance" ? (
        <PerformanceTab stats={sessionStats} />
      ) : (
        user && <AppReviewTab userId={user.id} />
      )}
    </div>
  );
}

/* ── Feedback tab ── */
function FeedbackTab({ feedbacks }: { feedbacks: FeedbackRow[] }) {
  if (feedbacks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
        <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/60" />
        <p className="mt-3 text-sm font-medium">No participant feedback yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Participants can rate and comment after completing a quiz. It will appear here.
        </p>
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
                  className={`h-3.5 w-3.5 ${
                    n <= f.rating ? "text-warning fill-warning" : "text-muted-foreground"
                  }`}
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

/* ── Performance tab — 100% real data, no generated text ── */
function PerformanceTab({ stats }: { stats: SessionStat[] }) {
  if (stats.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
        <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/60" />
        <p className="mt-3 text-sm font-medium">No completed sessions yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Performance data appears once you close a quiz session.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {stats.map((s) => (
        <div
          key={s.id}
          className="rounded-2xl border border-border bg-card/60 p-5 hover:border-primary/30 hover:shadow-glow transition-all"
        >
          {/* Title row */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <div className="font-semibold truncate">{s.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {new Date(s.created_at).toLocaleDateString(undefined, {
                  day: "numeric", month: "short", year: "numeric",
                })}
                {" · "}
                {s.participant_count} participant{s.participant_count !== 1 ? "s" : ""}
              </div>
            </div>
            {/* Avg rating badge if feedback exists */}
            {s.avg_rating !== null && (
              <div className="flex items-center gap-1 shrink-0 rounded-full bg-warning/10 border border-warning/25 px-2.5 py-1 text-xs font-semibold text-warning">
                <Star className="h-3 w-3 fill-warning" />
                {s.avg_rating}/5
                <span className="text-warning/60 font-normal">({s.review_count})</span>
              </div>
            )}
          </div>

          {/* Score stats */}
          {s.participant_count > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl bg-secondary/40 px-3 py-2.5 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Avg Score</div>
                  <div className={`text-xl font-bold ${scoreColor(s.avg_pct)}`}>{s.avg_pct}%</div>
                </div>
                <div className="rounded-xl bg-secondary/40 px-3 py-2.5 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-center gap-1">
                    <Trophy className="h-3 w-3 text-warning" /> Highest
                  </div>
                  <div className="text-xl font-bold text-warning">{s.highest_pct}%</div>
                </div>
                <div className="rounded-xl bg-secondary/40 px-3 py-2.5 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Lowest</div>
                  <div className={`text-xl font-bold ${scoreColor(s.lowest_pct)}`}>{s.lowest_pct}%</div>
                </div>
              </div>

              {/* Answer breakdown */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="font-semibold">{s.total_correct}</span> correct
                </div>
                <div className="flex items-center gap-1.5 text-destructive">
                  <XCircle className="h-3.5 w-3.5" />
                  <span className="font-semibold">{s.total_wrong}</span> wrong
                </div>
                {s.total_unattempted > 0 && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="font-semibold">{s.total_unattempted}</span> skipped
                  </div>
                )}
              </div>

              {/* Avg score bar */}
              <div className="mt-3">
                <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColor(s.avg_pct)}`}
                    style={{ width: `${s.avg_pct}%` }}
                  />
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No participants completed this session.</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── App Review Tab ────────────────────────────────────────────
const FEEDBACK_TYPES = [
  { value: "bug",         label: "Bug report",       icon: Bug },
  { value: "feature",     label: "Feature request",  icon: Lightbulb },
  { value: "improvement", label: "Improvement idea", icon: TrendingUp },
  { value: "other",       label: "Other",            icon: HelpCircle },
] as const;

const PRIORITIES = ["low", "medium", "high", "critical"] as const;

type AppFeedbackRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  status: string;
  priority: string;
  admin_reply: string | null;
  created_at: string;
};

function statusIcon(s: string) {
  if (s === "open")      return <Clock className="h-3.5 w-3.5 text-primary" />;
  if (s === "in_review") return <AlertCircle className="h-3.5 w-3.5 text-warning" />;
  if (s === "resolved")  return <CheckCircle className="h-3.5 w-3.5 text-success" />;
  return <Ban className="h-3.5 w-3.5 text-muted-foreground" />;
}
function statusCls(s: string) {
  if (s === "open")      return "bg-primary/15 text-primary";
  if (s === "in_review") return "bg-warning/15 text-warning";
  if (s === "resolved")  return "bg-success/15 text-success";
  return "bg-muted/40 text-muted-foreground";
}

function AppReviewTab({ userId }: { userId: string }) {
  const [submissions, setSubmissions] = useState<AppFeedbackRow[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [type, setType]         = useState<string>("improvement");
  const [priority, setPriority] = useState<string>("medium");
  const [title, setTitle]       = useState("");
  const [body, setBody]         = useState("");
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

  useEffect(() => { void loadSubmissions(); }, [loadSubmissions]);

  const submit = async () => {
    if (!title.trim() || !body.trim()) { toast.error("Title and description are required"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("app_feedback").insert({
      user_id: userId, type, priority, title: title.trim(), body: body.trim(),
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Review submitted — thank you for your feedback!");
    setTitle(""); setBody(""); setType("improvement"); setPriority("medium");
    void loadSubmissions();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Submit form */}
      <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-4 hover:border-primary/30 hover:shadow-glow transition-all duration-300">
        <div>
          <h3 className="font-semibold">Share Your Feedback</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Report bugs, request features, or suggest improvements for Evalutease.
            Your feedback is reviewed by the admin team.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1.5 block">Feedback type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEEDBACK_TYPES.map(({ value, label, icon: Icon }) => (
                  <SelectItem key={value} value={value}>
                    <span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" />{label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs mb-1.5 block">Title</Label>
          <Input
            placeholder="Short summary of your feedback…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            className="text-sm"
          />
        </div>

        <div>
          <Label className="text-xs mb-1.5 block">Description</Label>
          <Textarea
            placeholder="Describe in detail — steps to reproduce, what you'd like changed, or ideas…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            maxLength={2000}
            className="resize-none text-sm"
          />
          <div className="text-[10px] text-muted-foreground text-right mt-1">{body.length}/2000</div>
        </div>

        <Button
          onClick={() => void submit()}
          disabled={submitting || !title.trim() || !body.trim()}
          className="w-full bg-gradient-primary text-primary-foreground shadow-glow gap-1.5"
        >
          <Send className="h-3.5 w-3.5" />
          {submitting ? "Submitting…" : "Submit to Admin"}
        </Button>
      </div>

      {/* Past submissions */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm px-1">Your Submissions</h3>

        {loadingSubs ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : submissions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/30 p-8 text-center">
            <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">No submissions yet.</p>
          </div>
        ) : (
          <ul className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
            {submissions.map((s) => {
              const TypeDef = FEEDBACK_TYPES.find((t) => t.value === s.type);
              const TypeIcon = TypeDef?.icon ?? HelpCircle;
              return (
                <li key={s.id} className="rounded-2xl border border-border bg-card/60 p-4 hover:border-primary/30 hover:shadow-glow transition-all space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="rounded-lg bg-muted/40 p-1.5 mt-0.5 shrink-0">
                      <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold truncate">{s.title}</span>
                        <Badge className={`${statusCls(s.status)} border-0 text-[10px] gap-0.5 capitalize`}>
                          {statusIcon(s.status)} {s.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{s.body}</p>
                    </div>
                  </div>

                  {s.admin_reply && (
                    <div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2">
                      <div className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-0.5">Admin Reply</div>
                      <p className="text-xs text-foreground">{s.admin_reply}</p>
                    </div>
                  )}

                  <div className="text-[10px] text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                    {" · "}
                    <span className="capitalize">{s.priority} priority · {TypeDef?.label}</span>
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

function scoreColor(pct: number) {
  if (pct >= 70) return "text-success";
  if (pct >= 40) return "text-warning";
  return "text-destructive";
}

function barColor(pct: number) {
  if (pct >= 70) return "bg-success";
  if (pct >= 40) return "bg-warning";
  return "bg-destructive";
}
