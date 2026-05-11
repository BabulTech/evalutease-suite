import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import {
  ChevronLeft,
  Copy,
  Download,
  Mail,
  PauseCircle,
  Pencil,
  PlayCircle,
  PlaySquare,
  Printer,
  StopCircle,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaginationControls } from "@/components/PaginationControls";
import { paginate } from "@/lib/pagination";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatTimePerQuestion, statusBadge } from "@/components/sessions/types";
import type { Session as SessionLite, SessionStatus } from "@/components/sessions/types";
import type { LeaderboardEntry } from "@/components/sessions/Leaderboard";
import {
  downloadQuizReportCsv,
  getQuizReportRows,
  type QuizReportAttempt,
} from "@/lib/quiz-reports";
import { copyText } from "@/lib/copy-text";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export const Route = createFileRoute("/_app/sessions/$sessionId")({
  component: SessionLobbyPage,
});

const PARTICIPANT_PAGE_SIZES = [10, 25, 50];
const RESULT_PAGE_SIZE = 25;

const Leaderboard = lazy(() =>
  import("@/components/sessions/Leaderboard").then((module) => ({ default: module.Leaderboard })),
);

type SessionRow = {
  id: string;
  title: string;
  status: SessionStatus;
  default_time_per_question: number | null;
  access_code: string | null;
  is_open: boolean;
  scheduled_at: string | null;
  started_at: string | null;
  paused_at: string | null;
  pause_offset_seconds: number;
  category_id: string | null;
  subcategory_id: string | null;
  created_at: string;
  subject: string | null;
  topic: string | null;
  description: string | null;
};

type Attendee = {
  id: string;
  name: string;
  email: string | null;
  rollNumber: string | null;
  seatNumber: string | null;
  completed: boolean;
  score: number;
  total: number;
  attempted: number;
  correct: number;
  wrong: number;
  unattempted: number;
  completedAt: string | null;
};

type AttemptWithDetails = {
  id: string;
  participant_name: string | null;
  participant_email: string | null;
  participant_id: string | null;
  completed: boolean;
  completed_at: string | null;
  score: number;
  total_questions: number;
  quiz_answers: { id: string; is_correct: boolean | null }[] | null;
  participants: { metadata: unknown } | null;
};

type AttemptLive = {
  id: string;
  participant_name: string | null;
  participant_email: string | null;
  participant_id: string | null;
  completed: boolean;
  completed_at: string | null;
  score: number;
  total_questions: number;
  metadata: unknown;
};

type ProfileRow = {
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  organization: string | null;
};

type ParticipantStatusBroadcast = {
  status?: SessionStatus;
  started_at?: string | null;
  scheduled_at?: string | null;
  paused_at?: string | null;
  pause_offset_seconds?: number;
  is_open?: boolean;
};

function SessionLobbyPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [session, setSession] = useState<SessionRow | null>(null);
  const isMobile = useIsMobile();
  const [categoryName, setCategoryName] = useState<string>("");
  const [subcategoryName, setSubcategoryName] = useState<string>("");
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [rosterEmails, setRosterEmails] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(0);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [attendeeTotal, setAttendeeTotal] = useState(0);
  const [waitingAttendees, setWaitingAttendees] = useState<Attendee[]>([]);
  const [submittedAttendees, setSubmittedAttendees] = useState<Attendee[]>([]);
  const [waitingTotal, setWaitingTotal] = useState(0);
  const [submittedTotal, setSubmittedTotal] = useState(0);
  const [livePage, setLivePage] = useState(0);
  const [waitingPage, setWaitingPage] = useState(0);
  const [submittedPage, setSubmittedPage] = useState(0);
  const [attendeePageSize, setAttendeePageSize] = useState(isMobile ? 10 : 25);
  const [participantQuery, setParticipantQuery] = useState("");
  const debouncedParticipantQuery = useDebouncedValue(participantQuery, 300);
  const [liveSort, setLiveSort] = useState<"score" | "completed_at" | "started_at">("score");
  const [lobbySort, setLobbySort] = useState<"started_at" | "name">("started_at");
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const attendeeRefreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAttemptChanges = useRef<Map<string, Record<string, unknown>>>(new Map());
  const rafFlushRef = useRef<number | null>(null);

  const loadSession = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("quiz_sessions")
      .select(
        "id, title, status, default_time_per_question, access_code, is_open, scheduled_at, started_at, paused_at, pause_offset_seconds, category_id, subcategory_id, created_at, subject, topic, description",
      )
      .eq("id", sessionId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data) return;
    setSession(data as SessionRow);

    const [catRes, subRes, qCount, profileRes, rosterRes] = await Promise.all([
      data.category_id
        ? supabase
            .from("question_categories")
            .select("name")
            .eq("id", data.category_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      data.subcategory_id
        ? supabase
            .from("question_subcategories")
            .select("name")
            .eq("id", data.subcategory_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("quiz_session_questions")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId),
      supabase
        .from("profiles")
        .select("full_name, first_name, last_name, organization")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("quiz_session_participants")
        .select("participants ( email )")
        .eq("session_id", sessionId),
    ]);
    setCategoryName(catRes.data?.name ?? "");
    setSubcategoryName(subRes.data?.name ?? "");
    setQuestionCount(qCount.count ?? 0);
    if (profileRes.data) setProfile(profileRes.data as ProfileRow);
    const emails = ((rosterRes.data ?? []) as { participants: { email: string | null } | null }[])
      .map((row) => row.participants?.email?.trim())
      .filter((email): email is string => !!email);
    setRosterEmails(Array.from(new Set(emails)));
  }, [sessionId, user]);

  const loadLiveAttendees = useCallback(async () => {
    const offset = livePage * attendeePageSize;
    const searchTerm = debouncedParticipantQuery.trim();
    const [pageRes, submittedRes] = await Promise.all([
      (() => {
        let query = supabase
          .from("quiz_attempts")
          .select(
            "id, participant_name, participant_email, participant_id, completed, completed_at, score, total_questions, participants ( metadata )",
            { count: "exact" },
          )
          .eq("session_id", sessionId);
        if (searchTerm) {
          query = query.or(
            `participant_name.ilike.%${searchTerm}%,participant_email.ilike.%${searchTerm}%`,
          );
        }
        if (liveSort === "completed_at") {
          query = query.order("completed_at", { ascending: true }).order("score", { ascending: false });
        } else if (liveSort === "started_at") {
          query = query.order("started_at", { ascending: true });
        } else {
          query = query.order("score", { ascending: false }).order("started_at", { ascending: true });
        }
        return query.range(offset, offset + attendeePageSize - 1);
      })(),
      (() => {
        let query = supabase
          .from("quiz_attempts")
          .select("id", { count: "exact", head: true })
          .eq("session_id", sessionId)
          .eq("completed", true);
        if (searchTerm) {
          query = query.or(
            `participant_name.ilike.%${searchTerm}%,participant_email.ilike.%${searchTerm}%`,
          );
        }
        return query;
      })(),
    ]);

    if (pageRes.error || submittedRes.error) return;

    const pageRows = (pageRes.data ?? []) as {
      id: string;
      participant_name: string | null;
      participant_email: string | null;
      participant_id: string | null;
      completed: boolean;
      completed_at: string | null;
      score: number;
      total_questions: number;
      participants: { metadata: unknown } | null;
    }[];
    const mapped = pageRows.map((row) =>
      mapLiveAttempt({
        id: row.id,
        participant_name: row.participant_name,
        participant_email: row.participant_email,
        participant_id: row.participant_id,
        completed: row.completed,
        completed_at: row.completed_at,
        score: row.score,
        total_questions: row.total_questions,
        metadata: row.participants?.metadata ?? {},
      }),
    );

    const total = pageRes.count ?? 0;
    const submittedCount = submittedRes.count ?? 0;
    setAttendees(sortAttendees(mapped));
    setAttendeeTotal(total);
    setSubmittedTotal(submittedCount);
    setWaitingTotal(Math.max(0, total - submittedCount));
  }, [attendeePageSize, debouncedParticipantQuery, livePage, liveSort, sessionId]);

  const loadLobbyAttendees = useCallback(async () => {
    const waitingOffset = waitingPage * attendeePageSize;
    const submittedOffset = submittedPage * attendeePageSize;
    const searchTerm = debouncedParticipantQuery.trim();
    const [waitingRes, submittedRes] = await Promise.all([
      (() => {
        let query = supabase
          .from("quiz_attempts")
          .select(
            "id, participant_name, participant_email, participant_id, completed, completed_at, score, total_questions, participants ( metadata )",
            { count: "exact" },
          )
          .eq("session_id", sessionId)
          .eq("completed", false);
        if (searchTerm) {
          query = query.or(
            `participant_name.ilike.%${searchTerm}%,participant_email.ilike.%${searchTerm}%`,
          );
        }
        if (lobbySort === "name") {
          query = query.order("participant_name", { ascending: true });
        } else {
          query = query.order("started_at", { ascending: true });
        }
        return query.range(waitingOffset, waitingOffset + attendeePageSize - 1);
      })(),
      (() => {
        let query = supabase
          .from("quiz_attempts")
          .select(
            "id, participant_name, participant_email, participant_id, completed, completed_at, score, total_questions, participants ( metadata )",
            { count: "exact" },
          )
          .eq("session_id", sessionId)
          .eq("completed", true);
        if (searchTerm) {
          query = query.or(
            `participant_name.ilike.%${searchTerm}%,participant_email.ilike.%${searchTerm}%`,
          );
        }
        if (lobbySort === "name") {
          query = query.order("participant_name", { ascending: true });
        } else {
          query = query.order("completed_at", { ascending: false });
        }
        return query.range(submittedOffset, submittedOffset + attendeePageSize - 1);
      })(),
    ]);

    if (waitingRes.error || submittedRes.error) return;

    const waitingRows = (waitingRes.data ?? []) as AttemptWithDetails[];
    const submittedRows = (submittedRes.data ?? []) as AttemptWithDetails[];

    setWaitingAttendees(
      sortAttendees(
        waitingRows.map((row) =>
          mapLiveAttempt({
            id: row.id,
            participant_name: row.participant_name,
            participant_email: row.participant_email,
            participant_id: row.participant_id,
            completed: row.completed,
            completed_at: row.completed_at,
            score: row.score,
            total_questions: row.total_questions,
            metadata: row.participants?.metadata ?? {},
          }),
        ),
      ),
    );

    setSubmittedAttendees(
      sortAttendees(
        submittedRows.map((row) =>
          mapLiveAttempt({
            id: row.id,
            participant_name: row.participant_name,
            participant_email: row.participant_email,
            participant_id: row.participant_id,
            completed: row.completed,
            completed_at: row.completed_at,
            score: row.score,
            total_questions: row.total_questions,
            metadata: row.participants?.metadata ?? {},
          }),
        ),
      ),
    );

    const waitingCount = waitingRes.count ?? 0;
    const submittedCount = submittedRes.count ?? 0;
    setWaitingTotal(waitingCount);
    setSubmittedTotal(submittedCount);
    setAttendeeTotal(waitingCount + submittedCount);
  }, [attendeePageSize, debouncedParticipantQuery, lobbySort, sessionId, submittedPage, waitingPage]);

  const loadDetailedAttendees = useCallback(async () => {
    const { data, error } = await supabase
      .from("quiz_attempts")
      .select(
        "id, participant_name, participant_email, participant_id, completed, completed_at, score, total_questions, quiz_answers ( id, is_correct ), participants ( metadata )",
      )
      .eq("session_id", sessionId)
      .order("score", { ascending: false })
      .order("completed_at", { ascending: false });
    if (error) return;
    setAttendees(sortAttendees(
      ((data ?? []) as AttemptWithDetails[]).map((a) => {
        const meta =
          a.participants?.metadata && typeof a.participants.metadata === "object"
            ? (a.participants.metadata as Record<string, unknown>)
            : {};
        const answers = a.quiz_answers ?? [];
        const correct = answers.filter((answer) => answer.is_correct === true).length;
        const wrong = answers.filter((answer) => answer.is_correct === false).length;
        const attempted = answers.length;
        return {
          id: a.id,
          name: a.participant_name ?? "Anonymous",
          email: a.participant_email,
          rollNumber: stringMeta(meta.roll_number),
          seatNumber: stringMeta(meta.seat_number),
          completed: a.completed,
          score: a.score,
          total: a.total_questions,
          attempted,
          correct,
          wrong,
          unattempted: Math.max(0, a.total_questions - attempted),
          completedAt: a.completed_at,
        };
      }),
    ));
  }, [sessionId]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!session) return;
    if (session.status === "completed") {
      void loadDetailedAttendees();
      return;
    }
    if (session.status === "active") {
      void loadLiveAttendees();
      return;
    }
    void loadLobbyAttendees();
  }, [loadDetailedAttendees, loadLiveAttendees, loadLobbyAttendees, session]);

  useEffect(() => {
    if (livePage > 0 && attendeeTotal <= livePage * attendeePageSize) {
      setLivePage(0);
    }
  }, [attendeePageSize, attendeeTotal, livePage]);

  useEffect(() => {
    if (waitingPage > 0 && waitingTotal <= waitingPage * attendeePageSize) {
      setWaitingPage(0);
    }
  }, [attendeePageSize, waitingPage, waitingTotal]);

  useEffect(() => {
    if (submittedPage > 0 && submittedTotal <= submittedPage * attendeePageSize) {
      setSubmittedPage(0);
    }
  }, [attendeePageSize, submittedPage, submittedTotal]);

  useEffect(() => {
    setAttendeePageSize(isMobile ? 10 : 25);
  }, [isMobile]);

  useEffect(() => {
    setLivePage(0);
    setWaitingPage(0);
    setSubmittedPage(0);
  }, [attendeePageSize]);

  const scheduleAttendeeRefresh = useCallback(() => {
    if (attendeeRefreshRef.current) return;
    attendeeRefreshRef.current = setTimeout(() => {
      attendeeRefreshRef.current = null;
      if (session?.status === "completed") void loadDetailedAttendees();
      else if (session?.status === "active") void loadLiveAttendees();
      else void loadLobbyAttendees();
    }, 2500);
  }, [loadDetailedAttendees, loadLiveAttendees, loadLobbyAttendees, session?.status]);

  const flushAttemptChanges = useCallback(() => {
    rafFlushRef.current = null;
    const pending = pendingAttemptChanges.current;
    if (pending.size === 0) return;
    const rows = Array.from(pending.values());
    pending.clear();
    setAttendees((current) => {
      let changed = false;
      const copy = [...current];
      for (const row of rows) {
        const id = typeof row.id === "string" ? row.id : null;
        if (!id) continue;
        const next = mapLiveAttempt({
          id,
          participant_name: typeof row.participant_name === "string" ? row.participant_name : null,
          participant_email: typeof row.participant_email === "string" ? row.participant_email : null,
          participant_id: typeof row.participant_id === "string" ? row.participant_id : null,
          completed: row.completed === true,
          completed_at: typeof row.completed_at === "string" ? row.completed_at : null,
          score: typeof row.score === "number" ? row.score : 0,
          total_questions: typeof row.total_questions === "number" ? row.total_questions : questionCount,
          metadata: {},
        });
        const index = copy.findIndex((a) => a.id === id);
        if (index === -1) continue;
        copy[index] = {
          ...copy[index],
          ...next,
          rollNumber: next.rollNumber ?? copy[index].rollNumber,
          seatNumber: next.seatNumber ?? copy[index].seatNumber,
        };
        changed = true;
      }
      return changed ? sortAttendees(copy) : current;
    });
  }, [questionCount]);

  const applyAttemptChange = useCallback((row: Record<string, unknown>) => {
    const id = typeof row.id === "string" ? row.id : null;
    if (!id) return;
    // Accumulate into the map (later update for same id overwrites earlier one)
    pendingAttemptChanges.current.set(id, row);
    // Schedule a single flush on the next animation frame
    if (rafFlushRef.current === null) {
      rafFlushRef.current = requestAnimationFrame(flushAttemptChanges);
    }
  }, [flushAttemptChanges]);

  // Live: refresh on session/attempt changes.
  useEffect(() => {
    const ch = supabase
      .channel(`lobby-route-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "quiz_sessions", filter: `id=eq.${sessionId}` },
        () => void loadSession(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quiz_attempts",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.eventType !== "DELETE") {
            applyAttemptChange(payload.new as Record<string, unknown>);
          }
          scheduleAttendeeRefresh();
        },
      )
      .subscribe();
    return () => {
      if (attendeeRefreshRef.current) {
        clearTimeout(attendeeRefreshRef.current);
        attendeeRefreshRef.current = null;
      }
      if (rafFlushRef.current !== null) {
        cancelAnimationFrame(rafFlushRef.current);
        rafFlushRef.current = null;
      }
      pendingAttemptChanges.current.clear();
      void supabase.removeChannel(ch);
    };
  }, [sessionId, loadSession, scheduleAttendeeRefresh]);

  const joinUrl = useMemo(() => {
    if (!session?.access_code) return "";
    // Allow a hard-coded public base (e.g. https://babulquize.netlify.app) to override
    // window.location.origin — useful when the host is browsing the dashboard on a
    // host-only adapter (192.168.56.x) that phones can't reach.
    const envBase = (import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined)?.replace(/\/$/, "");
    if (envBase) return `${envBase}/q/${session.access_code}`;
    if (typeof window === "undefined") return `/q/${session.access_code}`;
    return `${window.location.origin}/q/${session.access_code}`;
  }, [session?.access_code]);

  const copy = async (text: string, label: string) => {
    const ok = await copyText(text);
    if (ok) toast.success(`${label} copied`);
    else toast.error(`Could not copy ${label}`);
  };

  const emailParticipants = () => {
    if (!joinUrl || rosterEmails.length === 0) return;
    const subjectLine = encodeURIComponent(`Quiz invite: ${session?.title ?? "Quiz"}`);
    const body = encodeURIComponent(
      [
        `Please join the quiz using this link:`,
        joinUrl,
        "",
        `Access code: ${session?.access_code ?? ""}`,
      ].join("\n"),
    );
    window.location.href = `mailto:?bcc=${encodeURIComponent(rosterEmails.join(","))}&subject=${subjectLine}&body=${body}`;
  };

  const start = async () => {
    if (!session) return;
    const startedAt = new Date().toISOString();
    setBusy(true);
    const { error } = await supabase
      .from("quiz_sessions")
      .update({
        status: "active",
        started_at: startedAt,
        paused_at: null,
        pause_offset_seconds: 0,
      })
      .eq("id", session.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await broadcastParticipantStatus(session.access_code, {
      status: "active",
      started_at: startedAt,
      paused_at: null,
      pause_offset_seconds: 0,
      is_open: true,
    });
    toast.success("Quiz started — participants will see questions");
    void loadSession();
  };

  const pause = async () => {
    if (!session) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("pause_quiz_session", { p_session_id: session.id });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const payload = data as { error?: string };
    if (payload?.error) {
      toast.error(payload.error);
      return;
    }
    const pausedAt =
      data && typeof data === "object" && "paused_at" in data && typeof data.paused_at === "string"
        ? data.paused_at
        : new Date().toISOString();
    await broadcastParticipantStatus(session.access_code, {
      status: "active",
      paused_at: pausedAt,
      pause_offset_seconds: session.pause_offset_seconds,
    });
    toast.success("Quiz paused");
    void loadSession();
  };

  const resume = async () => {
    if (!session) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("resume_quiz_session", { p_session_id: session.id });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const payload = data as { error?: string };
    if (payload?.error) {
      toast.error(payload.error);
      return;
    }
    const addedSeconds =
      data && typeof data === "object" && "added_seconds" in data && typeof data.added_seconds === "number"
        ? data.added_seconds
        : 0;
    await broadcastParticipantStatus(session.access_code, {
      status: "active",
      paused_at: null,
      pause_offset_seconds: session.pause_offset_seconds + addedSeconds,
    });
    toast.success("Quiz resumed");
    void loadSession();
  };

  const closeSession = async () => {
    if (!session) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("close_quiz_session", { p_session_id: session.id });
    setBusy(false);
    setConfirmClose(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const payload = data as { error?: string };
    if (payload?.error) {
      toast.error(payload.error);
      return;
    }
    await broadcastParticipantStatus(session.access_code, {
      status: "completed",
      paused_at: null,
      is_open: false,
    });
    toast.success("Quiz closed — moved to Quiz History");
    void navigate({ to: "/quiz-history" });
  };

  const remove = async () => {
    if (!session) return;
    setBusy(true);
    const { error } = await supabase.from("quiz_sessions").delete().eq("id", session.id);
    setBusy(false);
    setConfirmDelete(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Session deleted");
    void navigate({ to: "/sessions" });
  };

  const saveEdit = async (newTitle: string, newTime: number) => {
    if (!session) return;
    const { error } = await supabase
      .from("quiz_sessions")
      .update({ title: newTitle.trim(), default_time_per_question: newTime })
      .eq("id", session.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved");
    setEditOpen(false);
    void loadSession();
  };

  if (!session) {
    return (
      <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
        Loading session…
      </div>
    );
  }

  const sessionLite: SessionLite = {
    id: session.id,
    title: session.title,
    category_id: session.category_id,
    category_name: subcategoryName || categoryName || null,
    status: session.status,
    default_time_per_question: session.default_time_per_question ?? 60,
    access_code: session.access_code,
    is_open: session.is_open,
    scheduled_at: session.scheduled_at,
    created_at: session.created_at,
    question_count: questionCount,
    participant_count: session.status === "completed" ? attendees.length : attendeeTotal,
    attempts: {
      joined: session.status === "completed" ? attendees.length : attendeeTotal,
      waiting:
        session.status === "completed"
          ? attendees.filter((a) => !a.completed).length
          : waitingTotal,
      submitted:
        session.status === "completed"
          ? attendees.filter((a) => a.completed).length
          : submittedTotal,
      avgPercent: 0,
      topThree: [],
    },
  };
  const badge = statusBadge(sessionLite);
  const paused = !!session.paused_at;
  const isActive = session.status === "active";
  const isCompleted = session.status === "completed";
  const joined = isCompleted ? attendees.length : attendeeTotal;
  const waiting = isCompleted ? attendees.filter((a) => !a.completed) : waitingAttendees;
  const submitted = isCompleted ? attendees.filter((a) => a.completed) : submittedAttendees;
  const reportAttempts = toReportAttempts(attendees);
  const teacherName = getTeacherName(profile, user?.email);
  const schoolName = profile?.organization ?? "";
  const subject = session.subject || [categoryName, subcategoryName].filter(Boolean).join(" -> ") || "Not specified";

  return (
    <div className="space-y-6">
      <Link
        to="/sessions"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Back
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-3xl font-bold tracking-tight">{session.title}</h1>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${badge.className}`}
            >
              {paused ? "Paused" : badge.label}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-sm flex flex-wrap gap-x-2 items-center">
            <span>
              {[categoryName, subcategoryName].filter(Boolean).join(" → ") || "Uncategorised"}
            </span>
            <span>·</span>
            <span>
              {questionCount} question{questionCount === 1 ? "" : "s"}
            </span>
            <span>·</span>
            <span>{formatTimePerQuestion(session.default_time_per_question ?? 60)}</span>
          </p>
        </div>
      </div>

      {/* Action bar — disabled entirely when the quiz is finished. */}
      <div className="flex flex-wrap gap-2 print:hidden">
        {!isActive && !isCompleted && (
          <Button
            onClick={start}
            disabled={busy}
            className="bg-gradient-primary text-primary-foreground shadow-glow gap-1.5"
          >
            <PlayCircle className="h-4 w-4" /> Start Quiz
          </Button>
        )}
        {!isCompleted && rosterEmails.length > 0 && (
          <Button variant="outline" onClick={emailParticipants} className="gap-1.5">
            <Mail className="h-4 w-4" /> Email Participants
          </Button>
        )}
        {isActive && !paused && (
          <Button onClick={pause} disabled={busy} variant="outline" className="gap-1.5">
            <PauseCircle className="h-4 w-4" /> Pause
          </Button>
        )}
        {isActive && paused && (
          <Button
            onClick={resume}
            disabled={busy}
            className="bg-gradient-primary text-primary-foreground shadow-glow gap-1.5"
          >
            <PlaySquare className="h-4 w-4" /> Resume
          </Button>
        )}
        {!isActive && !isCompleted && (
          <Button
            variant="outline"
            onClick={() => setEditOpen(true)}
            disabled={busy}
            className="gap-1.5"
          >
            <Pencil className="h-4 w-4" /> Edit Quiz
          </Button>
        )}
        {isActive && (
          <Button
            onClick={() => setConfirmClose(true)}
            disabled={busy}
            variant="outline"
            className="gap-1.5 text-warning border-warning/40 hover:bg-warning/10 hover:text-warning"
          >
            <StopCircle className="h-4 w-4" /> Close Session
          </Button>
        )}
        {!isActive && !isCompleted && (
          <Button
            variant="outline"
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
            className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        )}
        {isCompleted && (
          <>
            <Button
              variant="outline"
              onClick={() => window.print()}
              className="gap-1.5"
            >
              <Printer className="h-4 w-4" /> Print Results
            </Button>
            <Button
              onClick={() =>
                downloadQuizReportCsv({
                  title: session.title,
                  categoryLabel: [categoryName, subcategoryName].filter(Boolean).join(" -> "),
                  teacherName,
                  schoolName,
                  subjectLabel: subject,
                  topicLabel: session.topic ?? "",
                  createdAt: session.created_at,
                  questionCount,
                  attempts: reportAttempts,
                })
              }
              className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow"
            >
              <Download className="h-4 w-4" /> Download Excel
            </Button>
          </>
        )}
      </div>

      {/* === STATUS-DRIVEN MAIN AREA === */}
      {isCompleted ? (
        <ResultsView
          attendees={attendees}
          title={session.title}
          categoryLabel={[categoryName, subcategoryName].filter(Boolean).join(" → ") || ""}
          questionCount={questionCount}
          createdAt={session.created_at}
          reportAttempts={reportAttempts}
          teacherName={teacherName}
          schoolName={schoolName}
          subjectLabel={subject}
          topicLabel={session.topic ?? ""}
        />
      ) : isActive ? (
        <LiveView
          attendees={attendees}
          joinUrl={joinUrl}
          accessCode={session.access_code ?? ""}
          onCopy={copy}
          paused={paused}
          joinedTotal={attendeeTotal}
          submittedTotal={submittedTotal}
          query={participantQuery}
          onQueryChange={setParticipantQuery}
          sort={liveSort}
          onSortChange={setLiveSort}
          page={livePage}
          total={attendeeTotal}
          onPageChange={setLivePage}
          pageSize={attendeePageSize}
          onPageSizeChange={setAttendeePageSize}
        />
      ) : (
        <LobbyView
          attendees={attendees}
          joinUrl={joinUrl}
          accessCode={session.access_code ?? ""}
          onCopy={copy}
          waiting={waiting}
          submitted={submitted}
          joined={joined}
          waitingTotal={waitingTotal}
          submittedTotal={submittedTotal}
          query={participantQuery}
          onQueryChange={setParticipantQuery}
          sort={lobbySort}
          onSortChange={setLobbySort}
          waitingPage={waitingPage}
          submittedPage={submittedPage}
          onWaitingPageChange={setWaitingPage}
          onSubmittedPageChange={setSubmittedPage}
          pageSize={attendeePageSize}
          onPageSizeChange={setAttendeePageSize}
        />
      )}

      <EditSessionDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initialTitle={session.title}
        initialTime={session.default_time_per_question ?? 60}
        onSave={saveEdit}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{session.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The session, its question list, attempts, and answers will all be removed. This can't
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void remove();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this quiz session?</AlertDialogTitle>
            <AlertDialogDescription>
              Participants who haven't submitted yet will lose their place. The session will be
              archived under Quiz History with the final results.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void closeSession();
              }}
            >
              {busy ? "Closing…" : "Close session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ===== Status-driven views =====

function LobbyView({
  attendees: _attendees,
  joinUrl,
  accessCode,
  onCopy,
  waiting,
  submitted,
  joined,
  waitingTotal,
  submittedTotal,
  query,
  onQueryChange,
  sort,
  onSortChange,
  waitingPage,
  submittedPage,
  onWaitingPageChange,
  onSubmittedPageChange,
  pageSize,
  onPageSizeChange,
}: {
  attendees: Attendee[];
  joinUrl: string;
  accessCode: string;
  onCopy: (text: string, label: string) => Promise<void>;
  waiting: Attendee[];
  submitted: Attendee[];
  joined: number;
  waitingTotal: number;
  submittedTotal: number;
  query: string;
  onQueryChange: (value: string) => void;
  sort: "started_at" | "name";
  onSortChange: (value: "started_at" | "name") => void;
  waitingPage: number;
  submittedPage: number;
  onWaitingPageChange: (page: number) => void;
  onSubmittedPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <JoinPanel
        joinUrl={joinUrl}
        accessCode={accessCode}
        onCopy={onCopy}
        size={188}
        showLink
        statTiles={
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="Joined" value={joined} tone="primary" />
            <StatTile label="Waiting" value={waitingTotal} tone="success" />
            <StatTile label="Submitted" value={submittedTotal} tone="success" />
          </div>
        }
      />
      <div className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[220px] flex-1">
            <Input
              placeholder="Search participants..."
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
            />
          </div>
          <Select value={sort} onValueChange={(value) => onSortChange(value as "started_at" | "name")}>
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="started_at">Newest joined</SelectItem>
              <SelectItem value="name">Name (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Tabs defaultValue="waiting" className="space-y-3">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="waiting">Waiting Room ({waitingTotal})</TabsTrigger>
            <TabsTrigger value="submitted">Submitted ({submittedTotal})</TabsTrigger>
          </TabsList>
          <TabsContent value="waiting">
            <AttendeeList
              list={waiting}
              page={waitingPage}
              total={waitingTotal}
              onPageChange={onWaitingPageChange}
              pageSize={pageSize}
              onPageSizeChange={onPageSizeChange}
              emptyHint="Participants who scan the QR will show up here."
            />
          </TabsContent>
          <TabsContent value="submitted">
            <AttendeeList
              list={submitted}
              showScores
              page={submittedPage}
              total={submittedTotal}
              onPageChange={onSubmittedPageChange}
              pageSize={pageSize}
              onPageSizeChange={onPageSizeChange}
              emptyHint="No one has submitted yet."
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function LiveView({
  attendees,
  joinUrl,
  accessCode,
  onCopy,
  paused,
  joinedTotal,
  submittedTotal,
  query,
  onQueryChange,
  sort,
  onSortChange,
  page,
  total,
  onPageChange,
  pageSize,
  onPageSizeChange,
}: {
  attendees: Attendee[];
  joinUrl: string;
  accessCode: string;
  onCopy: (text: string, label: string) => Promise<void>;
  paused: boolean;
  joinedTotal: number;
  submittedTotal: number;
  query: string;
  onQueryChange: (value: string) => void;
  sort: "score" | "completed_at" | "started_at";
  onSortChange: (value: "score" | "completed_at" | "started_at") => void;
  page: number;
  total: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const entries: LeaderboardEntry[] = attendees.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    rollNumber: a.rollNumber,
    score: a.score,
    total: a.total,
    completed: a.completed,
  }));
  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <JoinPanel
        joinUrl={joinUrl}
        accessCode={accessCode}
        onCopy={onCopy}
        size={148}
        statTiles={
          <div className="grid grid-cols-2 gap-2">
            <StatTile
              label="Joined"
              value={joinedTotal}
              tone="primary"
            />
            <StatTile
              label="Submitted"
              value={submittedTotal}
              tone="success"
            />
          </div>
        }
      />
      <div className="rounded-2xl border border-border bg-card/40 p-5 space-y-3">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Live leaderboard
            </div>
            <h2 className="font-display text-xl font-bold">
              {paused ? "Quiz paused" : "Quiz in progress"}
            </h2>
          </div>
          {!paused && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 text-success px-3 py-1 text-xs font-bold">
              <span className="inline-block h-2 w-2 rounded-full bg-success animate-pulse" /> LIVE
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[220px] flex-1">
            <Input
              placeholder="Search participants..."
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
            />
          </div>
          <Select value={sort} onValueChange={(value) => onSortChange(value as "score" | "completed_at" | "started_at")}> 
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Score (high to low)</SelectItem>
              <SelectItem value="completed_at">Fastest completion</SelectItem>
              <SelectItem value="started_at">Join order</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Suspense fallback={<LeaderboardLoading />}>
          <Leaderboard entries={entries} mode="live" />
        </Suspense>
        <PaginationControls
          page={page}
          pageSize={pageSize}
          total={total}
          label="participants"
          onPageChange={onPageChange}
          pageSizeOptions={PARTICIPANT_PAGE_SIZES}
          onPageSizeChange={onPageSizeChange}
        />
      </div>
    </div>
  );
}

function ResultsView({
  attendees,
  title,
  categoryLabel,
  questionCount,
  createdAt,
  reportAttempts,
  teacherName,
  schoolName,
  subjectLabel,
  topicLabel,
}: {
  attendees: Attendee[];
  title: string;
  categoryLabel: string;
  questionCount: number;
  createdAt: string;
  reportAttempts: QuizReportAttempt[];
  teacherName: string;
  schoolName: string;
  subjectLabel: string;
  topicLabel: string;
}) {
  const entries: LeaderboardEntry[] = attendees.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    rollNumber: a.rollNumber,
    score: a.score,
    total: a.total,
    completed: a.completed,
  }));
  const submittedCount = attendees.filter((a) => a.completed).length;
  const [resultPage, setResultPage] = useState(0);
  const rows = useMemo(
    () =>
      getQuizReportRows(reportAttempts).sort(
        (a, b) => b.score - a.score || b.percent - a.percent || a.rank - b.rank,
      ),
    [reportAttempts],
  );
  const visibleRows = paginate(rows, resultPage, RESULT_PAGE_SIZE);
  const top = rows[0];
  const totals = rows.reduce(
    (sum, row) => ({
      correct: sum.correct + row.correctAnswers,
      wrong: sum.wrong + row.wrongAnswers,
      unattempted: sum.unattempted + row.unattemptedQuestions,
    }),
    { correct: 0, wrong: 0, unattempted: 0 },
  );

  useEffect(() => {
    setResultPage(0);
  }, [rows.length]);

  return (
    <div className="space-y-5 print:space-y-3" id="quiz-results">
      <div className="rounded-2xl border border-border bg-card/60 p-6 print:border-0 print:bg-transparent print:p-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-glow print:bg-transparent print:border-black print:shadow-none print:text-black">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Final Results
              </div>
              <h2 className="font-display text-2xl font-bold">{title}</h2>
              <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                {categoryLabel && (
                  <>
                    <span>{categoryLabel}</span>
                    <span>·</span>
                  </>
                )}
                <span>
                  {questionCount} question{questionCount === 1 ? "" : "s"}
                </span>
                <span>·</span>
                <span>{submittedCount} submitted</span>
                <span>·</span>
                <span>{new Date(createdAt).toLocaleString()}</span>
              </div>
              <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                <ReportDetail label="Teacher" value={teacherName} />
                <ReportDetail label="School/Organization" value={schoolName || "Not specified"} />
                <ReportDetail label="Subject" value={subjectLabel} />
                <ReportDetail label="Topic" value={topicLabel || "Not specified"} />
              </dl>
            </div>
          </div>
          {top && (
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Winner
              </div>
              <div className="font-display text-lg font-bold">{top.name}</div>
              <div className="text-success font-bold">{top.score} pts</div>
            </div>
          )}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="grid gap-3 md:grid-cols-3 print:grid-cols-3">
          {rows.slice(0, 3).map((row) => (
            <div key={row.id} className="rounded-2xl border border-border bg-card/50 p-4 print:border-black">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Position {row.rank}
              </div>
              <div className="mt-1 font-display text-lg font-bold">{row.name}</div>
              <div className="text-xs text-muted-foreground truncate">{row.email || "No email"}</div>
              <div className="mt-2 text-xl font-bold text-success">{row.score} pts</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3 print:grid-cols-3">
        <ScoreMetric label="Correct answers" value={totals.correct} tone="success" />
        <ScoreMetric label="Wrong answers" value={totals.wrong} tone="danger" />
        <ScoreMetric label="Unattempted" value={totals.unattempted} tone="muted" />
      </div>

      <div className="rounded-2xl border border-border bg-card/40 p-5 print:border-0 print:bg-transparent print:p-0">
        <Suspense fallback={<LeaderboardLoading />}>
          <Leaderboard entries={entries} mode="final" />
        </Suspense>
      </div>

      <div className="rounded-2xl border border-border bg-card/40 overflow-hidden print:border-black">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40">
            <tr>
              {[
                "Pos",
                "Name",
                "Email",
                "Roll",
                "Seat",
                "Points",
                "Correct",
                "Wrong",
                "Unattempted",
                "Attempted",
                "Total",
              ].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id} className="border-t border-border/50">
                <td className="px-3 py-2 font-bold">{row.rank}</td>
                <td className="px-3 py-2 font-semibold">{row.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{row.email || "-"}</td>
                <td className="px-3 py-2">{row.rollNumber || "-"}</td>
                <td className="px-3 py-2">{row.seatNumber || "-"}</td>
                <td className="px-3 py-2 font-bold text-success">{row.score}</td>
                <td className="px-3 py-2 text-success font-semibold">{row.correctAnswers}</td>
                <td className="px-3 py-2 text-destructive font-semibold">{row.wrongAnswers}</td>
                <td className="px-3 py-2">{row.unattemptedQuestions}</td>
                <td className="px-3 py-2">{row.attemptedQuestions}</td>
                <td className="px-3 py-2">{row.totalQuestions}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationControls
          page={resultPage}
          pageSize={RESULT_PAGE_SIZE}
          total={rows.length}
          label="participants"
          onPageChange={setResultPage}
        />
      </div>
    </div>
  );
}

function LeaderboardLoading() {
  return (
    <div className="rounded-xl border border-border bg-card/30 p-5 text-sm text-muted-foreground">
      Loading leaderboard...
    </div>
  );
}

function ReportDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold text-foreground">{value || "Not specified"}</dd>
    </div>
  );
}

function ScoreMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "danger" | "muted";
}) {
  const color =
    tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "text-muted-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4">
      <div className={`font-display text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function toReportAttempts(attendees: Attendee[]): QuizReportAttempt[] {
  return attendees.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    rollNumber: a.rollNumber,
    seatNumber: a.seatNumber,
    score: a.score,
    totalQuestions: a.total,
    attemptedQuestions: a.attempted,
    correctAnswers: a.correct,
    wrongAnswers: a.wrong,
    unattemptedQuestions: a.unattempted,
    completed: a.completed,
    completedAt: a.completedAt,
  }));
}

function mapLiveAttempt(a: AttemptLive): Attendee {
  const meta = a.metadata && typeof a.metadata === "object"
    ? (a.metadata as Record<string, unknown>)
    : {};
  const attempted = a.completed ? a.total_questions : 0;
  return {
    id: a.id,
    name: a.participant_name ?? "Anonymous",
    email: a.participant_email,
    rollNumber: stringMeta(meta.roll_number),
    seatNumber: stringMeta(meta.seat_number),
    completed: a.completed,
    score: a.score,
    total: a.total_questions,
    attempted,
    correct: a.completed ? a.score : 0,
    wrong: 0,
    unattempted: Math.max(0, a.total_questions - attempted),
    completedAt: a.completed_at,
  };
}

function sortAttendees(attendees: Attendee[]) {
  return attendees.slice().sort((a, b) => {
    if (a.completed !== b.completed) return Number(b.completed) - Number(a.completed);
    return b.score - a.score || b.total - a.total || a.name.localeCompare(b.name);
  });
}

function getTeacherName(profile: ProfileRow | null, email?: string | null) {
  const full = profile?.full_name?.trim();
  if (full) return full;
  const joined = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  return joined || email?.split("@")[0] || "Teacher";
}

function stringMeta(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function broadcastParticipantStatus(
  accessCode: string | null,
  payload: ParticipantStatusBroadcast,
) {
  if (!accessCode) return;
  const channel = supabase.channel(`quiz-status-${accessCode}`, {
    config: { broadcast: { self: false } },
  });

  try {
    await new Promise<void>((resolve) => {
      const timeout = window.setTimeout(resolve, 1200);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          window.clearTimeout(timeout);
          resolve();
        }
      });
    });
    await channel.send({
      type: "broadcast",
      event: "status",
      payload: { access_code: accessCode, ...payload },
    });
  } finally {
    void supabase.removeChannel(channel);
  }
}

function JoinPanel({
  joinUrl,
  accessCode,
  onCopy,
  size,
  showLink,
  statTiles,
}: {
  joinUrl: string;
  accessCode: string;
  onCopy: (text: string, label: string) => Promise<void>;
  size: number;
  showLink?: boolean;
  statTiles?: React.ReactNode;
}) {
  return (
    <div className="space-y-4 print:hidden">
      <div className="rounded-2xl border border-border bg-white p-4 flex flex-col items-center">
        <div className="text-[11px] uppercase tracking-wider text-slate-500">Scan to join</div>
        <div className="mt-2">
          {joinUrl ? (
            <QRCodeSVG value={joinUrl} size={size} bgColor="#ffffff" fgColor="#000000" />
          ) : (
            <div style={{ height: size, width: size }} className="rounded-md bg-slate-100" />
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Quiz PIN</div>
        <div className="mt-2 font-display text-4xl font-bold text-primary tracking-wider">
          {accessCode || "—"}
        </div>
        {accessCode && (
          <button
            type="button"
            onClick={() => onCopy(accessCode, "PIN")}
            className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Copy className="h-3 w-3" /> Copy PIN
          </button>
        )}
      </div>

      {showLink && joinUrl && (
        <div className="rounded-2xl border border-border bg-card/40 p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Join link</div>
          <div className="mt-1 text-xs font-mono break-all text-foreground/90">{joinUrl}</div>
          <button
            type="button"
            onClick={() => onCopy(joinUrl, "Join link")}
            className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Copy className="h-3 w-3" /> Copy link
          </button>
        </div>
      )}

      {statTiles}
    </div>
  );
}

function AttendeeList({
  list,
  showScores,
  page,
  total,
  onPageChange,
  pageSize,
  onPageSizeChange,
  emptyHint,
}: {
  list: Attendee[];
  showScores?: boolean;
  page?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  emptyHint: string;
}) {
  const resolvedPage = page ?? 0;
  const resolvedTotal = total ?? list.length;
  const resolvedPageSize = pageSize ?? 25;
  const visible = page === undefined ? paginate(list, resolvedPage, resolvedPageSize) : list;

  if (list.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/20 p-8 text-center text-xs text-muted-foreground">
        {emptyHint}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-card/20">
      <ul className="space-y-1.5 p-2">
        {visible.map((a, i) => (
          <li key={a.id} className="flex items-center gap-3 rounded-lg bg-secondary/40 px-3 py-2.5">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              {resolvedPage * resolvedPageSize + i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{a.name}</div>
              {a.email && (
                <div className="text-[11px] text-muted-foreground truncate">{a.email}</div>
              )}
            </div>
            {showScores ? (
              <div className="text-right">
                <div className="text-sm font-bold text-success">
                  {a.score} / {a.total}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">pts</div>
              </div>
            ) : (
              <span className="rounded-full bg-success/15 text-success px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                Waiting
              </span>
            )}
            {!showScores && <Users className="h-3 w-3 text-muted-foreground" />}
          </li>
        ))}
      </ul>
      <PaginationControls
        page={resolvedPage}
        pageSize={resolvedPageSize}
        total={resolvedTotal}
        label="participants"
        onPageChange={onPageChange ?? (() => {})}
        pageSizeOptions={pageSize ? PARTICIPANT_PAGE_SIZES : undefined}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "success";
}) {
  const color = tone === "primary" ? "text-primary" : "text-success";
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 text-center">
      <div className={`font-display text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] mt-1 uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function EditSessionDialog({
  open,
  onOpenChange,
  initialTitle,
  initialTime,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTitle: string;
  initialTime: number;
  onSave: (title: string, time: number) => Promise<void>;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [time, setTime] = useState(String(initialTime));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setTime(String(initialTime));
    }
  }, [open, initialTitle, initialTime]);

  const submit = async () => {
    const t = title.trim();
    if (!t) {
      toast.error("Title is required");
      return;
    }
    const n = Number(time);
    if (!Number.isFinite(n) || n < 5 || n > 3600) {
      toast.error("Time must be between 5 and 3600 seconds");
      return;
    }
    setBusy(true);
    try {
      await onSave(t, n);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit quiz</DialogTitle>
          <DialogDescription>
            Update the title or time-per-question for this session.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div>
            <Label className="mb-1.5">Time per question (seconds)</Label>
            <Input
              type="number"
              min={5}
              max={3600}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy}
            className="bg-gradient-primary text-primary-foreground shadow-glow"
          >
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
