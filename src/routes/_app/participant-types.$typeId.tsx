import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Plus, UsersRound } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SubTypeDialog, type SubTypeDraft } from "@/components/participants/SubTypeDialog";
import { SubTypeGrid, type SubTypeCard } from "@/components/participants/SubTypeGrid";
import { iconFor, type IconKey } from "@/components/categories/icons";

export const Route = createFileRoute("/_app/participant-types/$typeId")({
  component: TypeDetailPage,
});

type TypeRow = { id: string; name: string; icon: string | null };

function TypeDetailPage() {
  const { typeId } = Route.useParams();
  const { user } = useAuth();
  const [type, setType] = useState<TypeRow | null>(null);
  const [cards, setCards] = useState<SubTypeCard[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [t, subs, parts] = await Promise.all([
      supabase
        .from("participant_types")
        .select("id, name, icon")
        .eq("id", typeId)
        .eq("owner_id", user.id)
        .maybeSingle(),
      supabase
        .from("participant_subtypes")
        .select("id, type_id, name, description")
        .eq("type_id", typeId)
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("participants")
        .select("subtype_id")
        .eq("owner_id", user.id),
    ]);
    setLoading(false);
    if (t.error) toast.error(t.error.message);
    if (subs.error) toast.error(subs.error.message);
    setType(t.data ?? null);
    const counts = new Map<string, number>();
    for (const p of parts.data ?? []) {
      if (p.subtype_id) counts.set(p.subtype_id, (counts.get(p.subtype_id) ?? 0) + 1);
    }
    setCards(
      (subs.data ?? []).map((s) => ({
        id: s.id,
        type_id: s.type_id,
        name: s.name,
        description: s.description,
        participantCount: counts.get(s.id) ?? 0,
      })),
    );
  }, [user, typeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (draft: SubTypeDraft) => {
    if (!user) return;
    const { error } = await supabase.from("participant_subtypes").insert({
      owner_id: user.id,
      type_id: typeId,
      name: draft.name,
      description: draft.description || null,
    });
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success(`Created "${draft.name}"`);
    await load();
  };

  const update = async (id: string, draft: SubTypeDraft) => {
    const { error } = await supabase
      .from("participant_subtypes")
      .update({ name: draft.name, description: draft.description || null })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success("Sub-type updated");
    await load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("participant_subtypes").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCards((prev) => prev.filter((c) => c.id !== id));
    toast.success("Sub-type deleted");
  };

  const Icon = iconFor((type?.icon ?? null) as IconKey | null);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/participant-types"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> All types
        </Link>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-glow">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              {type?.name ?? "Type"}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Sub-types let you split this type — e.g. Class 9, Class 10 inside Student.
            </p>
          </div>
        </div>
        <SubTypeDialog
          title="Add sub-type"
          submitLabel="Create"
          onSubmit={create}
          trigger={
            <Button className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow">
              <Plus className="h-4 w-4" /> Add sub-type
            </Button>
          }
        />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          Loading sub-types…
        </div>
      ) : (
        <SubTypeGrid
          subtypes={cards}
          onEdit={update}
          onDelete={remove}
          emptyState={
            <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
              <UsersRound className="mx-auto h-10 w-10 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-medium">No sub-types yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add one — e.g. <span className="text-foreground">Class 9</span>,{" "}
                <span className="text-foreground">Engineering Team</span>.
              </p>
            </div>
          }
        />
      )}
    </div>
  );
}
