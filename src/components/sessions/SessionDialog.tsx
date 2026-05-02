import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Search, Globe, Lock, Calendar, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  emptyDraft,
  validateDraft,
  TIME_OPTIONS,
  type Category,
  type ParticipantLite,
  type QuestionLite,
  type SessionDraft,
  type SaveMode,
} from "./types";

type Props = {
  trigger: ReactNode;
  initial?: SessionDraft;
  title: string;
  description?: string;
  submitLabel?: string;
  categories: Category[];
  questions: QuestionLite[];
  participants: ParticipantLite[];
  onSubmit: (draft: SessionDraft) => Promise<void>;
};

export function SessionDialog({
  trigger,
  initial,
  title,
  description,
  submitLabel = "Save",
  categories,
  questions,
  participants,
  onSubmit,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SessionDraft>(() => initial ?? emptyDraft());
  const [busy, setBusy] = useState(false);
  const [qSearch, setQSearch] = useState("");
  const [pSearch, setPSearch] = useState("");

  const handleOpen = (o: boolean) => {
    setOpen(o);
    if (o) {
      setDraft(initial ?? emptyDraft());
      setQSearch("");
      setPSearch("");
    }
  };

  useEffect(() => {
    if (!open) return;
    setDraft((d) => {
      if (!d.categoryId) return d;
      const valid = new Set(
        questions.filter((q) => q.category_id === d.categoryId).map((q) => q.id),
      );
      const filtered = d.questionIds.filter((id) => valid.has(id));
      return filtered.length === d.questionIds.length ? d : { ...d, questionIds: filtered };
    });
  }, [draft.categoryId, questions, open]);

  const set = <K extends keyof SessionDraft>(key: K, value: SessionDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const filteredQuestions = useMemo(() => {
    if (!draft.categoryId) return [];
    const q = qSearch.trim().toLowerCase();
    return questions
      .filter((x) => x.category_id === draft.categoryId)
      .filter((x) => !q || x.text.toLowerCase().includes(q));
  }, [questions, draft.categoryId, qSearch]);

  const filteredParticipants = useMemo(() => {
    const q = pSearch.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter((p) => {
      const hay = [p.name, p.email, p.mobile].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [participants, pSearch]);

  const toggle = <K extends keyof SessionDraft>(key: K, id: string) => {
    setDraft((prev) => {
      const arr = prev[key] as unknown as string[];
      const next = arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
      return { ...prev, [key]: next as unknown as SessionDraft[K] };
    });
  };

  const allQuestionsSelected =
    filteredQuestions.length > 0 &&
    filteredQuestions.every((q) => draft.questionIds.includes(q.id));

  const toggleAllQuestions = () => {
    setDraft((prev) => {
      if (allQuestionsSelected) {
        const removeIds = new Set(filteredQuestions.map((q) => q.id));
        return { ...prev, questionIds: prev.questionIds.filter((id) => !removeIds.has(id)) };
      }
      const merged = new Set([...prev.questionIds, ...filteredQuestions.map((q) => q.id)]);
      return { ...prev, questionIds: Array.from(merged) };
    });
  };

  const allParticipantsSelected =
    filteredParticipants.length > 0 &&
    filteredParticipants.every((p) => draft.participantIds.includes(p.id));

  const toggleAllParticipants = () => {
    setDraft((prev) => {
      if (allParticipantsSelected) {
        const removeIds = new Set(filteredParticipants.map((p) => p.id));
        return { ...prev, participantIds: prev.participantIds.filter((id) => !removeIds.has(id)) };
      }
      const merged = new Set([...prev.participantIds, ...filteredParticipants.map((p) => p.id)]);
      return { ...prev, participantIds: Array.from(merged) };
    });
  };

  const submit = async () => {
    const v = validateDraft(draft);
    if (!v.ok) {
      toast.error(v.reason);
      return;
    }
    setBusy(true);
    try {
      await onSubmit(draft);
      setOpen(false);
    } catch {
      // onSubmit shows its own toast
    } finally {
      setBusy(false);
    }
  };

  const isPublic = draft.participantIds.length === 0;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label className="mb-1.5">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                value={draft.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Class 5 Science — Chapter 3 Review"
                maxLength={200}
                autoFocus
              />
            </div>
            <div>
              <Label className="mb-1.5">
                Category <span className="text-destructive">*</span>
              </Label>
              <Select
                value={draft.categoryId ?? ""}
                onValueChange={(v) => set("categoryId", v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground">
                      No categories yet — create one on the Questions page first.
                    </div>
                  ) : (
                    categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5">Time per question</Label>
              <Select
                value={String(draft.timePerQuestionSec)}
                onValueChange={(v) => set("timePerQuestionSec", Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={String(t.value)}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>
                Questions <span className="text-destructive">*</span>{" "}
                <span className="text-muted-foreground font-normal">
                  ({draft.questionIds.length} selected)
                </span>
              </Label>
              {filteredQuestions.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAllQuestions}
                  className="text-xs text-primary hover:underline"
                >
                  {allQuestionsSelected ? "Clear all" : "Select all"}
                </button>
              )}
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={qSearch}
                onChange={(e) => setQSearch(e.target.value)}
                placeholder="Filter questions in this category…"
                className="pl-9"
                disabled={!draft.categoryId}
              />
            </div>
            <div className="rounded-xl border border-border bg-card/30 max-h-[260px] overflow-y-auto">
              {!draft.categoryId ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Choose a category to see its questions.
                </div>
              ) : filteredQuestions.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No questions match. Add some on the Questions page or clear the filter.
                </div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {filteredQuestions.map((q) => {
                    const checked = draft.questionIds.includes(q.id);
                    return (
                      <li key={q.id}>
                        <label className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted/30 cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggle("questionIds", q.id)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm leading-snug truncate">{q.text}</div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                              {q.difficulty}
                            </div>
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>
                Invite participants{" "}
                <span className="text-muted-foreground font-normal">
                  ({draft.participantIds.length} selected — leave empty for public)
                </span>
              </Label>
              {filteredParticipants.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAllParticipants}
                  className="text-xs text-primary hover:underline"
                >
                  {allParticipantsSelected ? "Clear all" : "Select all"}
                </button>
              )}
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
                    <span className="font-semibold text-foreground">Closed roster:</span> only the{" "}
                    {draft.participantIds.length} selected participant
                    {draft.participantIds.length === 1 ? "" : "s"} will be able to play.
                  </span>
                </>
              )}
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={pSearch}
                onChange={(e) => setPSearch(e.target.value)}
                placeholder="Search by name, email, mobile…"
                className="pl-9"
              />
            </div>
            <div className="rounded-xl border border-border bg-card/30 max-h-[200px] overflow-y-auto">
              {filteredParticipants.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  {participants.length === 0
                    ? "No participants on your roster yet — add them on the Participants page."
                    : "No matches."}
                </div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {filteredParticipants.map((p) => {
                    const checked = draft.participantIds.includes(p.id);
                    return (
                      <li key={p.id}>
                        <label className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted/30 cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggle("participantIds", p.id)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{p.name}</div>
                            {(p.email || p.mobile) && (
                              <div className="text-xs text-muted-foreground truncate">
                                {[p.email, p.mobile].filter(Boolean).join(" · ")}
                              </div>
                            )}
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>When should the lobby open?</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <SaveModeCard
                mode="now"
                active={draft.saveMode === "now"}
                onClick={() => set("saveMode", "now" as SaveMode)}
                icon={<Zap className="h-4 w-4" />}
                title="Save and open now"
                detail="The lobby opens immediately. Hit Start when everyone has joined."
              />
              <SaveModeCard
                mode="schedule"
                active={draft.saveMode === "schedule"}
                onClick={() => set("saveMode", "schedule" as SaveMode)}
                icon={<Calendar className="h-4 w-4" />}
                title="Schedule for later"
                detail="The lobby opens automatically at the time you pick."
              />
            </div>
            {draft.saveMode === "schedule" && (
              <div>
                <Label className="mb-1.5">Start time</Label>
                <Input
                  type="datetime-local"
                  value={draft.scheduledAtLocal}
                  onChange={(e) => set("scheduledAtLocal", e.target.value)}
                  min={new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Auto-start runs every minute via a Postgres cron job. Enable the
                  <span className="font-mono"> pg_cron </span>extension in Supabase if you haven't
                  already.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy}
            className="bg-gradient-primary text-primary-foreground shadow-glow"
          >
            {busy ? "Saving…" : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SaveModeCard({
  active,
  onClick,
  icon,
  title,
  detail,
}: {
  mode: SaveMode;
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
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
      <div
        className={`flex items-center gap-2 font-semibold text-sm ${active ? "text-primary" : ""}`}
      >
        {icon}
        {title}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </button>
  );
}
