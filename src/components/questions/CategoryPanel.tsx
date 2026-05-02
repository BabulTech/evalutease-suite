import { useState } from "react";
import { toast } from "sonner";
import { Folder, FolderPlus, Pencil, Trash2, GraduationCap, Globe } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { Category } from "./types";

const SUBJECT_PRESETS = [
  { value: "general", label: "General" },
  { value: "history", label: "History" },
  { value: "science", label: "Science" },
  { value: "sports", label: "Sports" },
  { value: "religion", label: "Religion" },
  { value: "math", label: "Math" },
  { value: "language", label: "Language" },
  { value: "academic", label: "Academic (Class)" },
  { value: "other", label: "Other" },
];

type Props = {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (input: { name: string; subject: string | null }) => Promise<void>;
  onRename: (id: string, input: { name: string; subject: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  questionCounts: Record<string, number>;
};

export function CategoryPanel({
  categories,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  questionCounts,
}: Props) {
  return (
    <aside className="w-full lg:w-72 lg:shrink-0 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Categories
        </h2>
        <CategoryDialog
          mode="create"
          onSubmit={onCreate}
          trigger={
            <Button size="sm" variant="ghost" className="gap-1.5 text-primary">
              <FolderPlus className="h-4 w-4" /> New
            </Button>
          }
        />
      </div>

      {categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-6 text-center">
          <Folder className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <p className="mt-2 text-sm font-medium">No categories yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create one like <span className="font-medium text-foreground">History</span>,{" "}
            <span className="font-medium text-foreground">Science</span>, or{" "}
            <span className="font-medium text-foreground">Class 5</span>.
          </p>
          <CategoryDialog
            mode="create"
            onSubmit={onCreate}
            trigger={
              <Button size="sm" className="mt-3 gap-1.5">
                <FolderPlus className="h-4 w-4" /> Create category
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="space-y-1.5">
          {categories.map((c) => {
            const active = c.id === selectedId;
            const count = questionCounts[c.id] ?? 0;
            return (
              <li key={c.id}>
                <div
                  className={`group flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-all ${
                    active
                      ? "border-primary/40 bg-primary/10 shadow-glow"
                      : "border-border bg-card/40 hover:border-primary/30 hover:bg-card"
                  }`}
                >
                  <button
                    type="button"
                    className="flex flex-1 items-center gap-2 min-w-0 text-left"
                    onClick={() => onSelect(c.id)}
                  >
                    {c.subject === "academic" ? (
                      <GraduationCap
                        className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}
                      />
                    ) : (
                      <Globe
                        className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-sm font-medium truncate ${active ? "text-primary" : ""}`}
                      >
                        {c.name}
                      </div>
                      {c.subject && (
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {SUBJECT_PRESETS.find((s) => s.value === c.subject)?.label ?? c.subject}
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {count}
                    </span>
                  </button>
                  <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                    <CategoryDialog
                      mode="edit"
                      initial={c}
                      onSubmit={(v) => onRename(c.id, v)}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                    <DeleteCategoryButton category={c} onConfirm={() => onDelete(c.id)} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

type DialogProps = {
  mode: "create" | "edit";
  initial?: Category;
  trigger: React.ReactNode;
  onSubmit: (v: { name: string; subject: string | null }) => Promise<void>;
};

function CategoryDialog({ mode, initial, trigger, onSubmit }: DialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [subject, setSubject] = useState<string>(initial?.subject ?? "general");
  const [busy, setBusy] = useState(false);

  const handleOpen = (o: boolean) => {
    setOpen(o);
    if (o) {
      setName(initial?.name ?? "");
      setSubject(initial?.subject ?? "general");
    }
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name is required");
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ name: trimmed, subject: subject || null });
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create category" : "Rename category"}</DialogTitle>
          <DialogDescription>
            Group your questions by topic (History, Science…) or by class level (Class 1, Class 2…).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5">Name</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Science, Class 5, World History"
              maxLength={80}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </div>
          <div>
            <Label className="mb-1.5">Type</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUBJECT_PRESETS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            {busy ? "Saving…" : mode === "create" ? "Create" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteCategoryButton({
  category,
  onConfirm,
}: {
  category: Category;
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{category.name}"?</AlertDialogTitle>
          <AlertDialogDescription>
            The category will be removed. Questions inside will be unlinked but kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await onConfirm();
                setOpen(false);
              } finally {
                setBusy(false);
              }
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
