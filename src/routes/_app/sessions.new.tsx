import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronsUpDown,
  Globe,
  Lock,
  Search,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
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
  const [isPublic, setIsPublic] = useState(true);
  const [selectedSubtypeIds, setSelectedSubtypeIds] = useState<Set<string>>(new Set());
  const [timeText, setTimeText] = useState("10");
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

  // Map: category_id → category name (for display in combobox).
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
  };

  const submit = async (mode: "open" | "schedule") => {
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
      toast.error("Pick a category — quiz questions come from the chosen sub-category");
      return;
    }
    const timeNum = Number(timeText);
    if (!Number.isFinite(timeNum) || timeNum < 5 || timeNum > 3600) {
      toast.error("Time per question must be a number between 5 and 3600");
      return;
    }
    if (mode === "schedule") {
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
    if (!isPublic && selectedSubtypeIds.size === 0) {
      toast.error("Pick at least one participant sub-type, or switch to Public");
      return;
    }

    const [{ data: qs, error: qErr }, partsResult] = await Promise.all([
      supabase
        .from("questions")
        .select("id")
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
    const isScheduled = mode === "schedule";
    const subcat = subcategories.find((s) => s.id === subcategoryId);
    // Both modes start as 'scheduled' — that's what tells the lobby to show "Start Quiz".
    // Immediate (Save & Open) just leaves scheduled_at NULL, so the cron won't auto-start
    // it. The host transitions to 'active' by clicking Start Quiz in the lobby.
    const { data: inserted, error: insErr } = await supabase
      .from("quiz_sessions")
      .insert({
        owner_id: user.id,
        title: t,
        category_id: subcat?.category_id ?? null,
        subcategory_id: subcategoryId,
        mode: "qr_link",
        status: "scheduled",
        is_open: true,
        default_time_per_question: timeNum,
        access_code: generateAccessCode(),
        scheduled_at: isScheduled ? new Date(scheduledAtLocal).toISOString() : null,
        started_at: null,
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
        <ChevronLeft className="h-3.5 w-3.5" /> All sessions
      </Link>

      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">New Quiz Session</h1>
        <p className="text-muted-foreground mt-1">
          Pick a category and decide who can join, then save and open the lobby — or schedule it for
          later.
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
                Select Category <span className="text-destructive">*</span>
              </Label>
              <CategoryCombobox
                value={subcategoryId}
                label={selectedSubcategoryLabel}
                categories={categories}
                subcategories={subcategories}
                onChange={(id) => setSubcategoryId(id)}
                disabled={noSubcategories}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Type to search across categories — questions come from the sub-category you pick.
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
                    Public
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Anyone with the QR or PIN can join.
                  </p>
                </div>
              </div>
              <Switch
                id="public-switch"
                checked={isPublic}
                onCheckedChange={(v) => {
                  setIsPublic(v);
                  if (v) setSelectedSubtypeIds(new Set());
                }}
              />
            </div>

            {!isPublic && (
              <div className="pt-3 border-t border-border space-y-2">
                <Label>Select participant sub-types</Label>
                <SubtypeCombobox
                  types={types}
                  subtypes={subtypes}
                  selectedIds={selectedSubtypeIds}
                  onToggle={toggleSubtype}
                  typeNameById={typeNameById}
                />
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
                <p className="text-xs text-muted-foreground">
                  Type to search — only participants in the selected sub-types can join.
                </p>
              </div>
            )}
          </div>

          <div>
            <Label className="mb-1.5">Schedule for later (optional)</Label>
            <Input
              type="datetime-local"
              value={scheduledAtLocal}
              onChange={(e) => setScheduledAtLocal(e.target.value)}
              min={new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Only used by the <span className="font-semibold">Schedule</span> button. Leave empty
              to use Save & Open Lobby.
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => void navigate({ to: "/sessions" })}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => void submit("schedule")}
              disabled={busy || noSubcategories}
              className="gap-1.5"
            >
              <Calendar className="h-4 w-4" /> Schedule
            </Button>
            <Button
              onClick={() => void submit("open")}
              disabled={busy || noSubcategories}
              className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow"
            >
              <Zap className="h-4 w-4" /> {busy ? "Saving…" : "Save & Open Lobby"}
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
}: {
  value: string;
  label: string;
  categories: CategoryRow[];
  subcategories: SubcategoryRow[];
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="w-full justify-between font-normal"
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
                      // Build a searchable string so cmdk filters across both names
                      value={`${cat.name} ${s.name}`}
                      onSelect={() => {
                        onChange(s.id);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${
                          value === s.id ? "opacity-100" : "opacity-0"
                        }`}
                      />
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
}: {
  types: TypeRow[];
  subtypes: SubtypeRow[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  typeNameById: Map<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const placeholder = selectedIds.size === 0
    ? "Search sub-types…"
    : `${selectedIds.size} sub-type${selectedIds.size === 1 ? "" : "s"} selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between font-normal">
          <span className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <span className={selectedIds.size === 0 ? "text-muted-foreground" : ""}>
              {placeholder}
            </span>
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
                      <Check
                        className={`mr-2 h-4 w-4 ${
                          selectedIds.has(s.id) ? "opacity-100" : "opacity-0"
                        }`}
                      />
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
