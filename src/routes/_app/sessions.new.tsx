import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Calendar, ChevronLeft, Globe, Lock, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateAccessCode } from "@/components/sessions/types";

export const Route = createFileRoute("/_app/sessions/new")({ component: NewSessionPage });

type CategoryRow = { id: string; name: string };
type SubcategoryRow = { id: string; category_id: string; name: string };
type TypeRow = { id: string; name: string };
type SubtypeRow = { id: string; type_id: string; name: string };

function NewSessionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryRow[]>([]);
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [subtypes, setSubtypes] = useState<SubtypeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [subcategoryId, setSubcategoryId] = useState<string>("");
  const [selectedSubtypeIds, setSelectedSubtypeIds] = useState<Set<string>>(new Set());
  const [timeText, setTimeText] = useState("10");
  const [saveMode, setSaveMode] = useState<"now" | "schedule">("now");
  const [scheduledAtLocal, setScheduledAtLocal] = useState("");
  const [busy, setBusy] = useState(false);

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

  const subcategoriesByCategory = useMemo(() => {
    const map = new Map<string, SubcategoryRow[]>();
    for (const s of subcategories) {
      const arr = map.get(s.category_id) ?? [];
      arr.push(s);
      map.set(s.category_id, arr);
    }
    return map;
  }, [subcategories]);

  const subtypesByType = useMemo(() => {
    const map = new Map<string, SubtypeRow[]>();
    for (const s of subtypes) {
      const arr = map.get(s.type_id) ?? [];
      arr.push(s);
      map.set(s.type_id, arr);
    }
    return map;
  }, [subtypes]);

  const toggleSubtype = (id: string) => {
    setSelectedSubtypeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (!user) return;
    const t = title.trim();
    if (!t) {
      toast.error("Title is required");
      return;
    }
    if (t.length > 200) {
      toast.error("Title must be ≤ 200 characters");
      return;
    }
    if (!subcategoryId) {
      toast.error("Pick a sub-category — questions for the quiz come from there");
      return;
    }
    const timeNum = Number(timeText);
    if (!Number.isFinite(timeNum) || timeNum < 5 || timeNum > 3600) {
      toast.error("Time per question must be a number between 5 and 3600");
      return;
    }
    if (saveMode === "schedule") {
      if (!scheduledAtLocal) {
        toast.error("Pick a date and time to schedule the session");
        return;
      }
      const ts = new Date(scheduledAtLocal);
      if (Number.isNaN(ts.getTime())) {
        toast.error("That schedule time is invalid");
        return;
      }
      if (ts.getTime() < Date.now() - 60_000) {
        toast.error("Schedule must be in the future");
        return;
      }
    }

    // Pull questions and participants the host has implicitly chosen.
    const [{ data: qs, error: qErr }, partsResult] = await Promise.all([
      supabase
        .from("questions")
        .select("id")
        .eq("owner_id", user.id)
        .eq("subcategory_id", subcategoryId),
      selectedSubtypeIds.size > 0
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
    const questionIds = (qs ?? []).map((q) => q.id);
    if (questionIds.length === 0) {
      toast.error("That sub-category has no questions yet — add some before creating a session");
      return;
    }
    const participantIds = (partsResult.data ?? []).map((p) => p.id);

    setBusy(true);
    const isScheduled = saveMode === "schedule";
    const subcat = subcategories.find((s) => s.id === subcategoryId);
    const { data: inserted, error: insErr } = await supabase
      .from("quiz_sessions")
      .insert({
        owner_id: user.id,
        title: t,
        category_id: subcat?.category_id ?? null,
        subcategory_id: subcategoryId,
        mode: "qr_link",
        status: isScheduled ? "scheduled" : "active",
        is_open: true,
        default_time_per_question: timeNum,
        access_code: generateAccessCode(),
        scheduled_at: isScheduled ? new Date(scheduledAtLocal).toISOString() : null,
        started_at: isScheduled ? null : new Date().toISOString(),
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
      time_seconds: timeNum, // session-level override wins
    }));
    const { error: qsErr } = await supabase
      .from("quiz_session_questions")
      .insert(sessionQuestions);
    if (qsErr) {
      setBusy(false);
      toast.error(`Saved session but failed to attach questions: ${qsErr.message}`);
      return;
    }

    if (selectedSubtypeIds.size > 0) {
      const subtypeRows = Array.from(selectedSubtypeIds).map((id) => ({
        session_id: sessionId,
        subtype_id: id,
      }));
      const { error: subErr } = await supabase
        .from("quiz_session_subtypes")
        .insert(subtypeRows);
      if (subErr) {
        toast.error(`Saved session but failed to record sub-types: ${subErr.message}`);
      }
    }
    if (participantIds.length > 0) {
      const participantRows = participantIds.map((pid) => ({
        session_id: sessionId,
        participant_id: pid,
      }));
      const { error: pErr } = await supabase
        .from("quiz_session_participants")
        .insert(participantRows);
      if (pErr) {
        toast.error(`Saved session but failed to attach participants: ${pErr.message}`);
      }
    }

    setBusy(false);
    toast.success(isScheduled ? "Session scheduled" : "Lobby is open");
    if (isScheduled) {
      void navigate({ to: "/sessions" });
    } else {
      void navigate({ to: "/sessions", search: { lobby: sessionId } });
    }
  };

  const isPublic = selectedSubtypeIds.size === 0;
  const totalParticipantsForSelection = useMemo(() => {
    if (selectedSubtypeIds.size === 0) return 0;
    // We don't have the participant counts here without an extra query; show subtype count instead.
    return Array.from(selectedSubtypeIds).length;
  }, [selectedSubtypeIds]);

  const noSubcategories = subcategories.length === 0;

  return (
    <div className="space-y-6">
      <Link
        to="/sessions"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> All sessions
      </Link>

      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">New Quiz Session</h1>
        <p className="text-muted-foreground mt-1">
          Pick a sub-category (questions come from there) and the participant sub-types you want to
          invite, then save and open the lobby — or schedule it for later.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          Loading…
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card/60 p-5 md:p-6 space-y-5">
          <div>
            <Label className="mb-1.5">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Class 9 — Science quiz, Friday review"
              maxLength={200}
              autoFocus
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="mb-1.5">
                Sub-Category <span className="text-destructive">*</span>
              </Label>
              <Select
                value={subcategoryId}
                onValueChange={(v) => setSubcategoryId(v)}
                disabled={noSubcategories}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      noSubcategories
                        ? "Create a sub-category first on Manage Categories"
                        : "Pick a sub-category"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => {
                    const subs = subcategoriesByCategory.get(cat.id) ?? [];
                    if (subs.length === 0) return null;
                    return (
                      <SelectGroup key={cat.id}>
                        <SelectLabel>{cat.name}</SelectLabel>
                        {subs.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Questions tagged in this sub-category fill the quiz.
              </p>
            </div>

            <div>
              <Label className="mb-1.5">Time per question (seconds)</Label>
              <Input
                type="number"
                min={5}
                max={3600}
                value={timeText}
                onChange={(e) => setTimeText(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Overrides each question's individual time for this session only.
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>
                Participant sub-types{" "}
                <span className="text-muted-foreground font-normal">
                  ({totalParticipantsForSelection} selected — leave empty for public)
                </span>
              </Label>
            </div>
            <div className="rounded-xl border border-border bg-card/20 px-3 py-2 mb-2 flex items-center gap-2 text-xs">
              {isPublic ? (
                <>
                  <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>
                    <span className="font-semibold text-foreground">Public:</span> anyone with the
                    QR or PIN can join.
                  </span>
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5 text-warning shrink-0" />
                  <span>
                    <span className="font-semibold text-foreground">Closed roster:</span>{" "}
                    participants in the selected sub-types can join.
                  </span>
                </>
              )}
            </div>
            {types.length === 0 ? (
              <div className="rounded-xl border border-border bg-card/30 p-4 text-xs text-muted-foreground">
                No participant types yet — leave empty for public, or add some on Manage
                Participants.
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card/30 max-h-[260px] overflow-y-auto divide-y divide-border/50">
                {types.map((t) => {
                  const subs = subtypesByType.get(t.id) ?? [];
                  if (subs.length === 0) return null;
                  return (
                    <div key={t.id} className="p-3">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                        {t.name}
                      </div>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {subs.map((s) => {
                          const checked = selectedSubtypeIds.has(s.id);
                          return (
                            <label
                              key={s.id}
                              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                                checked
                                  ? "border-primary/50 bg-primary/10"
                                  : "border-border bg-background/30 hover:border-primary/30"
                              }`}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => toggleSubtype(s.id)}
                              />
                              <span className="truncate">{s.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>When should the lobby open?</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <SaveModeCard
                active={saveMode === "now"}
                onClick={() => setSaveMode("now")}
                icon={<Zap className="h-4 w-4" />}
                title="Save and Open"
                detail="Lobby opens immediately. Hit Start when everyone has joined."
              />
              <SaveModeCard
                active={saveMode === "schedule"}
                onClick={() => setSaveMode("schedule")}
                icon={<Calendar className="h-4 w-4" />}
                title="Schedule"
                detail="Lobby opens automatically at the time you pick."
              />
            </div>
            {saveMode === "schedule" && (
              <div>
                <Label className="mb-1.5">Start time</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAtLocal}
                  onChange={(e) => setScheduledAtLocal(e.target.value)}
                  min={new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Auto-start runs every minute via a Postgres cron job. Enable the{" "}
                  <span className="font-mono">pg_cron</span> extension in Supabase if you haven't
                  already.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" disabled={busy} onClick={() => void navigate({ to: "/sessions" })}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={busy || noSubcategories}
              className="bg-gradient-primary text-primary-foreground shadow-glow"
            >
              {busy
                ? "Saving…"
                : saveMode === "now"
                  ? "Save and Open"
                  : "Schedule"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SaveModeCard({
  active,
  onClick,
  icon,
  title,
  detail,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border px-3 py-3 transition-colors ${
        active
          ? "border-primary/50 bg-primary/10 shadow-glow"
          : "border-border bg-card/40 hover:border-primary/30"
      }`}
    >
      <div className={`flex items-center gap-2 font-semibold text-sm ${active ? "text-primary" : ""}`}>
        {icon}
        {title}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </button>
  );
}
