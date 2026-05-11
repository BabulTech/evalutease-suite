import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronsUpDown,
  Globe,
  Hash,
  Layers,
  Lock,
  Search,
  Shuffle,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateAccessCode } from "@/components/sessions/types";
import { usePlan } from "@/contexts/PlanContext";
import { LazyUpgradeModal } from "@/components/LazyUpgradeModal";

export const Route = createFileRoute("/_app/sessions/new")({ component: NewSessionPage });

type CategoryRow = { id: string; name: string };
type SubcategoryRow = { id: string; category_id: string; name: string };
type TypeRow = { id: string; name: string };
type SubtypeRow = { id: string; type_id: string; name: string };

type DifficultyCustom = { easy: number; medium: number; hard: number; enabled: boolean };
type PickStrategy = "random" | "least_used" | "most_used" | "newest" | "oldest";

const PICK_STRATEGY_DEFS: { value: PickStrategy; labelKey: string; descKey: string; icon: React.ElementType }[] = [
  { value: "random",     labelKey: "newSess.psRandom",    descKey: "newSess.psRandomDesc",    icon: Shuffle },
  { value: "least_used", labelKey: "newSess.psLeastUsed", descKey: "newSess.psLeastUsedDesc", icon: TrendingDown },
  { value: "most_used",  labelKey: "newSess.psMostUsed",  descKey: "newSess.psMostUsedDesc",  icon: TrendingUp },
  { value: "newest",     labelKey: "newSess.psNewest",    descKey: "newSess.psNewestDesc",    icon: Hash },
  { value: "oldest",     labelKey: "newSess.psOldest",    descKey: "newSess.psOldestDesc",    icon: Hash },
];

const QUIZ_TYPES = [
  { value: "mcq", label: "MCQ (Multiple Choice)" },
  { value: "true_false", label: "True / False" },
  { value: "mixed", label: "Mixed" },
  { value: "short_answer", label: "Short Answer" },
  { value: "descriptive", label: "Descriptive" },
];

type FieldErrors = {
  title?: string;
  category?: string;
  quizType?: string;
  time?: string;
  schedule?: string;
  subtypes?: string;
};

function NewSessionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();
  const { isLocked, remaining, plan, loading: planLoading } = usePlan();
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Show locked screen when daily quiz limit is exhausted
  if (!planLoading && isLocked("quizzes_per_day")) {
    return (
      <>
        <div className="max-w-md mx-auto mt-20 text-center space-y-5">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-destructive/15 flex items-center justify-center">
            <Lock className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold">{t("newSess.limitTitle")}</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Your <span className="font-semibold text-foreground">{plan?.name ?? "Free"}</span>{" "}
              {t("newSess.limitDesc").replace("{n}", String(plan?.limits.quizzes_per_day ?? 5))}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              className="bg-gradient-primary text-primary-foreground shadow-glow gap-2"
              onClick={() => setShowUpgrade(true)}
            >
              <Zap className="h-4 w-4" /> {t("newSess.upgradePlan")}
            </Button>
            <Button variant="ghost" onClick={() => void navigate({ to: "/sessions" })}>
              {t("newSess.backToSessions")}
            </Button>
          </div>
        </div>
        <LazyUpgradeModal
          open={showUpgrade}
          onClose={() => setShowUpgrade(false)}
          lockedFeature="Daily quiz creation"
        />
      </>
    );
  }
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
  const [diffCustom, setDiffCustom] = useState<DifficultyCustom>({ easy: 3, medium: 4, hard: 3, enabled: false });
  const [isPublic, setIsPublic] = useState(true);
  const [selectedSubtypeIds, setSelectedSubtypeIds] = useState<Set<string>>(new Set());
  const [timeText, setTimeText] = useState("10");
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

  useEffect(() => {
    if (!subcategoryId || !user) { setSubQuestionCount(null); return; }
    supabase.from("questions").select("id", { count: "exact", head: true })
      .eq("owner_id", user.id).eq("subcategory_id", subcategoryId)
      .then(({ count }) => {
        const n = count ?? 0;
        setSubQuestionCount(n);
        setNumQuestions(Math.min(numQuestions || n, n));
        setUseAllQuestions(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subcategoryId, user]);

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.id, c.name);
    return m;
  }, [categories]);

  const typeNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of types) m.set(t.id, t.name);
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
    const t = title.trim();
    if (!t) errs.title = "Title is required";
    else if (t.length > 200) errs.title = "Title must be ≤ 200 characters";
    if (!subcategoryId) errs.category = "Pick a category - quiz questions come from the chosen sub-category";
    if (!quizType) errs.quizType = "Select a quiz type";
    const timeNum = Number(timeText);
    if (!Number.isFinite(timeNum) || timeNum < 5 || timeNum > 3600)
      errs.time = "Time per question must be between 5 and 3600 seconds";
    if (mode === "schedule") {
      if (!scheduledAtLocal) errs.schedule = "Pick a date and time to schedule";
      else {
        const ts = new Date(scheduledAtLocal);
        if (Number.isNaN(ts.getTime())) errs.schedule = "Invalid schedule time";
        else if (ts.getTime() < Date.now() - 60_000) errs.schedule = "Schedule must be in the future";
      }
    }
    if (!isPublic && selectedSubtypeIds.size === 0)
      errs.subtypes = "Pick at least one participant sub-type, or switch to Public";
    return errs;
  };

  const submit = async (mode: "open" | "schedule") => {
    if (!user) return;
    const errs = validate(mode);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error(t("newSess.fixFields"));
      return;
    }
    setErrors({});

    const titleVal = title.trim();
    const timeNum = Number(timeText);

    // Fetch all questions from subcategory with created_at for ordering
    const [{ data: qs, error: qErr }, partsResult] = await Promise.all([
      supabase
        .from("questions")
        .select("id, created_at")
        .eq("owner_id", user.id)
        .eq("subcategory_id", subcategoryId),
      !isPublic && selectedSubtypeIds.size > 0
        ? supabase
            .from("participants")
            .select("id, subtype_id")
            .eq("owner_id", user.id)
            .in("subtype_id", Array.from(selectedSubtypeIds))
        : Promise.resolve({ data: [] as { id: string; subtype_id: string | null }[], error: null }),
    ]);
    if (qErr) { toast.error(qErr.message); return; }
    if (partsResult.error) { toast.error(partsResult.error.message); return; }
    let allQuestions = qs ?? [];
    if (allQuestions.length === 0) {
      setErrors((prev) => ({ ...prev, category: "That sub-category has no questions yet - add some first" }));
      toast.error("No questions in that sub-category");
      return;
    }

    // Apply pick strategy if not using all questions
    const wantN = useAllQuestions ? allQuestions.length : Math.min(numQuestions, allQuestions.length);
    let selectedQs = allQuestions;
    if (wantN < allQuestions.length) {
      if (pickStrategy === "random") {
        // Fisher-Yates shuffle then slice
        const arr = [...allQuestions];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        selectedQs = arr.slice(0, wantN);
      } else if (pickStrategy === "newest") {
        selectedQs = [...allQuestions].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, wantN);
      } else if (pickStrategy === "oldest") {
        selectedQs = [...allQuestions].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, wantN);
      } else {
        // least_used / most_used - need usage counts
        const ids = allQuestions.map((q) => q.id);
        const { data: usageData } = await supabase
          .from("quiz_session_questions")
          .select("question_id")
          .in("question_id", ids);
        const usageMap = new Map<string, number>();
        for (const row of usageData ?? []) {
          usageMap.set(row.question_id, (usageMap.get(row.question_id) ?? 0) + 1);
        }
        selectedQs = [...allQuestions].sort((a, b) => {
          const ua = usageMap.get(a.id) ?? 0;
          const ub = usageMap.get(b.id) ?? 0;
          return pickStrategy === "least_used" ? ua - ub : ub - ua;
        }).slice(0, wantN);
      }
    }
    const questionIds = selectedQs.map((q) => q.id);
    const participantIds = (partsResult.data ?? []).map((p) => p.id);

    setBusy(true);
    const isScheduled = mode === "schedule";
    const subcat = subcategories.find((s) => s.id === subcategoryId);
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
        default_time_per_question: timeNum,
        access_code: generateAccessCode(),
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

    const sessionQuestions = questionIds.map((qid, i) => ({
      session_id: sessionId,
      question_id: qid,
      position: i,
      time_seconds: timeNum,
    }));
    const { error: qsErr } = await supabase
      .from("quiz_session_questions")
      .insert(sessionQuestions);
    if (qsErr) {
      setBusy(false);
      toast.error(`Saved session but failed to attach questions: ${qsErr.message}`);
      return;
    }

    if (!isPublic && selectedSubtypeIds.size > 0) {
      const subtypeRows = Array.from(selectedSubtypeIds).map((id) => ({
        session_id: sessionId,
        subtype_id: id,
      }));
      const { error: subErr } = await supabase.from("quiz_session_subtypes").insert(subtypeRows);
      if (subErr) toast.error(`Saved session but failed to record sub-types: ${subErr.message}`);
    }
    if (participantIds.length > 0) {
      const participantRows = participantIds.map((pid) => ({
        session_id: sessionId,
        participant_id: pid,
      }));
      const { error: pErr } = await supabase.from("quiz_session_participants").insert(participantRows);
      if (pErr) toast.error(`Saved session but failed to attach participants: ${pErr.message}`);
    }

    setBusy(false);
    toast.success(isScheduled ? t("newSess.sessionScheduled") : t("newSess.lobbyOpen"));
    if (isScheduled) {
      void navigate({ to: "/sessions" });
    } else {
      void navigate({ to: "/sessions/$sessionId", params: { sessionId } });
    }
  };

  const noSubcategories = subcategories.length === 0;

  return (
    <div className="space-y-6">
      <Link
        to="/sessions"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> {t("newSess.allSessions")}
      </Link>

      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">{t("newSess.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("newSess.desc")}</p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          Loading…
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card/60 p-5 md:p-6 space-y-5">
          {/* Title */}
          <div>
            <Label className="mb-1.5">
              {t("newSess.titleLabel")} <span className="text-destructive">*</span>
            </Label>
            <Input
              value={title}
              onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: undefined })); }}
              placeholder={t("newSess.titlePlaceholder")}
              maxLength={200}
              autoFocus
              className={errors.title ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title}</p>}
          </div>

          {/* Step 1: Category → Sub-category cascade */}
          <div className="rounded-2xl border border-border bg-muted/10 p-4 space-y-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">1</span>
              {t("newSess.step1")}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1">{t("newSess.category")} <span className="text-destructive">*</span></Label>
                <p className="text-[11px] text-muted-foreground mb-1.5">{t("newSess.categoryHint")}</p>
                <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setSubcategoryId(""); setErrors((p) => ({ ...p, category: undefined })); }}>
                  <SelectTrigger className={errors.category && !categoryId ? "border-destructive" : ""}>
                    <SelectValue placeholder={t("newSess.selectCategory")} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1">{t("newSess.subCategory")} <span className="text-destructive">*</span></Label>
                <p className="text-[11px] text-muted-foreground mb-1.5">{t("newSess.subCategoryHint")}</p>
                <Select value={subcategoryId} disabled={!categoryId}
                  onValueChange={(v) => { setSubcategoryId(v); setErrors((p) => ({ ...p, category: undefined })); }}>
                  <SelectTrigger className={errors.category ? "border-destructive" : ""}>
                    <SelectValue placeholder={categoryId ? t("newSess.selectSubCategory") : t("newSess.pickCategoryFirst")} />
                  </SelectTrigger>
                  <SelectContent>
                    {subcategories.filter((s) => s.category_id === categoryId).map((s) =>
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}

            {/* Question count + pick strategy */}
            {subcategoryId && subQuestionCount !== null && (
              <div className="rounded-xl border border-border bg-card/40 p-4 space-y-4">
                {/* Available count badge */}
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-semibold">
                    {subQuestionCount} {subQuestionCount !== 1 ? t("newSess.questions") : t("newSess.question")} {t("newSess.available")}
                  </span>
                  {subQuestionCount === 0 && (
                    <span className="text-xs text-destructive">{t("newSess.addQuestionsFirst")}</span>
                  )}
                </div>

                {subQuestionCount > 0 && (
                  <>
                    {/* All vs. custom count toggle */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setUseAllQuestions(true)}
                        className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors text-left ${
                          useAllQuestions
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border bg-card/30 text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        <div className="font-semibold">{t("newSess.allQuestions")}</div>
                        <div className="text-[11px] mt-0.5 opacity-80">{t("newSess.allQuestionsDesc").replace("{n}", String(subQuestionCount))}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setUseAllQuestions(false); if (numQuestions === 0 || numQuestions > subQuestionCount) setNumQuestions(Math.min(10, subQuestionCount)); }}
                        className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors text-left ${
                          !useAllQuestions
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border bg-card/30 text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        <div className="font-semibold">{t("newSess.pickNumber")}</div>
                        <div className="text-[11px] mt-0.5 opacity-80">{t("newSess.pickNumberDesc")}</div>
                      </button>
                    </div>

                    {/* Number input + strategy */}
                    {!useAllQuestions && (
                      <div className="space-y-3 pt-1 border-t border-border">
                        <div>
                          <Label className="mb-1.5 text-sm">
                            {t("newSess.numberOfQuestions")}
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              ({t("newSess.maxN").replace("{n}", String(subQuestionCount))})
                            </span>
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={1}
                              max={subQuestionCount}
                              value={numQuestions}
                              onChange={(e) => {
                                const v = Math.max(1, Math.min(subQuestionCount, Number(e.target.value) || 1));
                                setNumQuestions(v);
                              }}
                              className="w-28"
                            />
                            <span className="text-xs text-muted-foreground">
                              {t("newSess.ofNSelected").replace("{n}", String(subQuestionCount))}
                            </span>
                          </div>
                        </div>

                        {numQuestions < subQuestionCount && (
                          <div>
                            <Label className="mb-2 text-sm">{t("newSess.howToPick")}</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {PICK_STRATEGY_DEFS.map((s) => {
                                const Icon = s.icon;
                                return (
                                  <button
                                    key={s.value}
                                    type="button"
                                    onClick={() => setPickStrategy(s.value)}
                                    className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                                      pickStrategy === s.value
                                        ? "border-primary/50 bg-primary/10"
                                        : "border-border bg-card/30 hover:border-primary/30"
                                    }`}
                                  >
                                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${pickStrategy === s.value ? "text-primary" : "text-muted-foreground"}`} />
                                    <div>
                                      <div className={`text-xs font-semibold ${pickStrategy === s.value ? "text-primary" : ""}`}>
                                        {t(s.labelKey)}
                                      </div>
                                      <div className="text-[10px] text-muted-foreground">{t(s.descKey)}</div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Quiz config */}
          <div className="rounded-2xl border border-border bg-muted/10 p-4 space-y-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">2</span>
              {t("newSess.step2")}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1">{t("newSess.quizType")} <span className="text-destructive">*</span></Label>
                <p className="text-[11px] text-muted-foreground mb-1.5">{t("newSess.quizTypeHint")}</p>
                <Select value={quizType} onValueChange={(v) => { setQuizType(v); setErrors((p) => ({ ...p, quizType: undefined })); }}>
                  <SelectTrigger className={errors.quizType ? "border-destructive" : ""}>
                    <SelectValue placeholder={t("newSess.selectQuizType")} />
                  </SelectTrigger>
                  <SelectContent>
                    {QUIZ_TYPES.map((qt) => <SelectItem key={qt.value} value={qt.value}>{qt.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.quizType && <p className="mt-1 text-xs text-destructive">{errors.quizType}</p>}
              </div>
              <div>
                <Label className="mb-1">{t("newSess.timePerQ")}</Label>
                <p className="text-[11px] text-muted-foreground mb-1.5">{t("newSess.timePerQHint")}</p>
                <Input type="number" min={5} max={3600} value={timeText}
                  onChange={(e) => { setTimeText(e.target.value); setErrors((p) => ({ ...p, time: undefined })); }}
                  className={errors.time ? "border-destructive" : ""} />
                {errors.time && <p className="mt-1 text-xs text-destructive">{errors.time}</p>}
              </div>
            </div>

            {/* Difficulty customization */}
            <div className="rounded-xl border border-border bg-card/40 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{t("newSess.customDifficulty")}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {t("newSess.customDifficultyDesc")}
                  </div>
                </div>
                <Switch checked={diffCustom.enabled}
                  onCheckedChange={(v) => setDiffCustom((p) => ({ ...p, enabled: v }))} />
              </div>
              {diffCustom.enabled && (
                <div className="grid grid-cols-3 gap-3 pt-1 border-t border-border">
                  {(["easy", "medium", "hard"] as const).map((level) => {
                    const colors = { easy: "text-success", medium: "text-primary", hard: "text-destructive" };
                    return (
                      <div key={level}>
                        <label className={`text-xs font-semibold capitalize ${colors[level]} mb-1 block`}>
                          {level === "easy" ? "🟢" : level === "medium" ? "🟡" : "🔴"} {level}
                        </label>
                        <p className="text-[10px] text-muted-foreground mb-1">{t("newSess.numberOfQuestionsLabel")}</p>
                        <Input type="number" min={0} max={50} value={diffCustom[level]}
                          onChange={(e) => setDiffCustom((p) => ({ ...p, [level]: Math.max(0, Number(e.target.value)) }))}
                          className="h-8 text-sm" />
                      </div>
                    );
                  })}
                  <div className="col-span-3 text-xs text-muted-foreground">
                    {t("newSess.diffTotal").replace("{n}", String(diffCustom.easy + diffCustom.medium + diffCustom.hard))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Public / Private */}
          <div className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {isPublic ? (
                  <Globe className="h-4 w-4 text-primary" />
                ) : (
                  <Lock className="h-4 w-4 text-warning" />
                )}
                <div>
                  <Label htmlFor="public-switch" className="text-sm font-semibold">
                    {t("newSess.public")}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("newSess.publicDesc")}
                  </p>
                </div>
              </div>
              <Switch
                id="public-switch"
                checked={isPublic}
                onCheckedChange={(v) => {
                  setIsPublic(v);
                  if (v) setSelectedSubtypeIds(new Set());
                  setErrors((p) => ({ ...p, subtypes: undefined }));
                }}
              />
            </div>

            {!isPublic && (
              <div className="pt-3 border-t border-border space-y-2">
                <Label>{t("newSess.selectSubTypes")}</Label>
                <SubtypeCombobox
                  types={types}
                  subtypes={subtypes}
                  selectedIds={selectedSubtypeIds}
                  onToggle={toggleSubtype}
                  typeNameById={typeNameById}
                  hasError={!!errors.subtypes}
                />
                {errors.subtypes && <p className="text-xs text-destructive">{errors.subtypes}</p>}
                {selectedSubtypeIds.size > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {Array.from(selectedSubtypeIds).map((id) => {
                      const s = subtypes.find((x) => x.id === id);
                      if (!s) return null;
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-2 py-0.5 text-xs"
                        >
                          {typeNameById.get(s.type_id) ?? "?"} → {s.name}
                          <button
                            type="button"
                            onClick={() => toggleSubtype(id)}
                            className="hover:bg-primary/20 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                {!errors.subtypes && (
                  <p className="text-xs text-muted-foreground">
                    {t("newSess.subtypesNote")}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Schedule */}
          <div className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" />
                <div>
                  <Label htmlFor="schedule-switch" className="text-sm font-semibold">
                    {t("newSess.scheduleLater")}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("newSess.scheduleLaterDesc")}
                  </p>
                </div>
              </div>
              <Switch
                id="schedule-switch"
                checked={scheduleEnabled}
                onCheckedChange={(v) => {
                  setScheduleEnabled(v);
                  if (v && !scheduledAtLocal) {
                    const next = new Date(Date.now() + 30 * 60_000);
                    next.setSeconds(0, 0);
                    setScheduledAtLocal(next.toISOString().slice(0, 16));
                  }
                  if (!v) { setScheduledAtLocal(""); setErrors((p) => ({ ...p, schedule: undefined })); }
                }}
              />
            </div>

            {scheduleEnabled && (
              <div className="pt-3 border-t border-border">
                <Label className="mb-1.5">{t("newSess.dateTime")}</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAtLocal}
                  onChange={(e) => { setScheduledAtLocal(e.target.value); setErrors((p) => ({ ...p, schedule: undefined })); }}
                  min={new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16)}
                  className={errors.schedule ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.schedule ? (
                  <p className="mt-1 text-xs text-destructive">{errors.schedule}</p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("newSess.scheduleNote")}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-border">
            <Button
              onClick={() => void submit(scheduleEnabled ? "schedule" : "open")}
              disabled={busy || noSubcategories}
              className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow"
            >
              {scheduleEnabled ? (
                <Calendar className="h-4 w-4" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {busy ? t("newSess.saving") : scheduleEnabled ? t("newSess.schedule") : t("newSess.saveOpenLobby")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryCombobox({
  value,
  label,
  categories,
  subcategories,
  onChange,
  disabled,
  hasError,
}: {
  value: string;
  label: string;
  categories: CategoryRow[];
  subcategories: SubcategoryRow[];
  onChange: (id: string) => void;
  disabled?: boolean;
  hasError?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={`w-full justify-between font-normal ${hasError ? "border-destructive" : ""}`}
        >
          <span className={value ? "" : "text-muted-foreground"}>
            {label || (disabled ? "Create a sub-category first" : "Search categories…")}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command>
          <CommandInput placeholder="Type to search…" />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            {categories.map((cat) => {
              const subs = subcategories.filter((s) => s.category_id === cat.id);
              if (subs.length === 0) return null;
              return (
                <CommandGroup key={cat.id} heading={cat.name}>
                  {subs.map((s) => (
                    <CommandItem
                      key={s.id}
                      value={`${cat.name} ${s.name}`}
                      onSelect={() => { onChange(s.id); setOpen(false); }}
                    >
                      <Check className={`mr-2 h-4 w-4 ${value === s.id ? "opacity-100" : "opacity-0"}`} />
                      {s.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function SubtypeCombobox({
  types,
  subtypes,
  selectedIds,
  onToggle,
  typeNameById,
  hasError,
}: {
  types: TypeRow[];
  subtypes: SubtypeRow[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  typeNameById: Map<string, string>;
  hasError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const placeholder = selectedIds.size === 0
    ? "Search sub-types…"
    : `${selectedIds.size} sub-type${selectedIds.size === 1 ? "" : "s"} selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={`w-full justify-between font-normal ${hasError ? "border-destructive" : ""}`}
        >
          <span className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <span className={selectedIds.size === 0 ? "text-muted-foreground" : ""}>{placeholder}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command>
          <CommandInput placeholder="Type to search e.g. Class 9, Engineering…" />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            {types.map((t) => {
              const subs = subtypes.filter((s) => s.type_id === t.id);
              if (subs.length === 0) return null;
              return (
                <CommandGroup key={t.id} heading={t.name}>
                  {subs.map((s) => (
                    <CommandItem
                      key={s.id}
                      value={`${typeNameById.get(s.type_id) ?? ""} ${s.name}`}
                      onSelect={() => onToggle(s.id)}
                    >
                      <Check className={`mr-2 h-4 w-4 ${selectedIds.has(s.id) ? "opacity-100" : "opacity-0"}`} />
                      {s.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
