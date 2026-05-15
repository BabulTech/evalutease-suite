import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const expected = `/participant-types/${typeId}`;
  const onIndex = pathname === expected || pathname === expected + "/";
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
    if (onIndex) void load();
  }, [load, onIndex]);

  if (!onIndex) return <Outlet />;

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
    toast.success("Group updated");
    await load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("participant_subtypes").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCards((prev) => prev.filter((c) => c.id !== id));
    toast.success("Group deleted");
  };

  const Icon = iconFor((type?.icon ?? null) as IconKey | null);

  const totalParticipants = cards.reduce((s, c) => s + c.participantCount, 0);

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link to="/participant-types" className="hover:text-foreground transition-colors flex items-center gap-1">
          <UsersRound size={12} /> All types
        </Link>
        <ChevronLeft className="h-3 w-3 rotate-180 shrink-0" />
        <span className="text-foreground font-medium">{type?.name ?? "Type"}</span>
      </nav>

      {/* Hero header */}
      <div className="rounded-2xl border border-border bg-card/60 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-12 w-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-glow shrink-0">
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight truncate">
              {type?.name ?? "Type"}
            </h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <UsersRound size={11} /> {cards.length} {cards.length === 1 ? "group" : "groups"}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                · {totalParticipants} {totalParticipants === 1 ? "participant" : "participants"}
              </span>
            </div>
          </div>
        </div>
        <SubTypeDialog
          title="Add group"
          submitLabel="Create"
          onSubmit={create}
          trigger={
            <Button className="h-10 gap-2 bg-gradient-primary text-primary-foreground shadow-glow">
              <Plus className="h-4 w-4" /> Add Group
            </Button>
          }
        />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground animate-pulse">
          Loading groups…
        </div>
      ) : (
        <SubTypeGrid
          subtypes={cards}
          onEdit={update}
          onDelete={remove}
          emptyState={
            <div className="rounded-2xl border border-dashed border-border bg-card/30 p-12 text-center space-y-3">
              <UsersRound className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-semibold">No groups yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add a group to segment participants — e.g. <span className="text-foreground">Class 9</span>, <span className="text-foreground">Engineering Team</span>, or <span className="text-foreground">Batch 2024</span>.
                </p>
              </div>
              <SubTypeDialog
                title="Add group"
                submitLabel="Create"
                onSubmit={create}
                trigger={
                  <Button size="sm" className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow">
                    <Plus size={14} /> Add first group
                  </Button>
                }
              />
            </div>
          }
        />
      )}
    </div>
  );
}
