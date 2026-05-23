import { useEffect, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Target,
  TrendingUp,
  Trophy,
  X,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Participant } from "@/components/participants/types";
import type { ParticipantStats } from "./types";

function StatTile({
  icon,
  label,
  value,
  color,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl px-3 py-2.5 ${highlight ? "bg-primary/10 border border-primary/20" : "bg-secondary/40"}`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-lg font-bold ${color ?? (highlight ? "text-primary" : "")}`}>
        {value}
      </div>
    </div>
  );
}

export function ParticipantStatsPanel({
  participant,
  onClose,
}: {
  participant: Participant;
  onClose: () => void;
}) {
  const [stats, setStats] = useState<ParticipantStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // react-doctor-disable-next-line react-doctor/no-adjust-state-on-prop-change
    setLoading(true);
    setStats(null);
    (async () => {
      const { data: attempts, error } = await supabase
        .from("quiz_attempts")
        .select(
          "id, session_id, score, total_questions, completed, completed_at, quiz_answers ( id, is_correct )",
        )
        .eq("participant_id", participant.id)
        .eq("completed", true)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false });
      if (cancelled) return;
      if (error || !attempts?.length) {
        setStats({
          totalAttempts: 0,
          totalCorrect: 0,
          totalWrong: 0,
          avgScore: 0,
          highestScore: 0,
          lowestScore: 0,
          lastQuizAt: null,
          recentAttempts: [],
        });
        setLoading(false);
        return;
      }
      const sessionIds = Array.from(new Set(attempts.map((r) => r.session_id)));
      const { data: sessions } = await supabase
        .from("quiz_sessions")
        .select("id, title")
        .in("id", sessionIds);
      if (cancelled) return;
      const titleById = new Map((sessions ?? []).map((s) => [s.id, s.title]));
      let totalCorrect = 0;
      let totalWrong = 0;
      const pctScores: number[] = [];
      for (const a of attempts) {
        const answers = (a.quiz_answers ?? []) as { id: string; is_correct: boolean | null }[];
        totalCorrect += answers.filter((x) => x.is_correct === true).length;
        totalWrong += answers.filter((x) => x.is_correct === false).length;
        pctScores.push(a.total_questions > 0 ? Math.round((a.score / a.total_questions) * 100) : 0);
      }
      const avgScore =
        pctScores.length > 0
          ? Math.round(pctScores.reduce((a, b) => a + b, 0) / pctScores.length)
          : 0;
      setStats({
        totalAttempts: attempts.length,
        totalCorrect,
        totalWrong,
        avgScore,
        highestScore: pctScores.length ? Math.max(...pctScores) : 0,
        lowestScore: pctScores.length ? Math.min(...pctScores) : 0,
        lastQuizAt: attempts[0]?.completed_at ?? null,
        recentAttempts: attempts.slice(0, 5).map((a) => {
          const pct = a.total_questions > 0 ? Math.round((a.score / a.total_questions) * 100) : 0;
          return {
            title: titleById.get(a.session_id) ?? "Unknown quiz",
            score: a.score,
            total: a.total_questions,
            pct,
            date: a.completed_at ? new Date(a.completed_at).toLocaleDateString() : "-",
          };
        }),
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [participant.id]);

  const initials = participant.name.slice(0, 2).toUpperCase();
  const typeBadge = participant.metadata.participant_type;

  return (
    <div className="rounded-2xl border border-primary/30 bg-card/70 shadow-glow overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{participant.name}</div>
            <div className="text-[10px] text-muted-foreground truncate">
              {typeBadge && <span className="capitalize mr-1">{typeBadge} -</span>}
              {participant.email || participant.mobile || "No contact info"}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close stats"
          className="p-1.5 rounded-lg hover:bg-muted/40 transition-colors shrink-0 min-h-[32px] min-w-[32px] flex items-center justify-center"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground animate-pulse">
            Loading stats…
          </div>
        ) : !stats || stats.totalAttempts === 0 ? (
          <div className="py-6 text-center">
            <BarChart3 className="mx-auto size-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No quiz history yet</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <StatTile
                icon={<Target className="size-3.5 text-primary" />}
                label="Quizzes"
                value={stats.totalAttempts}
              />
              <StatTile
                icon={<TrendingUp className="size-3.5 text-primary" />}
                label="Avg Score"
                value={`${stats.avgScore}%`}
                highlight
              />
              <StatTile
                icon={<CheckCircle2 className="size-3.5 text-success" />}
                label="Correct"
                value={stats.totalCorrect}
                color="text-success"
              />
              <StatTile
                icon={<XCircle className="size-3.5 text-destructive" />}
                label="Wrong"
                value={stats.totalWrong}
                color="text-destructive"
              />
              <StatTile
                icon={<Trophy className="size-3.5 text-warning" />}
                label="Highest"
                value={`${stats.highestScore}%`}
                color="text-warning"
              />
              <StatTile
                icon={<Trophy className="size-3.5 text-muted-foreground" />}
                label="Lowest"
                value={`${stats.lowestScore}%`}
              />
            </div>
            {stats.lastQuizAt && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5 shrink-0" />
                Last quiz:{" "}
                {new Date(stats.lastQuizAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </div>
            )}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Average performance</span>
                <span className="font-bold">{stats.avgScore}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${stats.avgScore >= 70 ? "bg-success" : stats.avgScore >= 40 ? "bg-warning" : "bg-destructive"}`}
                  style={{ width: `${stats.avgScore}%` }}
                />
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Last {Math.min(stats.recentAttempts.length, 5)} Quizzes
              </div>
              <ul className="space-y-1.5">
                {stats.recentAttempts.map((a, i) => (
                  <li
                    key={`${i}-${a.title}`}
                    className="flex items-center justify-between gap-2 rounded-xl bg-secondary/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{a.title}</div>
                      <div className="text-[10px] text-muted-foreground">{a.date}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`text-xs font-bold ${a.pct >= 70 ? "text-success" : a.pct >= 40 ? "text-warning" : "text-destructive"}`}
                      >
                        {a.score}/{a.total}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{a.pct}%</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
