import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Archive, ChevronDown, ChevronRight, Crown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/quiz-history")({
  component: QuizHistoryPage,
});

type SessionRow = {
  id: string;
  title: string;
  created_at: string;
  category_id: string | null;
  subcategory_id: string | null;
  default_time_per_question: number | null;
};

type AttemptRow = {
  id: string;
  session_id: string;
  participant_name: string | null;
  participant_email: string | null;
  score: number;
  total_questions: number;
  completed: boolean;
  completed_at: string | null;
};

type SessionWithStats = SessionRow & {
  categoryName: string;
  subcategoryName: string;
  attempts: AttemptRow[];
  avgPercent: number;
};

function QuizHistoryPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionWithStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: ss, error } = await supabase
      .from("quiz_sessions")
      .select("id, title, created_at, category_id, subcategory_id, default_time_per_question")
      .eq("owner_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }
    const rows = (ss ?? []) as SessionRow[];
    if (rows.length === 0) {
      setSessions([]);
      setLoading(false);
      return;
    }
    const sessionIds = rows.map((r) => r.id);
    const subIds = Array.from(new Set(rows.map((r) => r.subcategory_id).filter((v): v is string => !!v)));
    const catIds = Array.from(new Set(rows.map((r) => r.category_id).filter((v): v is string => !!v)));

    const [attemptsRes, subRes, catRes] = await Promise.all([
      supabase
        .from("quiz_attempts")
        .select("id, session_id, participant_name, participant_email, score, total_questions, completed, completed_at")
        .in("session_id", sessionIds)
        .order("score", { ascending: false }),
      subIds.length > 0
        ? supabase.from("question_subcategories").select("id, name").in("id", subIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
      catIds.length > 0
        ? supabase.from("question_categories").select("id, name").in("id", catIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    ]);
    setLoading(false);
    if (attemptsRes.error) toast.error(attemptsRes.error.message);

    const subNames = new Map<string, string>();
    for (const s of subRes.data ?? []) subNames.set(s.id, s.name);
    const catNames = new Map<string, string>();
    for (const c of catRes.data ?? []) catNames.set(c.id, c.name);

    const attemptsBySession = new Map<string, AttemptRow[]>();
    for (const a of (attemptsRes.data ?? []) as AttemptRow[]) {
      const arr = attemptsBySession.get(a.session_id) ?? [];
      arr.push(a);
      attemptsBySession.set(a.session_id, arr);
    }

    setSessions(
      rows.map((r) => {
        const attempts = attemptsBySession.get(r.id) ?? [];
        const submitted = attempts.filter((a) => a.completed);
        const avgPercent =
          submitted.length === 0
            ? 0
            : Math.round(
                submitted.reduce((acc, a) => acc + (a.score / Math.max(1, a.total_questions)) * 100, 0) /
                  submitted.length,
              );
        return {
          ...r,
          categoryName: r.category_id ? catNames.get(r.category_id) ?? "" : "",
          subcategoryName: r.subcategory_id ? subNames.get(r.subcategory_id) ?? "" : "",
          attempts,
          avgPercent,
        };
      }),
    );
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Quiz History</h1>
        <p className="text-muted-foreground mt-1">
          Closed quiz sessions with their final participant results. Click any session to expand.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          Loading…
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
          <Archive className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">No completed sessions yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Once you close a live quiz session, it'll move here with the leaderboard.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => {
            const isOpen = openIds.has(s.id);
            const submitted = s.attempts.filter((a) => a.completed);
            const top = submitted[0];
            return (
              <li
                key={s.id}
                className="rounded-2xl border border-border bg-card/60 transition-colors hover:border-primary/30"
              >
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  className="w-full flex items-center justify-between gap-3 p-5 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <div className="font-display text-lg font-bold truncate">{s.title}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground flex flex-wrap gap-x-2">
                        <span>
                          {[s.categoryName, s.subcategoryName].filter(Boolean).join(" → ") ||
                            "Uncategorised"}
                        </span>
                        <span>·</span>
                        <span>{new Date(s.created_at).toLocaleDateString()}</span>
                        <span>·</span>
                        <span>{submitted.length} submitted</span>
                        <span>·</span>
                        <span>{s.avgPercent}% avg</span>
                      </div>
                    </div>
                  </div>
                  {top && (
                    <div className="hidden sm:flex items-center gap-2 text-xs">
                      <Crown className="h-3.5 w-3.5 text-warning" />
                      <span className="font-medium truncate max-w-[120px]">
                        {top.participant_name ?? "Anonymous"}
                      </span>
                      <span className="text-success font-bold">
                        {top.score}/{top.total_questions}
                      </span>
                    </div>
                  )}
                </button>
                {isOpen && (
                  <div className="border-t border-border p-4">
                    {submitted.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No participants completed this quiz.
                      </p>
                    ) : (
                      <ol className="space-y-1.5">
                        {submitted.map((a, i) => (
                          <li
                            key={a.id}
                            className="flex items-center gap-3 rounded-lg bg-secondary/40 px-3 py-2"
                          >
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold truncate">
                                {a.participant_name ?? "Anonymous"}
                              </div>
                              {a.participant_email && (
                                <div className="text-[10px] text-muted-foreground truncate">
                                  {a.participant_email}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-success">
                                {a.score} / {a.total_questions}
                              </div>
                              {a.completed_at && (
                                <div className="text-[10px] text-muted-foreground">
                                  {new Date(a.completed_at).toLocaleTimeString()}
                                </div>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
