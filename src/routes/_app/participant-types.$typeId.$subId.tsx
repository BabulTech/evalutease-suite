import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Armchair,
  ChevronLeft,
  Hash,
  Mail,
  Pencil,
  Phone,
  Search,
  Trash2,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { ParticipantDialog } from "@/components/participants/ParticipantDialog";
import { InviteDialog, type InviteRow } from "@/components/participants/InviteDialog";
import {
  draftFromParticipant,
  draftToRow,
  type Participant,
  type ParticipantDraft,
  type ParticipantMeta,
} from "@/components/participants/types";

export const Route = createFileRoute("/_app/participant-types/$typeId/$subId")({
  component: SubTypeParticipantsPage,
});

type SubRow = { id: string; type_id: string; name: string };
type TypeRow = { id: string; name: string };

type ParticipantRow = {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  metadata: unknown;
  subtype_id: string | null;
  created_at: string;
};

function rowToParticipant(row: ParticipantRow): Participant {
  const meta =
    row.metadata && typeof row.metadata === "object" ? (row.metadata as ParticipantMeta) : {};
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    mobile: row.mobile,
    metadata: meta,
    created_at: row.created_at,
  };
}

function SubTypeParticipantsPage() {
  const { typeId, subId } = Route.useParams();
  const { user } = useAuth();
  const [type, setType] = useState<TypeRow | null>(null);
  const [sub, setSub] = useState<SubRow | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [t, s, p] = await Promise.all([
      supabase
        .from("participant_types")
        .select("id, name")
        .eq("id", typeId)
        .eq("owner_id", user.id)
        .maybeSingle(),
      supabase
        .from("participant_subtypes")
        .select("id, type_id, name")
        .eq("id", subId)
        .eq("owner_id", user.id)
        .maybeSingle(),
      supabase
        .from("participants")
        .select("id, name, email, mobile, metadata, subtype_id, created_at")
        .eq("owner_id", user.id)
        .eq("subtype_id", subId)
        .order("created_at", { ascending: false }),
    ]);
    setLoading(false);
    if (t.error) toast.error(t.error.message);
    if (s.error) toast.error(s.error.message);
    if (p.error) toast.error(p.error.message);
    setType(t.data ?? null);
    setSub(s.data ?? null);
    setParticipants(((p.data ?? []) as ParticipantRow[]).map(rowToParticipant));
  }, [user, typeId, subId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (draft: ParticipantDraft) => {
    if (!user) return;
    const row = draftToRow(draft, user.id);
    const { data, error } = await supabase
      .from("participants")
      .insert({ ...row, subtype_id: subId })
      .select("id, name, email, mobile, metadata, subtype_id, created_at")
      .single();
    if (error) {
      toast.error(error.message);
      throw error;
    }
    if (data) {
      setParticipants((prev) => [rowToParticipant(data as ParticipantRow), ...prev]);
      toast.success(`Added ${data.name}`);
    }
  };

  const update = async (id: string, draft: ParticipantDraft) => {
    if (!user) return;
    const row = draftToRow(draft, user.id);
    const { error } = await supabase
      .from("participants")
      .update({
        name: row.name,
        email: row.email,
        mobile: row.mobile,
        metadata: row.metadata,
      })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      throw error;
    }
    setParticipants((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, name: row.name, email: row.email, mobile: row.mobile, metadata: row.metadata }
          : p,
      ),
    );
    toast.success("Participant updated");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("participants").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setParticipants((prev) => prev.filter((p) => p.id !== id));
    toast.success("Participant removed");
  };

  const generateInvites = async (emails: string[]): Promise<InviteRow[]> => {
    if (!user) return [];
    const inputs: Array<{ owner_id: string; subtype_id: string; email: string | null }> =
      emails.length > 0
        ? emails.map((e) => ({ owner_id: user.id, subtype_id: subId, email: e }))
        : [{ owner_id: user.id, subtype_id: subId, email: null }];
    const { data, error } = await supabase
      .from("participant_invites")
      .insert(inputs)
      .select("id, email, token");
    if (error) {
      toast.error(error.message);
      throw error;
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return (data ?? []).map((r) => ({
      email: r.email,
      token: r.token,
      url: `${origin}/invite/${r.token}`,
    }));
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter((p) => {
      const haystack = [
        p.name,
        p.email,
        p.mobile,
        p.metadata.roll_number,
        p.metadata.seat_number,
        p.metadata.organization,
        p.metadata.class,
        p.metadata.address,
        p.metadata.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [participants, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/participant-types" className="hover:text-foreground">
          All types
        </Link>
        <ChevronLeft className="h-3 w-3 rotate-180" />
        <Link
          to="/participant-types/$typeId"
          params={{ typeId }}
          className="hover:text-foreground"
        >
          {type?.name ?? "Type"}
        </Link>
        <ChevronLeft className="h-3 w-3 rotate-180" />
        <span className="text-foreground">{sub?.name ?? "Sub-type"}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <UsersRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {sub?.name ?? "Sub-type"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Add participants to this sub-type, or invite them by link to register themselves.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <InviteDialog
            subtypeId={subId}
            subtypeName={sub?.name ?? "this group"}
            onGenerate={generateInvites}
            trigger={
              <Button variant="outline" className="gap-2">
                <Mail className="h-4 w-4" /> Invite by Email
              </Button>
            }
          />
          <ParticipantDialog
            title="Add participant"
            description={`They'll be added under ${type?.name ?? "this type"} → ${sub?.name ?? "this sub-type"}.`}
            submitLabel="Add"
            onSubmit={create}
            trigger={
              <Button className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow">
                <UserPlus className="h-4 w-4" /> Add Manually
              </Button>
            }
          />
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, roll number…"
            className="pl-9"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {participants.length} {participants.length === 1 ? "participant" : "participants"}
        </span>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          Loading participants…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground/60" />
          {participants.length === 0 ? (
            <>
              <p className="mt-3 text-sm font-medium">No participants in this sub-type yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add them manually or generate invite links.
              </p>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm font-medium">No matches</p>
              <p className="mt-1 text-xs text-muted-foreground">Try a different search.</p>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="hidden md:table-cell">Roll / Seat</TableHead>
                <TableHead className="hidden lg:table-cell">Organization</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <ParticipantTableRow key={p.id} p={p} onUpdate={update} onDelete={remove} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ParticipantTableRow({
  p,
  onUpdate,
  onDelete,
}: {
  p: Participant;
  onUpdate: (id: string, d: ParticipantDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{p.name}</div>
        {p.metadata.class && (
          <div className="text-xs text-muted-foreground">{p.metadata.class}</div>
        )}
      </TableCell>
      <TableCell>
        <div className="text-sm space-y-0.5">
          {p.email && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Mail className="h-3 w-3" />
              <span className="truncate max-w-[200px]">{p.email}</span>
            </div>
          )}
          {p.mobile && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="h-3 w-3" />
              {p.mobile}
            </div>
          )}
          {!p.email && !p.mobile && <span className="text-xs text-muted-foreground">—</span>}
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <div className="text-xs space-y-0.5">
          {p.metadata.roll_number && (
            <div className="flex items-center gap-1.5">
              <Hash className="h-3 w-3 text-muted-foreground" />
              {p.metadata.roll_number}
            </div>
          )}
          {p.metadata.seat_number && (
            <div className="flex items-center gap-1.5">
              <Armchair className="h-3 w-3 text-muted-foreground" />
              {p.metadata.seat_number}
            </div>
          )}
          {!p.metadata.roll_number && !p.metadata.seat_number && (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      </TableCell>
      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
        {p.metadata.organization || "—"}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <ParticipantDialog
            title="Edit participant"
            submitLabel="Save changes"
            initial={draftFromParticipant(p)}
            onSubmit={(d) => onUpdate(p.id, d)}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            }
          />
          <DeleteParticipantButton p={p} onConfirm={onDelete} />
        </div>
      </TableCell>
    </TableRow>
  );
}

function DeleteParticipantButton({
  p,
  onConfirm,
}: {
  p: Participant;
  onConfirm: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {p.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            They'll be removed from your roster. Past attempts in completed sessions are kept.
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
                await onConfirm(p.id);
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
