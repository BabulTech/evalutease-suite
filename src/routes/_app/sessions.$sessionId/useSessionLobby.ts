import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePlan } from "@/contexts/PlanContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { copyText } from "@/lib/copy-text";
import { statusBadge } from "@/components/sessions/types";
import type { Session as SessionLite } from "@/components/sessions/types";
import {
  broadcastParticipantStatus,
  getTeacherName,
  mapLiveAttempt,
  sortAttendees,
  stringMeta,
  toReportAttempts,
} from "./helpers";
import type { Attendee, AttemptWithDetails, ProfileRow, SessionRow } from "./types";

export function useSessionLobby(sessionId: string) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { plan, credits, reload: reloadCredits } = usePlan();
  const isMobile = useIsMobile();

  const [session, setSession] = useState<SessionRow | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [subcategoryName, setSubcategoryName] = useState("");
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [rosterEmails, setRosterEmails] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(0);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [attendeeTotal, setAttendeeTotal] = useState(0);
  const [waitingAttendees, setWaitingAttendees] = useState<Attendee[]>([]);
  const [submittedAttendees, setSubmittedAttendees] = useState<Attendee[]>([]);
  const [invitedAttendees, setInvitedAttendees] = useState<Attendee[]>([]);
  const [waitingTotal, setWaitingTotal] = useState(0);
  const [submittedTotal, setSubmittedTotal] = useState(0);
  const [invitedTotal, setInvitedTotal] = useState(0);
  const [livePage, setLivePage] = useState(0);
  const [waitingPage, setWaitingPage] = useState(0);
  const [submittedPage, setSubmittedPage] = useState(0);
  const [invitedPage, setInvitedPage] = useState(0);
  const [attendeePageSize, setAttendeePageSize] = useState(isMobile ? 10 : 25);
  const [participantQuery, setParticipantQuery] = useState("");
  const debouncedParticipantQuery = useDebouncedValue(participantQuery, 300);
  const [liveSort, setLiveSort] = useState<"score" | "completed_at" | "started_at">("score");
  const [lobbySort, setLobbySort] = useState<"started_at" | "name">("started_at");
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [hasTypedQuestions, setHasTypedQuestions] = useState(false);
  const [sessionTotalMaxPts, setSessionTotalMaxPts] = useState<number | null>(null);
  const [gradingSummary, setGradingSummary] = useState<{ short: number; long: number } | null>(
    null,
  );
  const [showGradeConfirm, setShowGradeConfirm] = useState(false);
  const [bulkAiRunning, setBulkAiRunning] = useState(false);

  const attendeeRefreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAttemptChanges = useRef<Map<string, Record<string, unknown>>>(new Map());
  const rafFlushRef = useRef<number | null>(null);

  const loadSession = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("quiz_sessions")
      .select(
        "id, title, status, default_time_per_question, access_code, is_open, show_results_after_quiz, scheduled_at, started_at, paused_at, pause_offset_seconds, category_id, subcategory_id, created_at, subject, topic, description",
      )
      .eq("id", sessionId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data) return;
    setSession(data as unknown as SessionRow);

    const [catRes, subRes, qCount, typedQCheck, profileRes, rosterRes, maxPtsRes] =
      await Promise.all([
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
          .from("quiz_session_questions")
          .select("questions!inner(type)")
          .eq("session_id", sessionId)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .in("questions.type" as any, ["short_answer", "long_answer"])
          .limit(1),
        supabase
          .from("profiles")
          .select("full_name, first_name, last_name, organization")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("quiz_session_participants")
          .select("participants ( email )")
          .eq("session_id", sessionId),
        supabase
          .from("quiz_session_questions")
          .select("questions(max_points)")
          .eq("session_id", sessionId),
      ]);

    setCategoryName(catRes.data?.name ?? "");
    setSubcategoryName(subRes.data?.name ?? "");
    setQuestionCount(qCount.count ?? 0);
    setHasTypedQuestions((typedQCheck.data?.length ?? 0) > 0);
    const totalMaxPts = (maxPtsRes.data ?? []).reduce(
      (sum, r) => sum + ((r.questions as { max_points?: number } | null)?.max_points ?? 1),
      0,
    );
    setSessionTotalMaxPts(totalMaxPts > 0 ? totalMaxPts : null);
    if (profileRes.data) setProfile(profileRes.data as ProfileRow);
    const emails = (
      (rosterRes.data ?? []) as { participants: { email: string | null } | null }[]
    ).flatMap((row) => {
      const e = row.participants?.email?.trim();
      return e ? [e] : [];
    });
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
        if (searchTerm)
          query = query.or(
            `participant_name.ilike.%${searchTerm}%,participant_email.ilike.%${searchTerm}%`,
          );
        if (liveSort === "completed_at")
          query = query
            .order("completed_at", { ascending: true })
            .order("score", { ascending: false });
        else if (liveSort === "started_at") query = query.order("started_at", { ascending: true });
        else
          query = query
            .order("score", { ascending: false })
            .order("started_at", { ascending: true });
        return query.range(offset, offset + attendeePageSize - 1);
      })(),
      (() => {
        let query = supabase
          .from("quiz_attempts")
          .select("id", { count: "exact", head: true })
          .eq("session_id", sessionId)
          .eq("completed", true);
        if (searchTerm)
          query = query.or(
            `participant_name.ilike.%${searchTerm}%,participant_email.ilike.%${searchTerm}%`,
          );
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
    setAttendees(sortAttendees(mapped));
    setAttendeeTotal(pageRes.count ?? 0);
    setSubmittedTotal(submittedRes.count ?? 0);
    setWaitingTotal(Math.max(0, (pageRes.count ?? 0) - (submittedRes.count ?? 0)));
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
        if (searchTerm)
          query = query.or(
            `participant_name.ilike.%${searchTerm}%,participant_email.ilike.%${searchTerm}%`,
          );
        if (lobbySort === "name") query = query.order("participant_name", { ascending: true });
        else query = query.order("started_at", { ascending: true });
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
        if (searchTerm)
          query = query.or(
            `participant_name.ilike.%${searchTerm}%,participant_email.ilike.%${searchTerm}%`,
          );
        if (lobbySort === "name") query = query.order("participant_name", { ascending: true });
        else query = query.order("completed_at", { ascending: false });
        return query.range(submittedOffset, submittedOffset + attendeePageSize - 1);
      })(),
    ]);
    if (waitingRes.error || submittedRes.error) return;

    const toAttendee = (row: AttemptWithDetails) =>
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
      });
    setWaitingAttendees(
      sortAttendees(((waitingRes.data ?? []) as AttemptWithDetails[]).map(toAttendee)),
    );
    setSubmittedAttendees(
      sortAttendees(((submittedRes.data ?? []) as AttemptWithDetails[]).map(toAttendee)),
    );

    const waitingCount = waitingRes.count ?? 0;
    const submittedCount = submittedRes.count ?? 0;
    setWaitingTotal(waitingCount);
    setSubmittedTotal(submittedCount);
    setAttendeeTotal(waitingCount + submittedCount);

    const [rosterRes, allAttemptsRes] = await Promise.all([
      supabase
        .from("quiz_session_participants")
        .select("participants ( id, name, email, metadata )")
        .eq("session_id", sessionId),
      supabase.from("quiz_attempts").select("participant_id").eq("session_id", sessionId),
    ]);

    if (!rosterRes.error && !allAttemptsRes.error) {
      const attemptedIds = new Set(
        ((allAttemptsRes.data ?? []) as { participant_id: string | null }[]).flatMap((a) =>
          a.participant_id ? [a.participant_id] : [],
        ),
      );
      type RosterRow = {
        participants: {
          id: string;
          name: string | null;
          email: string | null;
          metadata: unknown;
        } | null;
      };
      const rosterRows = (rosterRes.data ?? []) as RosterRow[];
      const search = debouncedParticipantQuery.trim().toLowerCase();
      const invited: Attendee[] = rosterRows.flatMap((r) => {
        const p = r.participants;
        if (!p || attemptedIds.has(p.id)) return [];
        if (
          search &&
          !(p.name ?? "").toLowerCase().includes(search) &&
          !(p.email ?? "").toLowerCase().includes(search)
        )
          return [];
        const meta = (
          p.metadata && typeof p.metadata === "object"
            ? (p.metadata as Record<string, unknown>)
            : {}
        ) as Record<string, unknown>;
        return [
          {
            id: p.id,
            name: p.name ?? "-",
            email: p.email,
            rollNumber: typeof meta.roll_number === "string" ? meta.roll_number : null,
            seatNumber: typeof meta.seat_number === "string" ? meta.seat_number : null,
            completed: false,
            score: 0,
            total: 0,
            attempted: 0,
            correct: 0,
            wrong: 0,
            unattempted: 0,
            completedAt: null,
          },
        ];
      });
      setInvitedAttendees(invited);
      setInvitedTotal(invited.length);
    }
  }, [
    attendeePageSize,
    debouncedParticipantQuery,
    lobbySort,
    sessionId,
    submittedPage,
    waitingPage,
  ]);

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
    setAttendees(
      sortAttendees(
        ((data ?? []) as AttemptWithDetails[]).map((a) => {
          const meta =
            a.participants?.metadata && typeof a.participants.metadata === "object"
              ? (a.participants.metadata as Record<string, unknown>)
              : {};
          const answers = a.quiz_answers ?? [];
          const correct = answers.filter((ans) => ans.is_correct === true).length;
          const wrong = answers.filter((ans) => ans.is_correct === false).length;
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
      ),
    );
  }, [sessionId]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-event-handler
    if (!session) return;
    // react-doctor-disable-next-line react-doctor/no-event-handler
    if (session.status === "completed" || session.status === "grading") {
      // react-doctor-disable-next-line react-doctor/no-event-handler
      void loadDetailedAttendees();
      // react-doctor-disable-next-line react-doctor/no-event-handler
      void (async () => {
        // react-doctor-disable-next-line react-doctor/no-event-handler
        const { data: attempts } = await supabase
          .from("quiz_attempts")
          .select("id")
          .eq("session_id", sessionId);
        if (!attempts || attempts.length === 0) return;
        const attemptIds = attempts.map((a) => a.id);
        const { data } = await supabase
          .from("quiz_answers")
          .select("questions!inner(type)")
          .is("graded_at", null)
          .in("attempt_id", attemptIds)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .in("questions.type" as any, ["short_answer", "long_answer"]);
        if (data && data.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rows = data as any[];
          const short = rows.filter((r) => r.questions?.type === "short_answer").length;
          const long = rows.filter((r) => r.questions?.type === "long_answer").length;
          if (short + long > 0) setGradingSummary({ short, long });
        }
      })();
      return;
    }
    // react-doctor-disable-next-line react-doctor/no-event-handler
    if (session.status === "active") {
      void loadLiveAttendees();
      return;
    }
    void loadLobbyAttendees();
  }, [loadDetailedAttendees, loadLiveAttendees, loadLobbyAttendees, session, sessionId]);

  // react-doctor-disable-next-line react-doctor/no-chain-state-updates
  // react-doctor-disable-next-line react-doctor/no-event-handler
  useEffect(() => {
    if (livePage > 0 && attendeeTotal <= livePage * attendeePageSize) setLivePage(0);
  }, [attendeePageSize, attendeeTotal, livePage]);
  // react-doctor-disable-next-line react-doctor/no-chain-state-updates
  // react-doctor-disable-next-line react-doctor/no-event-handler
  useEffect(() => {
    if (waitingPage > 0 && waitingTotal <= waitingPage * attendeePageSize) setWaitingPage(0);
  }, [attendeePageSize, waitingPage, waitingTotal]);
  // react-doctor-disable-next-line react-doctor/no-chain-state-updates
  // react-doctor-disable-next-line react-doctor/no-event-handler
  useEffect(() => {
    if (submittedPage > 0 && submittedTotal <= submittedPage * attendeePageSize)
      setSubmittedPage(0);
  }, [attendeePageSize, submittedPage, submittedTotal]);
  // react-doctor-disable-next-line react-doctor/no-derived-state
  // react-doctor-disable-next-line react-doctor/no-derived-state-effect
  // react-doctor-disable-next-line react-doctor/no-derived-state
  useEffect(() => {
    setAttendeePageSize(isMobile ? 10 : 25);
  }, [isMobile]);
  // react-doctor-disable-next-line react-doctor/no-cascading-set-state
  // react-doctor-disable-next-line react-doctor/no-chain-state-updates
  // react-doctor-disable-next-line react-doctor/no-derived-state-effect
  // react-doctor-disable-next-line react-doctor/no-cascading-set-state
  // react-doctor-disable-next-line react-doctor/no-chain-state-updates
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
          participant_email:
            typeof row.participant_email === "string" ? row.participant_email : null,
          participant_id: typeof row.participant_id === "string" ? row.participant_id : null,
          completed: row.completed === true,
          completed_at: typeof row.completed_at === "string" ? row.completed_at : null,
          score: typeof row.score === "number" ? row.score : 0,
          total_questions:
            typeof row.total_questions === "number" ? row.total_questions : questionCount,
          metadata: {},
        });
        // react-doctor-disable-next-line react-doctor/js-index-maps
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

  const applyAttemptChange = useCallback(
    (row: Record<string, unknown>) => {
      const id = typeof row.id === "string" ? row.id : null;
      if (!id) return;
      pendingAttemptChanges.current.set(id, row);
      if (rafFlushRef.current === null)
        rafFlushRef.current = requestAnimationFrame(flushAttemptChanges);
    },
    [flushAttemptChanges],
  );

  useEffect(() => {
    const attendeeRefresh = attendeeRefreshRef;
    const rafFlush = rafFlushRef;
    const pendingAttempts = pendingAttemptChanges;
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
          if (payload.eventType !== "DELETE")
            applyAttemptChange(payload.new as Record<string, unknown>);
          scheduleAttendeeRefresh();
        },
      )
      .subscribe();
    return () => {
      if (attendeeRefresh.current) {
        clearTimeout(attendeeRefresh.current);
        attendeeRefresh.current = null;
      }
      if (rafFlush.current !== null) {
        cancelAnimationFrame(rafFlush.current);
        rafFlush.current = null;
      }
      pendingAttempts.current.clear();
      void supabase.removeChannel(ch);
    };
  }, [sessionId, loadSession, scheduleAttendeeRefresh, applyAttemptChange]);

  const joinUrl = useMemo(() => {
    if (!session?.access_code) return "";
    const envBase = (import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined)?.replace(
      /\/$/,
      "",
    );
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
      .update({ status: "active", started_at: startedAt, paused_at: null, pause_offset_seconds: 0 })
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
    toast.success("Quiz started - participants will see questions");
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
      data &&
      typeof data === "object" &&
      "added_seconds" in data &&
      typeof data.added_seconds === "number"
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

  const forceEndQuiz = async () => {
    if (!session) return;
    setBusy(true);
    await broadcastParticipantStatus(session.access_code, { force_end: true });
    setBusy(false);
    toast.success("Quiz ended, participants will see the results screen.");
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
    const payload = data as { error?: string; needs_grading?: boolean };
    if (payload?.error) {
      toast.error(payload.error);
      return;
    }
    await broadcastParticipantStatus(session.access_code, {
      status: "completed",
      paused_at: null,
      is_open: false,
    });
    if (payload?.needs_grading) {
      toast.success(
        "Quiz closed, answers pending grading. Grade them before results are finalised.",
      );
      void navigate({ to: "/sessions/$sessionId/grade", params: { sessionId: session.id } });
    } else {
      toast.success("Quiz closed - moved to Quiz History");
      void navigate({ to: "/quiz-history" });
    }
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

  const toggleShowResults = async (value: boolean) => {
    if (!session) return;
    const { error } = await supabase
      .from("quiz_sessions")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- show_results_after_quiz column not yet in generated types
      .update({ show_results_after_quiz: value } as any)
      .eq("id", session.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await broadcastParticipantStatus(session.access_code, { show_results_after_quiz: value });
    void loadSession();
  };

  const shortCreditCost = plan?.credit_cost_ai_grade_short ?? 1;
  const longCreditCost = plan?.credit_cost_ai_grade_long ?? 3;
  const totalGradingCost = gradingSummary
    ? gradingSummary.short * shortCreditCost + gradingSummary.long * longCreditCost
    : 0;

  const runBulkAiGrade = async () => {
    if (!user || !gradingSummary) return;
    setShowGradeConfirm(false);
    setBulkAiRunning(true);
    try {
      const { gradeAnswerWithAi } = await import("@/components/grading/gradeAnswer.server");
      const { data: answers } = (await supabase
        .from("quiz_answers")
        .select("id, answer_text, questions!inner(text, type, max_points, model_answer, rubric)")
        .is("graded_at", null)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .in("questions.type" as any, ["short_answer", "long_answer"])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .eq("quiz_attempts.session_id" as any, sessionId)) as any;
      let done = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const row of (answers ?? []) as any[]) {
        const q = row.questions;
        const cost = q?.type === "long_answer" ? longCreditCost : shortCreditCost;
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: ok, error: deductErr } = await supabase.rpc("deduct_credits" as any, {
          p_user_id: user.id,
          p_amount: cost,
          p_type: "ai_grading",
          p_description: `AI graded ${q?.type} answer (bulk)`,
        });
        if (deductErr || !ok) continue;
        try {
          // react-doctor-disable-next-line react-doctor/async-await-in-loop
          const result = await gradeAnswerWithAi({
            data: {
              questionText: q?.text ?? "",
              questionType: q?.type ?? "short_answer",
              modelAnswer: q?.model_answer ?? "",
              rubric: q?.rubric ?? "",
              studentAnswer: row.answer_text ?? "",
              maxPoints: q?.max_points ?? 1,
            },
          });
          await supabase
            .from("quiz_answers")
            .update({
              points_awarded: result.points,
              grader_comment: result.comment || null,
              graded_at: new Date().toISOString(),
              graded_by_ai: true,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)
            .eq("id", row.id);
          done++;
        } catch {
          /* skip */
        }
      }
      reloadCredits();
      setGradingSummary(null);
      toast.success(`AI graded ${done} answers Â· ${totalGradingCost} credits used`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBulkAiRunning(false);
    }
  };

  // Derived values
  const isActive = session?.status === "active";
  const isCompleted = session?.status === "completed" || session?.status === "grading";
  const paused = !!session?.paused_at;
  const joined = isCompleted ? attendees.length : attendeeTotal;
  const waiting = isCompleted ? attendees.filter((a) => !a.completed) : waitingAttendees;
  const submitted = isCompleted ? attendees.filter((a) => a.completed) : submittedAttendees;
  const reportAttempts = toReportAttempts(attendees, sessionTotalMaxPts);
  const teacherName = getTeacherName(profile, user?.email);
  const schoolName = profile?.organization ?? "";
  const subject = session
    ? session.subject ||
      [categoryName, subcategoryName].filter(Boolean).join(" -> ") ||
      "Not specified"
    : "";

  const sessionLite: SessionLite | null = session
    ? {
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
        participant_count: isCompleted ? attendees.length : attendeeTotal,
        attempts: {
          joined: isCompleted ? attendees.length : attendeeTotal,
          waiting: isCompleted ? attendees.filter((a) => !a.completed).length : waitingTotal,
          submitted: isCompleted ? attendees.filter((a) => a.completed).length : submittedTotal,
          avgPercent: 0,
          topThree: [],
        },
      }
    : null;

  const badge = sessionLite ? statusBadge(sessionLite) : { label: "", className: "" };

  return {
    session,
    isActive,
    isCompleted,
    paused,
    joined,
    badge,
    joinUrl,
    categoryName,
    subcategoryName,
    questionCount,
    attendees,
    attendeeTotal,
    waitingAttendees,
    submittedAttendees,
    invitedAttendees,
    waitingTotal,
    submittedTotal,
    invitedTotal,
    livePage,
    setLivePage,
    waitingPage,
    setWaitingPage,
    submittedPage,
    setSubmittedPage,
    invitedPage,
    setInvitedPage,
    attendeePageSize,
    setAttendeePageSize,
    participantQuery,
    setParticipantQuery,
    liveSort,
    setLiveSort,
    lobbySort,
    setLobbySort,
    busy,
    editOpen,
    setEditOpen,
    confirmDelete,
    setConfirmDelete,
    confirmClose,
    setConfirmClose,
    hasTypedQuestions,
    gradingSummary,
    showGradeConfirm,
    setShowGradeConfirm,
    bulkAiRunning,
    shortCreditCost,
    longCreditCost,
    totalGradingCost,
    credits,
    rosterEmails,
    waiting,
    submitted,
    reportAttempts,
    teacherName,
    schoolName,
    subject,
    start,
    pause,
    resume,
    forceEndQuiz,
    closeSession,
    remove,
    saveEdit,
    toggleShowResults,
    copy,
    emailParticipants,
    runBulkAiGrade,
  };
}
