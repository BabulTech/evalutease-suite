import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { PlanInfo } from "@/contexts/PlanContext";
import type { Stats, RecentSession } from "./types";

const FREE_SLUGS = ["individual_starter", "enterprise_free"];

export function useDashboardData(user: User | null, plan: PlanInfo | null, skip: boolean) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    sessions: 0,
    active: 0,
    participants: 0,
    questions: 0,
  });
  const [recent, setRecent] = useState<RecentSession[]>([]);
  const [credits, setCredits] = useState<{
    balance: number;
    total_earned: number;
    total_spent: number;
  } | null>(null);

  useEffect(() => {
    if (!user || skip) return;
    setLoading(true);
    (async () => {
      const [sess, active, parts, qs, recentSessions] = await Promise.all([
        supabase
          .from("quiz_sessions")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id),
        supabase
          .from("quiz_sessions")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id)
          .eq("status", "active"),
        supabase
          .from("participants")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id),
        supabase
          .from("questions")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id),
        supabase
          .from("quiz_sessions")
          .select("id, title, status, created_at")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      // react-doctor-disable-next-line react-doctor/no-event-handler
      setStats({
        // react-doctor-disable-next-line react-doctor/no-event-handler
        sessions: sess.count ?? 0,
        active: active.count ?? 0,
        participants: parts.count ?? 0,
        questions: qs.count ?? 0,
      });
      setRecent(recentSessions.data ?? []);
      // react-doctor-disable-next-line react-doctor/no-event-handler
      if (plan && !FREE_SLUGS.includes(plan.slug)) {
        // react-doctor-disable-next-line react-doctor/no-event-handler
        const creditsRow = await supabase
          .from("user_credits")
          .select("balance, total_earned, total_spent")
          .eq("user_id", user.id)
          .maybeSingle();
        if (creditsRow.data) setCredits(creditsRow.data);
      }
      setLoading(false);
    })();
  }, [user, plan, skip]);

  return { stats, recent, credits, loading };
}

export { FREE_SLUGS };
