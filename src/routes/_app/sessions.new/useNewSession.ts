import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { generateAccessCode } from "@/components/sessions/types";
import { usePlan } from "@/contexts/PlanContext";
import type {
  CategoryRow,
  SubcategoryRow,
  TypeRow,
  SubtypeRow,
  DifficultyCustom,
  PickStrategy,
  FieldErrors,
} from "./types";
import { QUIZ_TYPES } from "./types";

export function useNewSession() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();
  const { isLocked, remaining: _remaining, plan, loading: planLoading } = usePlan();

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryRow[]>([]);
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [subtypes, setSubtypes] = useState<SubtypeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [subcategoryId, setSubcategoryId] = useState<string>("");
  const [subQuestionCount, setSubQuestionCount] = useState<number | null>(null);
  const [useAllQuestions, setUseAllQuestions] = useState(true);
  const [numQuestions, setNumQuestions] = useState(10);
  const [pickStrategy, setPickStrategy] = useState<PickStrategy>("random");
  const [quizType, setQuizType] = useState<string>("");
  const [diffCustom, setDiffCustom] = useState<DifficultyCustom>({
    easy: 3,
    medium: 4,
    hard: 3,
    enabled: false,
  });
  const [isPublic, setIsPublic] = useState(true);
  const [selectedSubtypeIds, setSelectedSubtypeIds] = useState<Set<string>>(new Set());
  const [timeText, setTimeText] = useState("10");
  const [showResultsAfterQuiz, setShowResultsAfterQuiz] = useState(true);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAtLocal, setScheduledAtLocal] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [cats, subs, ts, sts] = await Promise.all([
      supabase
        .from("question_categories")
        .select("id, name")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("question_subcategories")
        .select("id, category_id, name")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("participant_types")
        .select("id, name")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("participant_subtypes")
        .select("id, type_id, name")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true }),
    ]);
    setLoading(false);
    if (cats.error) toast.error(cats.error.message);
    if (subs.error) toast.error(subs.error.message);
    if (ts.error) toast.error(ts.error.message);
    if (sts.error) toast.error(sts.error.message);
    setCategories(cats.data ?? []);
    setSubcategories(subs.data ?? []);
    setTypes(ts.data ?? []);
    setSubtypes(sts.data ?? []);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  // react-doctor-disable-next-line react-doctor/no-cascading-set-state
  useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-cascading-set-state
    // react-doctor-disable-next-line react-doctor/no-chain-state-updates
    if (!subcategoryId || !user) {
      setSubQuestionCount(null);
      return;
    }
    // react-doctor-disable-next-line react-doctor/no-chain-state-updates
    let q = supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .eq("subcategory_id", subcategoryId);
    // react-doctor-disable-next-line react-doctor/no-event-handler
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (quizType && quizType !== "mixed") q = q.eq("type", quizType as any);
    // react-doctor-disable-next-line react-doctor/no-event-handler
    q.then(({ count }) => {
      const n = count ?? 0;
      setSubQuestionCount(n);
      setNumQuestions(Math.min(numQuestions || n, n));
      setUseAllQuestions(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- numQuestions is set inside this effect; including it would cause an infinite loop
  }, [subcategoryId, user, quizType]);

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.id, c.name);
    return m;
  }, [categories]);

  const typeNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const tp of types) m.set(tp.id, tp.name);
    return m;
  }, [types]);

  const selectedSubcategory = subcategories.find((s) => s.id === subcategoryId);
  const selectedSubcategoryLabel = selectedSubcategory
    ? `${categoryNameById.get(selectedSubcategory.category_id) ?? "?"} → ${selectedSubcategory.name}`
    : "";

  const toggleSubtype = (id: string) => {
    setSelectedSubtypeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setErrors((prev) => ({ ...prev, subtypes: undefined }));
  };

  const validate = (mode: "open" | "schedule"): FieldErrors => {
    const errs: FieldErrors = {};
    const titleTrimmed = title.trim();
    if (!titleTrimmed) errs.title = "Title is required";
    else if (titleTrimmed.length > 200) errs.title = "Title must be ≤ 200 characters";
    if (!subcategoryId)
      errs.category = "Pick a category - quiz questions come from the chosen sub-category";
    if (!quizType) errs.quizType = "Select a quiz type";
    if (mode === "schedule") {
      if (!scheduledAtLocal) errs.schedule = "Pick a date and time to schedule";
      else {
        const ts = new Date(scheduledAtLocal);
        if (Number.isNaN(ts.getTime())) errs.schedule = "Invalid schedule time";
        else if (ts.getTime() < Date.now() - 60_000)
          errs.schedule = "Schedule must be in the future";
      }
    }
    if (!isPublic && selectedSubtypeIds.size === 0)
      errs.subtypes = "Pick at least one participant sub-type, or switch to Public";
    return errs;
  };

  // eslint-disable-next-line sonarjs/cognitive-complexity -- session creation flow with many validation branches
  const submit = async (mode: "open" | "schedule") => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10) + "T00:00:00Z";
    const errs = validate(mode);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error(t("newSess.fixFields"));
      return;
    }
    setErrors({});

    const isScheduled = mode === "schedule";
    const titleVal = title.trim();
    const timeNum = Number(timeText);

    const [{ data: qs, error: qErr }, partsResult] = await Promise.all([
      quizType === "mixed"
        ? supabase
            .from("questions")
            .select("id, created_at")
            .eq("owner_id", user.id)
            .eq("subcategory_id", subcategoryId)
        : supabase
            .from("questions")
            .select("id, created_at")
            .eq("owner_id", user.id)
            .eq("subcategory_id", subcategoryId)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .eq("type", quizType as any),
      !isPublic && selectedSubtypeIds.size > 0
        ? supabase
            .from("participants")
            .select("id, subtype_id")
            .eq("owner_id", user.id)
            .in("subtype_id", Array.from(selectedSubtypeIds))
        : Promise.resolve({ data: [] as { id: string; subtype_id: string | null }[], error: null }),
    ]);
    if (qErr) {
      toast.error(qErr.message);
      return;
    }
    if (partsResult.error) {
      toast.error(partsResult.error.message);
      return;
    }
    const allQuestions = qs ?? [];
    if (allQuestions.length === 0) {
      const typeLabel = QUIZ_TYPES.find((qt) => qt.value === quizType)?.label ?? quizType;
      const msg =
        quizType === "mixed"
          ? "That sub-category has no questions yet, add some first"
          : `No "${typeLabel}" questions in that sub-category. Add some or choose a different quiz type.`;
      setErrors((prev) => ({ ...prev, category: msg }));
      toast.error(msg);
      return;
    }

    const wantN = useAllQuestions
      ? allQuestions.length
      : Math.min(numQuestions, allQuestions.length);
    let selectedQs = allQuestions;
    if (wantN < allQuestions.length) {
      if (pickStrategy === "random") {
        const arr = [...allQuestions];
        for (let i = arr.length - 1; i > 0; i--) {
          // eslint-disable-next-line sonarjs/pseudo-random -- non-security shuffle for question order
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        selectedQs = arr.slice(0, wantN);
      } else if (pickStrategy === "newest") {
        selectedQs = allQuestions
          .toSorted((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, wantN);
      } else if (pickStrategy === "oldest") {
        selectedQs = allQuestions
          .toSorted((a, b) => a.created_at.localeCompare(b.created_at))
          .slice(0, wantN);
      } else {
        const ids = allQuestions.map((q) => q.id);
        const { data: usageData } = await supabase
          .from("quiz_session_questions")
          .select("question_id")
          .in("question_id", ids);
        const usageMap = new Map<string, number>();
        for (const row of usageData ?? [])
          usageMap.set(row.question_id, (usageMap.get(row.question_id) ?? 0) + 1);
        selectedQs = allQuestions
          .toSorted((a, b) => {
            const ua = usageMap.get(a.id) ?? 0;
            const ub = usageMap.get(b.id) ?? 0;
            return pickStrategy === "least_used" ? ua - ub : ub - ua;
          })
          .slice(0, wantN);
      }
    }
    const questionIds = selectedQs.map((q) => q.id);
    const participantIds = (partsResult.data ?? []).map((p) => p.id);

    if (isScheduled) {
      const scheduledLimit = plan?.scheduled_quizzes_per_day ?? 1;
      if (scheduledLimit !== -1) {
        const { count: scheduledToday } = await supabase
          .from("quiz_sessions")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id)
          .not("scheduled_at", "is", null)
          .gte("created_at", today);
        if ((scheduledToday ?? 0) >= scheduledLimit) {
          toast.error(
            `Your ${plan?.name ?? "current"} plan allows ${scheduledLimit} scheduled quiz${scheduledLimit === 1 ? "" : "zes"} per day. Upgrade to schedule more.`,
          );
          return;
        }
      }
    }

    const launchCost = plan?.credit_cost_session_launch ?? 0;
    if (launchCost > 0) {
      const { data: deducted, error: deductErr } = await supabase.rpc("deduct_credits", {
        p_user_id: user.id,
        p_amount: launchCost,
        p_type: "extra_quiz",
        p_description: `Quiz session created: ${titleVal}`,
      });
      if (deductErr || !deducted) {
        toast.error(`Not enough credits to launch session. Need ${launchCost} credits.`);
        return;
      }
    }

    setBusy(true);
    const subcat = subcategories.find((s) => s.id === subcategoryId);
    const { data: accessCodeData } = await supabase.rpc("generate_session_access_code");
    const accessCode = (accessCodeData as string | null) ?? generateAccessCode();
    const { data: inserted, error: insErr } = await supabase
      .from("quiz_sessions")
      .insert({
        owner_id: user.id,
        title: titleVal,
        category_id: subcat?.category_id ?? null,
        subcategory_id: subcategoryId,
        mode: "qr_link",
        status: "scheduled",
        is_open: true,
        show_results_after_quiz: showResultsAfterQuiz,
        default_time_per_question: timeNum,
        access_code: accessCode,
        scheduled_at: isScheduled ? new Date(scheduledAtLocal).toISOString() : null,
        started_at: null,
        topic: quizType,
      })
      .select("id")
      .single();
    if (insErr || !inserted) {
      setBusy(false);
      toast.error(insErr?.message ?? "Could not create session");
      return;
    }
    const sessionId = inserted.id;

    const { error: qsErr } = await supabase.from("quiz_session_questions").insert(
      questionIds.map((qid, i) => ({
        session_id: sessionId,
        question_id: qid,
        position: i,
        time_seconds: null,
      })),
    );
    if (qsErr) {
      setBusy(false);
      toast.error(`Saved session but failed to attach questions: ${qsErr.message}`);
      return;
    }

    if (!isPublic && selectedSubtypeIds.size > 0) {
      const { error: subErr } = await supabase
        .from("quiz_session_subtypes")
        .insert(
          Array.from(selectedSubtypeIds).map((id) => ({ session_id: sessionId, subtype_id: id })),
        );
      if (subErr) toast.error(`Saved session but failed to record sub-types: ${subErr.message}`);
    }
    if (participantIds.length > 0) {
      const { error: pErr } = await supabase
        .from("quiz_session_participants")
        .insert(participantIds.map((pid) => ({ session_id: sessionId, participant_id: pid })));
      if (pErr) toast.error(`Saved session but failed to attach participants: ${pErr.message}`);
    }

    if (isScheduled && !isPublic && participantIds.length > 0) {
      void (async () => {
        try {
          const { data: accessData } = await supabase
            .from("quiz_sessions")
            .select("access_code, scheduled_at")
            .eq("id", sessionId)
            .single();
          if (accessData?.access_code && accessData?.scheduled_at) {
            const { data: pData } = await supabase
              .from("participants")
              .select("name, email")
              .in("id", participantIds);
            const appUrl = import.meta.env.VITE_APP_URL ?? window.location.origin;
            const joinUrl = `${appUrl}/q/${accessData.access_code}`;
            const scheduledAtFormatted = new Date(accessData.scheduled_at).toLocaleString("en-PK", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Karachi",
            });
            for (const p of (pData ?? []).filter((x) => x.email)) {
              void supabase.functions.invoke("send-email", {
                body: {
                  type: "quiz_scheduled",
                  data: {
                    to: p.email,
                    recipientName: p.name ?? "Participant",
                    quizTitle: titleVal,
                    scheduledAt: scheduledAtFormatted,
                    accessCode: accessData.access_code,
                    joinUrl,
                  },
                },
              });
            }
          }
        } catch (e) {
          console.error("[email] could not send schedule emails:", e);
        }
      })();
    }

    setBusy(false);
    toast.success(isScheduled ? t("newSess.sessionScheduled") : t("newSess.lobbyOpen"));
    if (isScheduled) {
      void navigate({ to: "/sessions" });
    } else {
      void navigate({ to: "/sessions/$sessionId", params: { sessionId } });
    }
  };

  return {
    // lookup data
    categories,
    subcategories,
    types,
    subtypes,
    loading,
    // plan
    isLocked,
    plan,
    planLoading,
    // form state
    title,
    setTitle,
    categoryId,
    setCategoryId,
    subcategoryId,
    setSubcategoryId,
    subQuestionCount,
    useAllQuestions,
    setUseAllQuestions,
    numQuestions,
    setNumQuestions,
    pickStrategy,
    setPickStrategy,
    quizType,
    setQuizType,
    diffCustom,
    setDiffCustom,
    isPublic,
    setIsPublic,
    selectedSubtypeIds,
    timeText,
    setTimeText,
    showResultsAfterQuiz,
    setShowResultsAfterQuiz,
    scheduleEnabled,
    setScheduleEnabled,
    scheduledAtLocal,
    setScheduledAtLocal,
    busy,
    errors,
    setErrors,
    // derived
    categoryNameById,
    typeNameById,
    selectedSubcategoryLabel,
    noSubcategories: subcategories.length === 0,
    // actions
    toggleSubtype,
    submit,
    handlePublicChange: (v: boolean) => {
      setIsPublic(v);
      if (v) setSelectedSubtypeIds(new Set());
    },
  };
}
